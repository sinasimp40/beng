import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  creditTopups,
  creditTelegramEvents,
  creditTransactions,
  orderItems,
  orders,
  products,
  users,
  type CreditTopup,
  type CreditTelegramEvent,
  type CreditTransaction,
  type Order,
  type User,
} from "@shared/schema";
import { db } from "./db";
import { InsufficientStockError } from "./storage";

const NOTIFICATION_LEASE_MS = 5 * 60 * 1000;
const MAX_NOTIFICATION_ATTEMPTS = 5;
const SUPPORTED_TOPUP_GATEWAY_STATUSES = new Set([
  "waiting",
  "confirming",
  "confirmed",
  "sending",
  "partially_paid",
  "finished",
  "failed",
  "expired",
  "refunded",
]);

function normalizeTopupTelegramStatus(status: string | null | undefined): string {
  switch ((status || "").toLowerCase()) {
    case "finished":
    case "completed":
      return "completed";
    case "confirming":
    case "confirmed":
    case "sending":
      return "confirming";
    case "waiting":
    case "creating":
    case "pending":
      return "pending";
    case "partially_paid":
      return "partially_paid";
    case "failed":
    case "expired":
    case "refunded":
      return status!.toLowerCase();
    default:
      return (status || "pending").toLowerCase();
  }
}

function telegramEventValues(topup: CreditTopup, eventStatus: string, gatewayStatus?: string | null) {
  return {
    eventKey: `topup:${topup.id}:${eventStatus}`,
    topupId: topup.id,
    userEmail: topup.userEmail,
    amountCents: topup.amountCents,
    payCurrency: topup.payCurrency,
    paymentId: topup.paymentId,
    eventStatus,
    gatewayStatus: gatewayStatus || topup.gatewayStatus,
  };
}

export class InsufficientCreditError extends Error {
  constructor(
    public readonly balanceCents: number,
    public readonly requiredCents: number,
  ) {
    super("Insufficient account credit");
    this.name = "InsufficientCreditError";
  }
}

export class CreditOperationError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = "CreditOperationError";
  }
}

export interface CreditPurchaseLine {
  productId: string;
  quantity: number;
}

function splitStock(stockList: string | null): string[] {
  return stockList?.split("\n").filter(item => item.trim() !== "") || [];
}

function dollarsToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class CreditStorage {
  async getUserActivity(userId: string): Promise<CreditTransaction[]> {
    return db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt));
  }

  async getAllTransactions(): Promise<CreditTransaction[]> {
    return db.select().from(creditTransactions)
      .orderBy(desc(creditTransactions.createdAt));
  }

  async getTransactionByOrderId(orderId: string): Promise<CreditTransaction | undefined> {
    const [transaction] = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.orderId, orderId));
    return transaction;
  }

  async deleteUserIfNoCreditRisk(userId: string): Promise<number> {
    return db.transaction(async tx => {
      const targetOrders = await tx.select().from(orders)
        .where(eq(orders.userId, userId)).for("update");
      const [user] = await tx.select().from(users)
        .where(eq(users.id, userId)).for("update");
      if (!user) throw new CreditOperationError("User not found", 404);

      const [ledgerEntry] = await tx.select({ id: creditTransactions.id })
        .from(creditTransactions).where(eq(creditTransactions.userId, userId)).limit(1);
      const [topup] = await tx.select({ id: creditTopups.id })
        .from(creditTopups).where(eq(creditTopups.userId, userId)).limit(1);
      if (user.creditBalanceCents !== 0 || ledgerEntry || topup) {
        throw new CreditOperationError(
          "Users with account-credit activity cannot be deleted; ban the account instead",
          409,
        );
      }

      // Include legacy orders that predate userId ownership.
      const emailOrders = await tx.select().from(orders)
        .where(eq(orders.email, user.email)).for("update");
      const orderIds = [...targetOrders, ...emailOrders].map(order => order.orderId);
      if (orderIds.length > 0) {
        await tx.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
      }
      const deletedOrders = await tx.delete(orders)
        .where(or(eq(orders.userId, userId), eq(orders.email, user.email))).returning();
      await tx.delete(users).where(eq(users.id, userId));
      return deletedOrders.length;
    });
  }

  async deleteOrderIfNoCreditActivity(id: string): Promise<boolean> {
    return db.transaction(async tx => {
      const [order] = await tx.select().from(orders)
        .where(eq(orders.id, id)).for("update");
      if (!order) return false;
      const [ledgerEntry] = await tx.select({ id: creditTransactions.id })
        .from(creditTransactions).where(eq(creditTransactions.orderId, order.orderId)).limit(1);
      if (ledgerEntry) {
        throw new CreditOperationError("Orders linked to account-credit activity cannot be deleted", 409);
      }
      await tx.delete(orderItems).where(eq(orderItems.orderId, order.orderId));
      await tx.delete(orders).where(eq(orders.id, id));
      return true;
    });
  }

  async createTopup(params: {
    userId: string;
    userEmail: string;
    amountCents: number;
    payCurrency: string;
    idempotencyKey: string;
  }): Promise<{ topup: CreditTopup; replayed: boolean }> {
    return db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${params.idempotencyKey}))`);
      const operationFingerprint = fingerprint({
        type: "topup_creation",
        userId: params.userId,
        amountCents: params.amountCents,
        payCurrency: params.payCurrency.toLowerCase(),
      });
      const [existing] = await tx.select().from(creditTopups)
        .where(eq(creditTopups.idempotencyKey, params.idempotencyKey));
      if (existing) {
        if (existing.operationFingerprint !== operationFingerprint) {
          throw new CreditOperationError("Idempotency key was already used for a different top-up", 409);
        }
        return { topup: existing, replayed: true };
      }
      const [user] = await tx.select({ id: users.id }).from(users)
        .where(eq(users.id, params.userId)).for("update");
      if (!user) throw new CreditOperationError("Top-up user no longer exists", 409);
      const [topup] = await tx.insert(creditTopups).values({
        ...params,
        operationFingerprint,
        status: "creating",
        updatedAt: new Date().toISOString(),
      }).returning();
      return { topup, replayed: false };
    });
  }

  async attachTopupPayment(topupId: string, payment: {
    paymentId: string;
    payAddress?: string | null;
    payAmount?: number | null;
    gatewayStatus?: string | null;
  }): Promise<CreditTopup | undefined> {
    return db.transaction(async tx => {
      const [topup] = await tx.update(creditTopups).set({
        paymentId: payment.paymentId,
        payAddress: payment.payAddress,
        payAmount: payment.payAmount,
        gatewayStatus: payment.gatewayStatus || "waiting",
        status: "pending",
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(creditTopups.id, topupId),
        eq(creditTopups.status, "creating"),
      )).returning();
      if (topup) {
        await tx.insert(creditTelegramEvents)
          .values(telegramEventValues(topup, "pending", payment.gatewayStatus))
          .onConflictDoNothing({ target: creditTelegramEvents.eventKey });
      }
      return topup;
    });
  }

  async failTopupCreation(topupId: string, message: string): Promise<void> {
    await db.transaction(async tx => {
      const [topup] = await tx.update(creditTopups).set({
        status: "failed",
        gatewayStatus: message.slice(0, 250),
        updatedAt: new Date().toISOString(),
      }).where(eq(creditTopups.id, topupId)).returning();
      if (topup) {
        await tx.insert(creditTelegramEvents)
          .values(telegramEventValues(topup, "failed", topup.gatewayStatus))
          .onConflictDoNothing({ target: creditTelegramEvents.eventKey });
      }
    });
  }

  async getTopup(topupId: string): Promise<CreditTopup | undefined> {
    const [topup] = await db.select().from(creditTopups).where(eq(creditTopups.id, topupId));
    return topup;
  }

  async getTopupByPaymentId(paymentId: string): Promise<CreditTopup | undefined> {
    const [topup] = await db.select().from(creditTopups)
      .where(eq(creditTopups.paymentId, paymentId));
    return topup;
  }

  async getPendingTopups(): Promise<CreditTopup[]> {
    const reconciliationCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const reconciliationDueBefore = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    return db.select().from(creditTopups).where(and(
      isNotNull(creditTopups.paymentId),
      or(
        inArray(creditTopups.status, ["creating", "pending"]),
        and(
          eq(creditTopups.status, "completed"),
          isNotNull(creditTopups.completedAt),
          gte(creditTopups.completedAt, reconciliationCutoff),
          or(
            isNull(creditTopups.lastReconciledAt),
            lt(creditTopups.lastReconciledAt, reconciliationDueBefore),
          ),
        ),
      ),
    )).orderBy(asc(creditTopups.createdAt));
  }

  async applyTopupGatewayStatus(
    topupId: string,
    gateway: {
      paymentId: string;
      status: string;
      priceAmount?: number;
      priceCurrency?: string;
      payCurrency?: string;
    },
  ): Promise<{ topup: CreditTopup; transaction?: CreditTransaction; user?: User }> {
    return db.transaction(async tx => {
      const [topup] = await tx.select().from(creditTopups)
        .where(eq(creditTopups.id, topupId)).for("update");
      if (!topup) throw new CreditOperationError("Credit top-up not found", 404);
      const gatewayStatus = gateway.status.trim().toLowerCase();
      if (!SUPPORTED_TOPUP_GATEWAY_STATUSES.has(gatewayStatus)) {
        throw new CreditOperationError(`Unsupported top-up gateway status: ${gateway.status}`, 400);
      }
      if (!topup.paymentId || gateway.paymentId !== topup.paymentId) {
        throw new CreditOperationError("Top-up payment identity mismatch", 409);
      }
      if (
        gateway.priceAmount !== undefined &&
        dollarsToCents(gateway.priceAmount) !== topup.amountCents
      ) {
        throw new CreditOperationError("Top-up payment amount mismatch", 409);
      }
      if (gateway.priceCurrency && gateway.priceCurrency.toLowerCase() !== "usd") {
        throw new CreditOperationError("Top-up price currency mismatch", 409);
      }
      if (gateway.payCurrency && gateway.payCurrency.toLowerCase() !== topup.payCurrency.toLowerCase()) {
        throw new CreditOperationError("Top-up payment currency mismatch", 409);
      }
      const previousTelegramStatus = normalizeTopupTelegramStatus(topup.gatewayStatus || topup.status);
      const nextTelegramStatus = normalizeTopupTelegramStatus(gatewayStatus);
      const recordTelegramTransition = async (updatedTopup: CreditTopup) => {
        if (nextTelegramStatus !== previousTelegramStatus) {
          await tx.insert(creditTelegramEvents)
            .values(telegramEventValues(updatedTopup, nextTelegramStatus, gatewayStatus))
            .onConflictDoNothing({ target: creditTelegramEvents.eventKey });
        }
        return updatedTopup;
      };

      const terminalFailure = gatewayStatus === "failed" ||
        gatewayStatus === "expired" ||
        gatewayStatus === "refunded";
      const completed = gatewayStatus === "finished";

      if (topup.status === "completed") {
        if (gatewayStatus !== "refunded") {
          const [transaction] = topup.transactionId
            ? await tx.select().from(creditTransactions)
                .where(eq(creditTransactions.id, topup.transactionId))
            : [];
          const [user] = await tx.select().from(users).where(eq(users.id, topup.userId));
          const [reconciledTopup] = await tx.update(creditTopups).set({
            gatewayStatus,
            lastReconciledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }).where(eq(creditTopups.id, topup.id)).returning();
          return { topup: await recordTelegramTransition(reconciledTopup), transaction, user };
        }

        const reversalKey = `topup-refund:${topup.id}`;
        const [existingReversal] = await tx.select().from(creditTransactions)
          .where(eq(creditTransactions.idempotencyKey, reversalKey));
        if (existingReversal) {
          const [user] = await tx.select().from(users).where(eq(users.id, topup.userId));
          const [updatedTopup] = await tx.update(creditTopups).set({
            status: "refunded",
            gatewayStatus,
            lastReconciledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }).where(eq(creditTopups.id, topup.id)).returning();
          return { topup: await recordTelegramTransition(updatedTopup), transaction: existingReversal, user };
        }

        const [lockedUser] = await tx.select().from(users)
          .where(eq(users.id, topup.userId)).for("update");
        if (!lockedUser) throw new CreditOperationError("Top-up user no longer exists", 409);
        const balanceAfterCents = lockedUser.creditBalanceCents - topup.amountCents;
        const [user] = await tx.update(users).set({ creditBalanceCents: balanceAfterCents })
          .where(eq(users.id, lockedUser.id)).returning();
        const [reversal] = await tx.insert(creditTransactions).values({
          userId: lockedUser.id,
          userEmail: lockedUser.email,
          type: "topup_reversal",
          amountCents: -topup.amountCents,
          balanceAfterCents,
          idempotencyKey: reversalKey,
          operationFingerprint: fingerprint({
            type: "topup_reversal",
            topupId: topup.id,
            amountCents: topup.amountCents,
          }),
          topupId: topup.id,
          reason: "Payment provider refunded a completed top-up",
        }).returning();
        const [updatedTopup] = await tx.update(creditTopups).set({
          status: "refunded",
          gatewayStatus,
          lastReconciledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).where(eq(creditTopups.id, topup.id)).returning();
        return { topup: await recordTelegramTransition(updatedTopup), transaction: reversal, user };
      }

      if (["failed", "expired", "refunded"].includes(topup.status)) {
        return { topup };
      }

      if (!completed) {
        const [updated] = await tx.update(creditTopups).set({
          status: terminalFailure ? gatewayStatus : "pending",
          gatewayStatus,
          lastReconciledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).where(eq(creditTopups.id, topup.id)).returning();
        return { topup: await recordTelegramTransition(updated) };
      }

      const [existingTransaction] = await tx.select().from(creditTransactions)
        .where(eq(creditTransactions.idempotencyKey, `topup:${topup.id}`));
      if (existingTransaction) {
        const [updated] = await tx.update(creditTopups).set({
          status: "completed",
          gatewayStatus,
          transactionId: existingTransaction.id,
          completedAt: topup.completedAt || new Date().toISOString(),
          lastReconciledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).where(eq(creditTopups.id, topup.id)).returning();
        const [user] = await tx.select().from(users).where(eq(users.id, topup.userId));
        return { topup: await recordTelegramTransition(updated), transaction: existingTransaction, user };
      }

      const [lockedUser] = await tx.select().from(users)
        .where(eq(users.id, topup.userId)).for("update");
      if (!lockedUser) throw new CreditOperationError("Top-up user no longer exists", 409);

      const balanceAfterCents = lockedUser.creditBalanceCents + topup.amountCents;
      const [user] = await tx.update(users).set({ creditBalanceCents: balanceAfterCents })
        .where(eq(users.id, lockedUser.id)).returning();
      const [transaction] = await tx.insert(creditTransactions).values({
        userId: lockedUser.id,
        userEmail: lockedUser.email,
        type: "topup",
        amountCents: topup.amountCents,
        balanceAfterCents,
        idempotencyKey: `topup:${topup.id}`,
        operationFingerprint: fingerprint({
          type: "topup",
          userId: lockedUser.id,
          topupId: topup.id,
          amountCents: topup.amountCents,
        }),
        topupId: topup.id,
      }).returning();
      const now = new Date().toISOString();
      const [updatedTopup] = await tx.update(creditTopups).set({
        status: "completed",
        gatewayStatus,
        transactionId: transaction.id,
        completedAt: now,
        lastReconciledAt: now,
        updatedAt: now,
      }).where(eq(creditTopups.id, topup.id)).returning();
      return { topup: await recordTelegramTransition(updatedTopup), transaction, user };
    });
  }

  async adjustCredit(params: {
    userId: string;
    amountCents: number;
    reason: string;
    actorUserId: string;
    actorEmail: string;
    idempotencyKey?: string;
  }): Promise<{ user: User; transaction: CreditTransaction }> {
    return db.transaction(async tx => {
      if (!params.idempotencyKey) {
        throw new CreditOperationError("An idempotency key is required", 400);
      }
      const idempotencyKey = params.idempotencyKey;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${idempotencyKey}))`);
      const operationFingerprint = fingerprint({
        type: "admin_adjustment",
        userId: params.userId,
        amountCents: params.amountCents,
        reason: params.reason,
        actorUserId: params.actorUserId,
      });
      const [existing] = await tx.select().from(creditTransactions)
        .where(eq(creditTransactions.idempotencyKey, idempotencyKey));
      if (existing) {
        if (existing.operationFingerprint !== operationFingerprint) {
          throw new CreditOperationError("Idempotency key was already used for a different adjustment", 409);
        }
        const [user] = await tx.select().from(users).where(eq(users.id, existing.userId));
        if (!user) throw new CreditOperationError("User no longer exists", 409);
        return { user, transaction: existing };
      }

      const [lockedUser] = await tx.select().from(users)
        .where(eq(users.id, params.userId)).for("update");
      if (!lockedUser) throw new CreditOperationError("User not found", 404);
      const balanceAfterCents = lockedUser.creditBalanceCents + params.amountCents;
      if (balanceAfterCents < 0) {
        throw new InsufficientCreditError(lockedUser.creditBalanceCents, Math.abs(params.amountCents));
      }

      const [user] = await tx.update(users).set({ creditBalanceCents: balanceAfterCents })
        .where(eq(users.id, lockedUser.id)).returning();
      const [transaction] = await tx.insert(creditTransactions).values({
        userId: user.id,
        userEmail: user.email,
        type: params.amountCents > 0 ? "admin_credit" : "admin_debit",
        amountCents: params.amountCents,
        balanceAfterCents,
        idempotencyKey,
        operationFingerprint,
        actorUserId: params.actorUserId,
        actorEmail: params.actorEmail,
        reason: params.reason,
      }).returning();
      return { user, transaction };
    });
  }

  async purchaseWithCredit(params: {
    orderId: string;
    userId: string;
    ipAddress?: string | null;
    lines: CreditPurchaseLine[];
    idempotencyKey?: string;
  }): Promise<{ order: Order; transaction: CreditTransaction; user: User; productIds: string[] }> {
    return db.transaction(async tx => {
      if (!params.idempotencyKey) {
        throw new CreditOperationError("An idempotency key is required", 400);
      }
      const idempotencyKey = params.idempotencyKey;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${idempotencyKey}))`);
      const normalizedLines = params.lines
        .map(line => ({ productId: line.productId, quantity: line.quantity }))
        .sort((a, b) => a.productId.localeCompare(b.productId));
      const operationFingerprint = fingerprint({
        type: "purchase",
        userId: params.userId,
        lines: normalizedLines,
      });
      const [existingTransaction] = await tx.select().from(creditTransactions)
        .where(eq(creditTransactions.idempotencyKey, idempotencyKey));
      if (existingTransaction && existingTransaction.operationFingerprint !== operationFingerprint) {
        throw new CreditOperationError("Idempotency key was already used for a different purchase", 409);
      }
      if (existingTransaction?.orderId) {
        const [existingOrder] = await tx.select().from(orders)
          .where(eq(orders.orderId, existingTransaction.orderId));
        const [existingUser] = await tx.select().from(users)
          .where(eq(users.id, existingTransaction.userId));
        if (existingOrder && existingUser) {
          return { order: existingOrder, transaction: existingTransaction, user: existingUser, productIds: [] };
        }
      }

      const [lockedUser] = await tx.select().from(users)
        .where(eq(users.id, params.userId)).for("update");
      if (!lockedUser) throw new CreditOperationError("User not found", 404);
      if (lockedUser.banned === 1) throw new CreditOperationError("Account is banned", 403);

      const quantities = new Map<string, number>();
      for (const line of params.lines) {
        quantities.set(line.productId, (quantities.get(line.productId) || 0) + line.quantity);
      }
      const productIds = Array.from(quantities.keys()).sort();
      if (productIds.length === 0) throw new CreditOperationError("At least one item is required");

      const lockedProducts = await tx.select().from(products)
        .where(inArray(products.id, productIds))
        .orderBy(products.id)
        .for("update");
      const byId = new Map(lockedProducts.map(product => [product.id, product]));
      const deliveredById = new Map<string, string[]>();
      let totalCents = 0;
      let totalQuantity = 0;

      for (const productId of productIds) {
        const product = byId.get(productId);
        const quantity = quantities.get(productId)!;
        if (!product || product.enabled !== 1) {
          throw new CreditOperationError("A selected product is no longer available", 409);
        }
        const available = splitStock(product.stockList);
        if (available.length < quantity) {
          throw new InsufficientStockError(product.name, available.length, quantity);
        }
        deliveredById.set(productId, available.slice(0, quantity));
        totalCents += dollarsToCents(product.price) * quantity;
        totalQuantity += quantity;
      }

      if (lockedUser.creditBalanceCents < totalCents) {
        throw new InsufficientCreditError(lockedUser.creditBalanceCents, totalCents);
      }

      for (const productId of productIds) {
        const product = byId.get(productId)!;
        const claimed = deliveredById.get(productId)!;
        const remaining = splitStock(product.stockList).slice(claimed.length);
        await tx.update(products).set({
          stockList: remaining.join("\n"),
          stock: remaining.length,
        }).where(eq(products.id, productId));
      }

      const firstProduct = byId.get(productIds[0])!;
      const deliveredSections = productIds.map(productId => {
        const product = byId.get(productId)!;
        const delivered = deliveredById.get(productId)!;
        return `${product.name} (x${delivered.length})\n${delivered.join("\n")}`;
      });
      const [order] = await tx.insert(orders).values({
        orderId: params.orderId,
        userId: lockedUser.id,
        productId: firstProduct.id,
        productName: productIds.length === 1 ? firstProduct.name : `${productIds.length} products`,
        quantity: totalQuantity,
        totalAmount: totalCents / 100,
        status: "fulfilling",
        paymentId: `credit-${params.orderId}`,
        email: lockedUser.email,
        createdAt: new Date().toISOString(),
        sentStock: deliveredSections.join("\n\n"),
        deliveryStatus: "pending",
        ipAddress: params.ipAddress || null,
        paymentMethod: "credit",
      }).returning();

      await tx.insert(orderItems).values(productIds.map(productId => {
        const product = byId.get(productId)!;
        return {
          orderId: order.orderId,
          productId,
          productName: product.name,
          quantity: quantities.get(productId)!,
          unitPrice: product.price,
          fulfillmentStatus: "claimed",
          fulfilledStock: deliveredById.get(productId)!.join("\n"),
        };
      }));

      const balanceAfterCents = lockedUser.creditBalanceCents - totalCents;
      const [user] = await tx.update(users).set({ creditBalanceCents: balanceAfterCents })
        .where(eq(users.id, lockedUser.id)).returning();
      const [transaction] = await tx.insert(creditTransactions).values({
        userId: user.id,
        userEmail: user.email,
        type: "purchase",
        amountCents: -totalCents,
        balanceAfterCents,
        idempotencyKey,
        operationFingerprint,
        orderId: order.orderId,
        reason: `Account-credit purchase ${order.orderId}`,
      }).returning();
      return { order, transaction, user, productIds };
    });
  }

  async refundOrderToCredit(params: {
    orderId: string;
    reason: string;
    actorUserId: string;
    actorEmail: string;
  }): Promise<{ order: Order; transaction: CreditTransaction; user: User }> {
    return db.transaction(async tx => {
      const [order] = await tx.select().from(orders)
        .where(eq(orders.id, params.orderId)).for("update");
      if (!order) throw new CreditOperationError("Order not found", 404);

      const idempotencyKey = `refund:${order.id}`;
      const [existing] = await tx.select().from(creditTransactions)
        .where(eq(creditTransactions.idempotencyKey, idempotencyKey));
      if (existing) {
        const [user] = await tx.select().from(users).where(eq(users.id, existing.userId));
        if (!user) throw new CreditOperationError("Refunded user no longer exists", 409);
        return { order, transaction: existing, user };
      }

      if (order.status !== "completed") {
        throw new CreditOperationError("Only completed orders can be refunded to credit", 409);
      }
      if (!order.userId) {
        throw new CreditOperationError("Guest orders cannot be refunded to account credit", 409);
      }
      const [lockedUser] = await tx.select().from(users)
        .where(eq(users.id, order.userId)).for("update");
      if (!lockedUser) throw new CreditOperationError("Order user no longer exists", 409);

      const amountCents = dollarsToCents(order.totalAmount);
      const balanceAfterCents = lockedUser.creditBalanceCents + amountCents;
      const [user] = await tx.update(users).set({ creditBalanceCents: balanceAfterCents })
        .where(eq(users.id, lockedUser.id)).returning();
      const [transaction] = await tx.insert(creditTransactions).values({
        userId: user.id,
        userEmail: user.email,
        type: "refund",
        amountCents,
        balanceAfterCents,
        idempotencyKey,
        operationFingerprint: fingerprint({
          type: "refund",
          orderId: order.id,
          amountCents,
        }),
        orderId: order.orderId,
        actorUserId: params.actorUserId,
        actorEmail: params.actorEmail,
        reason: params.reason,
      }).returning();
      const [refundedOrder] = await tx.update(orders).set({
        status: "refunded",
        refundedAt: new Date().toISOString(),
        refundedBy: params.actorUserId,
        refundReason: params.reason,
      }).where(eq(orders.id, order.id)).returning();
      return { order: refundedOrder, transaction, user };
    });
  }

  async claimPendingNotifications(limit = 20): Promise<CreditTransaction[]> {
    const staleBefore = new Date(Date.now() - NOTIFICATION_LEASE_MS).toISOString();
    return db.transaction(async tx => {
      const candidates = await tx.select().from(creditTransactions).where(and(
        lt(creditTransactions.notificationAttempts, MAX_NOTIFICATION_ATTEMPTS),
        or(
          inArray(creditTransactions.notificationStatus, ["pending", "failed"]),
          and(
            eq(creditTransactions.notificationStatus, "sending"),
            isNotNull(creditTransactions.notificationAttemptedAt),
            lte(creditTransactions.notificationAttemptedAt, staleBefore),
          ),
        ),
      )).orderBy(asc(creditTransactions.createdAt)).limit(limit).for("update", { skipLocked: true });
      if (candidates.length === 0) return [];

      const ids = candidates.map(item => item.id);
      const leaseId = randomUUID();
      return tx.update(creditTransactions).set({
        notificationStatus: "sending",
        notificationAttempts: sql`${creditTransactions.notificationAttempts} + 1`,
        notificationAttemptedAt: new Date().toISOString(),
        notificationLastError: null,
        notificationLeaseId: leaseId,
      }).where(inArray(creditTransactions.id, ids)).returning();
    });
  }

  async completeNotification(id: string, leaseId: string): Promise<void> {
    await db.update(creditTransactions).set({
      notificationStatus: "sent",
      notifiedAt: new Date().toISOString(),
      notificationLastError: null,
      notificationLeaseId: null,
    }).where(and(
      eq(creditTransactions.id, id),
      eq(creditTransactions.notificationStatus, "sending"),
      eq(creditTransactions.notificationLeaseId, leaseId),
    ));
  }

  async failNotification(id: string, leaseId: string, error: string): Promise<void> {
    await db.update(creditTransactions).set({
      notificationStatus: "failed",
      notificationLastError: error.slice(0, 1000),
      notificationLeaseId: null,
    }).where(and(
      eq(creditTransactions.id, id),
      eq(creditTransactions.notificationStatus, "sending"),
      eq(creditTransactions.notificationLeaseId, leaseId),
    ));
  }

  async claimPendingTelegramEvents(limit = 20): Promise<CreditTelegramEvent[]> {
    const staleBefore = new Date(Date.now() - NOTIFICATION_LEASE_MS).toISOString();
    return db.transaction(async tx => {
      const candidates = await tx.select().from(creditTelegramEvents).where(and(
        lt(creditTelegramEvents.deliveryAttempts, MAX_NOTIFICATION_ATTEMPTS),
        or(
          inArray(creditTelegramEvents.deliveryStatus, ["pending", "failed"]),
          and(
            eq(creditTelegramEvents.deliveryStatus, "sending"),
            isNotNull(creditTelegramEvents.deliveryAttemptedAt),
            lte(creditTelegramEvents.deliveryAttemptedAt, staleBefore),
          ),
        ),
      )).orderBy(asc(creditTelegramEvents.createdAt)).limit(limit).for("update", { skipLocked: true });
      if (candidates.length === 0) return [];

      const ids = candidates.map(item => item.id);
      const leaseId = randomUUID();
      return tx.update(creditTelegramEvents).set({
        deliveryStatus: "sending",
        deliveryAttempts: sql`${creditTelegramEvents.deliveryAttempts} + 1`,
        deliveryAttemptedAt: new Date().toISOString(),
        deliveryLastError: null,
        deliveryLeaseId: leaseId,
      }).where(inArray(creditTelegramEvents.id, ids)).returning();
    });
  }

  async completeTelegramEvent(id: string, leaseId: string): Promise<void> {
    await db.update(creditTelegramEvents).set({
      deliveryStatus: "sent",
      sentAt: new Date().toISOString(),
      deliveryLastError: null,
      deliveryLeaseId: null,
    }).where(and(
      eq(creditTelegramEvents.id, id),
      eq(creditTelegramEvents.deliveryStatus, "sending"),
      eq(creditTelegramEvents.deliveryLeaseId, leaseId),
    ));
  }

  async failTelegramEvent(id: string, leaseId: string, error: string): Promise<void> {
    await db.update(creditTelegramEvents).set({
      deliveryStatus: sql`CASE WHEN ${creditTelegramEvents.deliveryAttempts} >= ${MAX_NOTIFICATION_ATTEMPTS} THEN 'exhausted' ELSE 'failed' END`,
      deliveryLastError: error.slice(0, 1000),
      deliveryLeaseId: null,
    }).where(and(
      eq(creditTelegramEvents.id, id),
      eq(creditTelegramEvents.deliveryStatus, "sending"),
      eq(creditTelegramEvents.deliveryLeaseId, leaseId),
    ));
  }

  private async exhaustStaleFinalTelegramAttempt(id?: string): Promise<void> {
    const staleBefore = new Date(Date.now() - NOTIFICATION_LEASE_MS).toISOString();
    await db.update(creditTelegramEvents).set({
      deliveryStatus: "exhausted",
      deliveryLastError: "Telegram delivery attempt timed out before completion",
      deliveryLeaseId: null,
    }).where(and(
      ...(id ? [eq(creditTelegramEvents.id, id)] : []),
      eq(creditTelegramEvents.deliveryStatus, "sending"),
      gte(creditTelegramEvents.deliveryAttempts, MAX_NOTIFICATION_ATTEMPTS),
      isNotNull(creditTelegramEvents.deliveryAttemptedAt),
      lte(creditTelegramEvents.deliveryAttemptedAt, staleBefore),
    ));
  }

  async getExhaustedTelegramEvents(): Promise<CreditTelegramEvent[]> {
    await this.exhaustStaleFinalTelegramAttempt();
    return db.select().from(creditTelegramEvents)
      .where(and(
        gte(creditTelegramEvents.deliveryAttempts, MAX_NOTIFICATION_ATTEMPTS),
        inArray(creditTelegramEvents.deliveryStatus, ["failed", "exhausted"]),
      ))
      .orderBy(desc(creditTelegramEvents.deliveryAttemptedAt), desc(creditTelegramEvents.createdAt));
  }

  async retryExhaustedTelegramEvent(id: string): Promise<CreditTelegramEvent | undefined> {
    await this.exhaustStaleFinalTelegramAttempt(id);
    const [event] = await db.update(creditTelegramEvents).set({
      deliveryStatus: "pending",
      deliveryAttempts: 0,
      deliveryLeaseId: null,
      deliveryAttemptedAt: null,
      deliveryLastError: null,
      sentAt: null,
    }).where(and(
      eq(creditTelegramEvents.id, id),
      gte(creditTelegramEvents.deliveryAttempts, MAX_NOTIFICATION_ATTEMPTS),
      inArray(creditTelegramEvents.deliveryStatus, ["failed", "exhausted"]),
    )).returning();
    return event;
  }
}

export const creditStorage = new CreditStorage();