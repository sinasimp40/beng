import { after, afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { creditStorage, InsufficientCreditError } from "./creditStorage";
import { importDatabase } from "./services/databaseBackupService";
import {
  creditTopups,
  creditTransactions,
  orderItems,
  orders,
  products,
  users,
} from "@shared/schema";

const userIds = new Set<string>();
const productIds = new Set<string>();
const orderIds = new Set<string>();
const topupIds = new Set<string>();

async function createUser(balanceCents = 0) {
  const id = `credit-test-user-${randomUUID()}`;
  userIds.add(id);
  const [user] = await db.insert(users).values({
    id,
    email: `${id}@example.com`,
    password: "test-only",
    role: "user",
    creditBalanceCents: balanceCents,
  }).returning();
  return user;
}

async function createProduct(price: number, stockItems: string[]) {
  const id = `credit-test-product-${randomUUID()}`;
  productIds.add(id);
  const [product] = await db.insert(products).values({
    id,
    name: `Credit test ${id.slice(-6)}`,
    description: "Credit integration test product",
    price,
    category: "TEST",
    stock: stockItems.length,
    stockList: stockItems.join("\n"),
    enabled: 1,
    countries: [],
  }).returning();
  return product;
}

function newOrderId() {
  const orderId = `credit-test-order-${randomUUID()}`;
  orderIds.add(orderId);
  return orderId;
}

beforeEach(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for credit integration tests");
  }
});

afterEach(async () => {
  if (userIds.size > 0) {
    await db.delete(creditTransactions).where(inArray(creditTransactions.userId, Array.from(userIds)));
    await db.delete(creditTopups).where(inArray(creditTopups.userId, Array.from(userIds)));
  }
  if (orderIds.size > 0) {
    await db.delete(orderItems).where(inArray(orderItems.orderId, Array.from(orderIds)));
    await db.delete(orders).where(inArray(orders.orderId, Array.from(orderIds)));
  }
  if (productIds.size > 0) {
    await db.delete(products).where(inArray(products.id, Array.from(productIds)));
  }
  if (userIds.size > 0) {
    await db.delete(users).where(inArray(users.id, Array.from(userIds)));
  }
  userIds.clear();
  productIds.clear();
  orderIds.clear();
  topupIds.clear();
});

after(async () => {
  await pool.end();
});

describe("account credit integrity", () => {
  it("credits a completed gateway top-up exactly once across duplicate callbacks", async () => {
    const user = await createUser();
    const { topup } = await creditStorage.createTopup({
      userId: user.id,
      userEmail: user.email,
      amountCents: 500,
      payCurrency: "btc",
      idempotencyKey: `topup-create-${randomUUID()}`,
    });
    topupIds.add(topup.id);
    const paymentId = `credit-test-payment-${randomUUID()}`;
    await creditStorage.attachTopupPayment(topup.id, {
      paymentId,
      gatewayStatus: "waiting",
    });

    await Promise.all(
      Array.from({ length: 8 }, () =>
        creditStorage.applyTopupGatewayStatus(topup.id, {
          paymentId,
          status: "finished",
          priceAmount: 5,
          priceCurrency: "usd",
          payCurrency: "btc",
        }),
      ),
    );

    const updatedUser = await db.select().from(users).where(eq(users.id, user.id));
    const ledger = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, `topup:${topup.id}`));
    assert.equal(updatedUser[0].creditBalanceCents, 500);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].amountCents, 500);
  });

  it("allows only one concurrent purchase when the balance covers one", async () => {
    const user = await createUser(100);
    const product = await createProduct(1, ["credential-a", "credential-b"]);
    const firstOrderId = newOrderId();
    const secondOrderId = newOrderId();

    const results = await Promise.allSettled([
      creditStorage.purchaseWithCredit({
        orderId: firstOrderId,
        userId: user.id,
        lines: [{ productId: product.id, quantity: 1 }],
        idempotencyKey: `purchase-${firstOrderId}`,
      }),
      creditStorage.purchaseWithCredit({
        orderId: secondOrderId,
        userId: user.id,
        lines: [{ productId: product.id, quantity: 1 }],
        idempotencyKey: `purchase-${secondOrderId}`,
      }),
    ]);

    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const rejected = results.find(result => result.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.ok(rejected.reason instanceof InsufficientCreditError);
    const updatedUser = await db.select().from(users).where(eq(users.id, user.id));
    const updatedProduct = await db.select().from(products).where(eq(products.id, product.id));
    const purchases = await db.select().from(creditTransactions).where(eq(creditTransactions.type, "purchase"));
    assert.equal(updatedUser[0].creditBalanceCents, 0);
    assert.equal(updatedProduct[0].stock, 1);
    assert.equal(purchases.filter(transaction => transaction.userId === user.id).length, 1);
  });

  it("does not mutate stock, balance, or ledger when credit is insufficient", async () => {
    const user = await createUser(50);
    const product = await createProduct(1, ["credential-a"]);
    const orderId = newOrderId();

    await assert.rejects(
      creditStorage.purchaseWithCredit({
        orderId,
        userId: user.id,
        lines: [{ productId: product.id, quantity: 1 }],
        idempotencyKey: `purchase-${orderId}`,
      }),
      InsufficientCreditError,
    );

    const updatedUser = await db.select().from(users).where(eq(users.id, user.id));
    const updatedProduct = await db.select().from(products).where(eq(products.id, product.id));
    const order = await db.select().from(orders).where(eq(orders.orderId, orderId));
    const ledger = await db.select().from(creditTransactions).where(eq(creditTransactions.userId, user.id));
    assert.equal(updatedUser[0].creditBalanceCents, 50);
    assert.equal(updatedProduct[0].stock, 1);
    assert.equal(order.length, 0);
    assert.equal(ledger.length, 0);
  });

  it("refunds a completed order exactly once under concurrent requests", async () => {
    const user = await createUser();
    const product = await createProduct(2.5, []);
    const orderId = newOrderId();
    const [order] = await db.insert(orders).values({
      orderId,
      userId: user.id,
      productId: product.id,
      productName: product.name,
      quantity: 1,
      totalAmount: 2.5,
      status: "completed",
      email: user.email,
    }).returning();

    await Promise.all(
      Array.from({ length: 8 }, () =>
        creditStorage.refundOrderToCredit({
          orderId: order.id,
          reason: "Approved test refund",
          actorUserId: user.id,
          actorEmail: user.email,
        }),
      ),
    );

    const updatedUser = await db.select().from(users).where(eq(users.id, user.id));
    const refunds = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, `refund:${order.id}`));
    const updatedOrder = await db.select().from(orders).where(eq(orders.id, order.id));
    assert.equal(updatedUser[0].creditBalanceCents, 250);
    assert.equal(refunds.length, 1);
    assert.equal(updatedOrder[0].status, "refunded");
    assert.ok(updatedOrder[0].refundedAt);
  });

  it("retries notification delivery without repeating the balance mutation", async () => {
    const user = await createUser();
    const adjustment = await creditStorage.adjustCredit({
      userId: user.id,
      amountCents: 300,
      reason: "Test adjustment",
      actorUserId: user.id,
      actorEmail: user.email,
      idempotencyKey: `adjustment-${randomUUID()}`,
    });
    const firstClaim = await creditStorage.claimPendingNotifications();
    const claimed = firstClaim.find(item => item.id === adjustment.transaction.id);
    assert.ok(claimed);
    assert.ok(claimed.notificationLeaseId);
    await creditStorage.failNotification(claimed.id, claimed.notificationLeaseId, "Temporary SMTP failure");

    const secondClaim = await creditStorage.claimPendingNotifications();
    const retried = secondClaim.find(item => item.id === adjustment.transaction.id);
    assert.ok(retried);
    assert.ok(retried.notificationLeaseId);
    await creditStorage.completeNotification(retried.id, retried.notificationLeaseId);

    const updatedUser = await db.select().from(users).where(eq(users.id, user.id));
    const ledger = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.id, adjustment.transaction.id));
    assert.equal(updatedUser[0].creditBalanceCents, 300);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].notificationStatus, "sent");
    assert.equal(ledger[0].notificationAttempts, 2);
  });

  it("replays an admin adjustment safely and rejects key reuse with different data", async () => {
    const user = await createUser();
    const idempotencyKey = `adjustment-${randomUUID()}`;
    const input = {
      userId: user.id,
      amountCents: 425,
      reason: "One approved adjustment",
      actorUserId: user.id,
      actorEmail: user.email,
      idempotencyKey,
    };

    await Promise.all(Array.from({ length: 6 }, () => creditStorage.adjustCredit(input)));
    await assert.rejects(
      creditStorage.adjustCredit({ ...input, amountCents: 500 }),
      /different adjustment/,
    );

    const updatedUser = await db.select().from(users).where(eq(users.id, user.id));
    const ledger = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.idempotencyKey, idempotencyKey));
    assert.equal(updatedUser[0].creditBalanceCents, 425);
    assert.equal(ledger.length, 1);
  });

  it("rejects a top-up completion whose signed callback names another payment", async () => {
    const user = await createUser();
    const { topup } = await creditStorage.createTopup({
      userId: user.id,
      userEmail: user.email,
      amountCents: 500,
      payCurrency: "btc",
      idempotencyKey: `topup-create-${randomUUID()}`,
    });
    topupIds.add(topup.id);
    await creditStorage.attachTopupPayment(topup.id, {
      paymentId: `credit-test-payment-${randomUUID()}`,
      gatewayStatus: "waiting",
    });

    await assert.rejects(
      creditStorage.applyTopupGatewayStatus(topup.id, {
        paymentId: "different-payment",
        status: "finished",
        priceAmount: 5,
        priceCurrency: "usd",
        payCurrency: "btc",
      }),
      /identity mismatch/,
    );
    const updatedUser = await db.select().from(users).where(eq(users.id, user.id));
    assert.equal(updatedUser[0].creditBalanceCents, 0);
  });

  it("creates one top-up for concurrent retries and rejects changed retry payloads", async () => {
    const user = await createUser();
    const idempotencyKey = `topup-create-${randomUUID()}`;
    const input = {
      userId: user.id,
      userEmail: user.email,
      amountCents: 700,
      payCurrency: "btc",
      idempotencyKey,
    };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => creditStorage.createTopup(input)),
    );
    results.forEach(result => topupIds.add(result.topup.id));
    assert.equal(new Set(results.map(result => result.topup.id)).size, 1);
    assert.equal(results.filter(result => !result.replayed).length, 1);
    await assert.rejects(
      creditStorage.createTopup({ ...input, amountCents: 800 }),
      /different top-up/,
    );
  });

  it("keeps failed top-ups terminal and reconciles a missed provider refund exactly once", async () => {
    const failedUser = await createUser();
    const { topup: failedTopup } = await creditStorage.createTopup({
      userId: failedUser.id,
      userEmail: failedUser.email,
      amountCents: 500,
      payCurrency: "btc",
      idempotencyKey: `topup-create-${randomUUID()}`,
    });
    topupIds.add(failedTopup.id);
    const failedPaymentId = `credit-test-payment-${randomUUID()}`;
    await creditStorage.attachTopupPayment(failedTopup.id, {
      paymentId: failedPaymentId,
      gatewayStatus: "waiting",
    });
    await creditStorage.applyTopupGatewayStatus(failedTopup.id, {
      paymentId: failedPaymentId,
      status: "expired",
      priceAmount: 5,
      priceCurrency: "usd",
      payCurrency: "btc",
    });
    const lateFinish = await creditStorage.applyTopupGatewayStatus(failedTopup.id, {
      paymentId: failedPaymentId,
      status: "finished",
      priceAmount: 5,
      priceCurrency: "usd",
      payCurrency: "btc",
    });
    assert.equal(lateFinish.topup.status, "expired");
    assert.equal(lateFinish.transaction, undefined);

    const completedUser = await createUser();
    const { topup } = await creditStorage.createTopup({
      userId: completedUser.id,
      userEmail: completedUser.email,
      amountCents: 600,
      payCurrency: "btc",
      idempotencyKey: `topup-create-${randomUUID()}`,
    });
    topupIds.add(topup.id);
    const paymentId = `credit-test-payment-${randomUUID()}`;
    await creditStorage.attachTopupPayment(topup.id, {
      paymentId,
      gatewayStatus: "waiting",
    });
    await creditStorage.applyTopupGatewayStatus(topup.id, {
      paymentId,
      status: "finished",
      priceAmount: 6,
      priceCurrency: "usd",
      payCurrency: "btc",
    });
    await db.update(creditTopups).set({
      lastReconciledAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    }).where(eq(creditTopups.id, topup.id));
    const dueForReconciliation = await creditStorage.getPendingTopups();
    assert.ok(dueForReconciliation.some(candidate => candidate.id === topup.id));
    await Promise.all(Array.from({ length: 4 }, () =>
      creditStorage.applyTopupGatewayStatus(topup.id, {
        paymentId,
        status: "refunded",
        priceAmount: 6,
        priceCurrency: "usd",
        payCurrency: "btc",
      }),
    ));
    const updated = await db.select().from(users).where(eq(users.id, completedUser.id));
    const ledger = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, completedUser.id));
    assert.equal(updated[0].creditBalanceCents, 0);
    assert.deepEqual(ledger.map(tx => tx.amountCents).sort((a, b) => a - b), [-600, 600]);
  });

  it("never deletes an account while a top-up obligation is being created", async () => {
    const user = await createUser();
    const creation = creditStorage.createTopup({
      userId: user.id,
      userEmail: user.email,
      amountCents: 900,
      payCurrency: "btc",
      idempotencyKey: `topup-create-${randomUUID()}`,
    });
    const deletion = creditStorage.deleteUserIfNoCreditRisk(user.id);
    const [creationResult, deletionResult] = await Promise.allSettled([creation, deletion]);

    if (creationResult.status === "fulfilled") {
      topupIds.add(creationResult.value.topup.id);
      assert.equal(deletionResult.status, "rejected");
      const persistedUser = await db.select().from(users).where(eq(users.id, user.id));
      assert.equal(persistedUser.length, 1);
    } else {
      assert.equal(deletionResult.status, "fulfilled");
      const orphanedTopups = await db.select().from(creditTopups)
        .where(eq(creditTopups.userId, user.id));
      assert.equal(orphanedTopups.length, 0);
    }
  });

  it("stops a conflicting backup import before splitting a balance from its ledger", async () => {
    const user = await createUser(125);
    const importedUserId = `imported-${randomUUID()}`;
    const result = await importDatabase("credit-conflict-test", {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      tables: {
        users: {
          rowCount: 1,
          data: [{ ...user, id: importedUserId, creditBalanceCents: 999 }],
        },
        creditTransactions: {
          rowCount: 1,
          data: [{
            id: randomUUID(),
            userId: importedUserId,
            userEmail: user.email,
            type: "topup",
            amountCents: 999,
            balanceAfterCents: 999,
            idempotencyKey: `import-${randomUUID()}`,
          }],
        },
      },
    }, () => undefined);
    const unchanged = await db.select().from(users).where(eq(users.id, user.id));
    assert.equal(result.success, false);
    assert.match(result.message, /conflicts with existing credit history/);
    assert.equal(unchanged[0].creditBalanceCents, 125);
  });
});