import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { createServer, type Server } from "node:http";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { creditStorage, InsufficientCreditError } from "./creditStorage";
import { hashPassword } from "./auth";
import { registerRoutes, stopOrderPolling } from "./routes";
import { importDatabase } from "./services/databaseBackupService";
import {
  creditTopups,
  creditTelegramEvents,
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
const routeTestPassword = "route-test-password";
let routeServer: Server | undefined;
let routeBaseUrl = "";

before(async () => {
  const app = express();
  app.use(express.json());
  routeServer = createServer(app);
  await registerRoutes(routeServer, app);
  await new Promise<void>((resolve, reject) => {
    routeServer!.once("error", reject);
    routeServer!.listen(0, "127.0.0.1", () => {
      const address = routeServer!.address();
      if (!address || typeof address === "string") {
        reject(new Error("Route test server did not expose an address"));
        return;
      }
      routeBaseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

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
    await db.delete(creditTelegramEvents).where(inArray(creditTelegramEvents.userEmail, Array.from(userIds).map(id => `${id}@example.com`)));
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
  stopOrderPolling();
  if (routeServer?.listening) {
    await new Promise<void>((resolve, reject) => {
      routeServer!.close(error => error ? reject(error) : resolve());
    });
  }
  await pool.end();
});

async function httpRequest(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${routeBaseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

async function createRouteUser(role: "user" | "admin") {
  const user = await createUser();
  await db.update(users)
    .set({ password: await hashPassword(routeTestPassword), role })
    .where(eq(users.id, user.id));
  return user;
}

async function loginRouteUser(user: { email: string }) {
  const response = await httpRequest("/api/auth/login", {
    method: "POST",
    body: { email: user.email, password: routeTestPassword },
  });
  assert.equal(response.status, 200);
  assert.equal(typeof response.body?.token, "string");
  return response.body.token as string;
}

async function createExhaustedCreditEmail() {
  const user = await createUser();
  const adjustment = await creditStorage.adjustCredit({
    userId: user.id,
    amountCents: 450,
    reason: "Route test adjustment",
    actorUserId: user.id,
    actorEmail: user.email,
    idempotencyKey: `adjustment-${randomUUID()}`,
  });

  for (let attempt = 1; attempt <= 5; attempt++) {
    const claim = (await creditStorage.claimPendingNotifications())
      .find(item => item.id === adjustment.transaction.id);
    assert.ok(claim?.notificationLeaseId);
    await creditStorage.failNotification(
      claim.id,
      claim.notificationLeaseId,
      `Route test SMTP failure ${attempt}`,
    );
  }

  return { user, transactionId: adjustment.transaction.id };
}

describe("account credit integrity", () => {
  it("blocks non-admins from listing or retrying exhausted credit emails", async () => {
    const { transactionId } = await createExhaustedCreditEmail();
    const regularUser = await createRouteUser("user");
    const regularToken = await loginRouteUser(regularUser);

    const unauthenticatedList = await httpRequest("/api/admin/credit-notifications");
    const unauthenticatedRetry = await httpRequest(
      `/api/admin/credit-notifications/${transactionId}/retry`,
      { method: "POST" },
    );
    assert.equal(unauthenticatedList.status, 401);
    assert.equal(unauthenticatedRetry.status, 401);

    const regularList = await httpRequest("/api/admin/credit-notifications", {
      token: regularToken,
    });
    const regularRetry = await httpRequest(
      `/api/admin/credit-notifications/${transactionId}/retry`,
      { method: "POST", token: regularToken },
    );
    assert.equal(regularList.status, 403);
    assert.equal(regularRetry.status, 403);

    const [unchanged] = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.id, transactionId));
    const [user] = await db.select().from(users).where(eq(users.id, regularUser.id));
    assert.equal(unchanged.notificationStatus, "exhausted");
    assert.equal(unchanged.notificationAttempts, 5);
    assert.equal(user.creditBalanceCents, 0);
  });

  it("lists stale final email leases and allows exactly one concurrent admin retry", async () => {
    const { user, transactionId } = await createExhaustedCreditEmail();
    await db.update(creditTransactions).set({
      notificationStatus: "sending",
      notificationAttempts: 5,
      notificationLeaseId: randomUUID(),
      notificationAttemptedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      notificationLastError: "SMTP request timed out",
    }).where(eq(creditTransactions.id, transactionId));

    const adminUser = await createRouteUser("admin");
    const adminToken = await loginRouteUser(adminUser);
    const listed = await httpRequest("/api/admin/credit-notifications", {
      token: adminToken,
    });
    assert.equal(listed.status, 200);
    const listedTransaction = listed.body.find(
      (transaction: { id: string }) => transaction.id === transactionId,
    );
    assert.equal(listedTransaction?.notificationStatus, "exhausted");
    assert.equal(listedTransaction?.notificationAttempts, 5);
    assert.equal(
      listedTransaction?.notificationLastError,
      "Email delivery attempt timed out before completion",
    );

    const retries = await Promise.all([
      httpRequest(`/api/admin/credit-notifications/${transactionId}/retry`, {
        method: "POST",
        token: adminToken,
      }),
      httpRequest(`/api/admin/credit-notifications/${transactionId}/retry`, {
        method: "POST",
        token: adminToken,
      }),
    ]);
    assert.deepEqual(retries.map(response => response.status).sort(), [200, 409]);
    const successfulRetry = retries.find(response => response.status === 200);
    assert.equal(successfulRetry?.body.id, transactionId);
    assert.equal(successfulRetry?.body.notificationStatus, "pending");
    assert.equal(successfulRetry?.body.notificationAttempts, 0);

    const [updatedTransaction] = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.id, transactionId));
    const [unchangedUser] = await db.select().from(users).where(eq(users.id, user.id));
    const ledger = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, user.id));
    assert.equal(unchangedUser.creditBalanceCents, 450);
    assert.equal(ledger.length, 1);
    assert.equal(updatedTransaction.amountCents, 450);
    assert.equal(updatedTransaction.type, "admin_credit");
  });

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

  it("queues each Telegram top-up status once across duplicate gateway observations", async () => {
    const user = await createUser();
    const { topup } = await creditStorage.createTopup({
      userId: user.id,
      userEmail: user.email,
      amountCents: 900,
      payCurrency: "eth",
      idempotencyKey: `topup-create-${randomUUID()}`,
    });
    topupIds.add(topup.id);
    const paymentId = `credit-test-payment-${randomUUID()}`;
    await creditStorage.attachTopupPayment(topup.id, {
      paymentId,
      gatewayStatus: "waiting",
    });

    await Promise.all(Array.from({ length: 5 }, () =>
      creditStorage.applyTopupGatewayStatus(topup.id, {
        paymentId,
        status: "confirming",
        priceAmount: 9,
        priceCurrency: "usd",
        payCurrency: "eth",
      }),
    ));
    await Promise.all(Array.from({ length: 5 }, () =>
      creditStorage.applyTopupGatewayStatus(topup.id, {
        paymentId,
        status: "finished",
        priceAmount: 9,
        priceCurrency: "usd",
        payCurrency: "eth",
      }),
    ));

    const events = await db.select().from(creditTelegramEvents)
      .where(eq(creditTelegramEvents.topupId, topup.id));
    assert.deepEqual(
      events.map(event => event.eventStatus).sort(),
      ["completed", "confirming", "pending"],
    );
  });

  it("canonicalizes provider status before crediting and rejects unknown states", async () => {
    const user = await createUser();
    const { topup } = await creditStorage.createTopup({
      userId: user.id,
      userEmail: user.email,
      amountCents: 400,
      payCurrency: "xrp",
      idempotencyKey: `topup-create-${randomUUID()}`,
    });
    topupIds.add(topup.id);
    const paymentId = `credit-test-payment-${randomUUID()}`;
    await creditStorage.attachTopupPayment(topup.id, { paymentId, gatewayStatus: "waiting" });

    await assert.rejects(
      creditStorage.applyTopupGatewayStatus(topup.id, {
        paymentId,
        status: "unexpected_provider_state",
        priceAmount: 4,
        priceCurrency: "usd",
        payCurrency: "xrp",
      }),
      /Unsupported top-up gateway status/,
    );
    await creditStorage.applyTopupGatewayStatus(topup.id, {
      paymentId,
      status: "FINISHED",
      priceAmount: 4,
      priceCurrency: "usd",
      payCurrency: "xrp",
    });

    const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
    const [updatedTopup] = await db.select().from(creditTopups).where(eq(creditTopups.id, topup.id));
    assert.equal(updatedUser.creditBalanceCents, 400);
    assert.equal(updatedTopup.status, "completed");
    assert.equal(updatedTopup.gatewayStatus, "finished");
  });

  it("retries Telegram top-up delivery with lease ownership", async () => {
    const user = await createUser();
    const { topup } = await creditStorage.createTopup({
      userId: user.id,
      userEmail: user.email,
      amountCents: 700,
      payCurrency: "ltc",
      idempotencyKey: `topup-create-${randomUUID()}`,
    });
    topupIds.add(topup.id);
    await creditStorage.attachTopupPayment(topup.id, {
      paymentId: `credit-test-payment-${randomUUID()}`,
      gatewayStatus: "waiting",
    });

    const firstClaim = (await creditStorage.claimPendingTelegramEvents())
      .find(event => event.topupId === topup.id);
    assert.ok(firstClaim?.deliveryLeaseId);
    await creditStorage.failTelegramEvent(
      firstClaim.id,
      firstClaim.deliveryLeaseId,
      "Temporary Telegram failure",
    );
    const secondClaim = (await creditStorage.claimPendingTelegramEvents())
      .find(event => event.topupId === topup.id);
    assert.ok(secondClaim?.deliveryLeaseId);
    assert.notEqual(secondClaim.deliveryLeaseId, firstClaim.deliveryLeaseId);
    await creditStorage.completeTelegramEvent(secondClaim.id, secondClaim.deliveryLeaseId);

    const [event] = await db.select().from(creditTelegramEvents)
      .where(eq(creditTelegramEvents.id, secondClaim.id));
    assert.equal(event.deliveryStatus, "sent");
    assert.equal(event.deliveryAttempts, 2);
    assert.ok(event.sentAt);
  });

  it("marks exhausted Telegram alerts and atomically resets one retry without changing credit", async () => {
    const user = await createUser();
    const { topup } = await creditStorage.createTopup({
      userId: user.id,
      userEmail: user.email,
      amountCents: 900,
      payCurrency: "btc",
      idempotencyKey: `topup-create-${randomUUID()}`,
    });
    topupIds.add(topup.id);
    await creditStorage.attachTopupPayment(topup.id, {
      paymentId: `credit-test-payment-${randomUUID()}`,
      gatewayStatus: "waiting",
    });

    for (let attempt = 1; attempt <= 5; attempt++) {
      const [claim] = (await creditStorage.claimPendingTelegramEvents())
        .filter(event => event.topupId === topup.id);
      assert.ok(claim?.deliveryLeaseId);
      await creditStorage.failTelegramEvent(
        claim.id,
        claim.deliveryLeaseId,
        `Telegram failure ${attempt}`,
      );
    }

    const [exhausted] = await db.select().from(creditTelegramEvents)
      .where(eq(creditTelegramEvents.id, (await creditStorage.getExhaustedTelegramEvents())
        .find(event => event.topupId === topup.id)!.id));
    assert.equal(exhausted.deliveryStatus, "exhausted");
    assert.equal(exhausted.deliveryAttempts, 5);
    assert.equal(exhausted.deliveryLastError, "Telegram failure 5");

    const retries = await Promise.all([
      creditStorage.retryExhaustedTelegramEvent(exhausted.id),
      creditStorage.retryExhaustedTelegramEvent(exhausted.id),
    ]);
    assert.equal(retries.filter(Boolean).length, 1);

    const [reset] = await db.select().from(creditTelegramEvents)
      .where(eq(creditTelegramEvents.id, exhausted.id));
    const [unchangedUser] = await db.select().from(users).where(eq(users.id, user.id));
    const ledger = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.userId, user.id));
    assert.equal(reset.deliveryStatus, "pending");
    assert.equal(reset.deliveryAttempts, 0);
    assert.equal(reset.deliveryLastError, null);
    assert.equal(unchangedUser.creditBalanceCents, 0);
    assert.equal(ledger.length, 0);

    await db.update(creditTelegramEvents).set({
      deliveryStatus: "pending",
      deliveryAttempts: 4,
    }).where(eq(creditTelegramEvents.id, exhausted.id));
    const staleFinalClaim = (await creditStorage.claimPendingTelegramEvents())
      .find(event => event.id === exhausted.id);
    assert.ok(staleFinalClaim?.deliveryLeaseId);
    await db.update(creditTelegramEvents).set({
      deliveryAttemptedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    }).where(eq(creditTelegramEvents.id, exhausted.id));

    const staleExhausted = (await creditStorage.getExhaustedTelegramEvents())
      .find(event => event.id === exhausted.id);
    assert.equal(staleExhausted?.deliveryStatus, "exhausted");
    assert.equal(
      staleExhausted?.deliveryLastError,
      "Telegram delivery attempt timed out before completion",
    );
    assert.ok(await creditStorage.retryExhaustedTelegramEvent(exhausted.id));
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

  it("exposes and safely recovers exhausted credit emails without changing the ledger", async () => {
    const user = await createUser();
    const adjustment = await creditStorage.adjustCredit({
      userId: user.id,
      amountCents: 450,
      reason: "Exhausted email test",
      actorUserId: user.id,
      actorEmail: user.email,
      idempotencyKey: `adjustment-${randomUUID()}`,
    });

    for (let attempt = 1; attempt <= 5; attempt++) {
      const claim = (await creditStorage.claimPendingNotifications())
        .find(item => item.id === adjustment.transaction.id);
      assert.ok(claim?.notificationLeaseId);
      if (attempt === 5) {
        assert.equal(await creditStorage.retryExhaustedNotification(claim.id), undefined);
      }
      await creditStorage.failNotification(
        claim.id,
        claim.notificationLeaseId,
        `SMTP failure ${attempt}`,
      );
    }

    const [exhausted] = await creditStorage.getExhaustedNotifications();
    assert.equal(exhausted.id, adjustment.transaction.id);
    assert.equal(exhausted.notificationStatus, "exhausted");
    assert.equal(exhausted.notificationAttempts, 5);
    assert.equal(exhausted.notificationLastError, "SMTP failure 5");

    const retries = await Promise.all([
      creditStorage.retryExhaustedNotification(exhausted.id),
      creditStorage.retryExhaustedNotification(exhausted.id),
    ]);
    assert.equal(retries.filter(Boolean).length, 1);

    const [reset] = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.id, adjustment.transaction.id));
    const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
    assert.equal(reset.notificationStatus, "pending");
    assert.equal(reset.notificationAttempts, 0);
    assert.equal(reset.notificationLastError, null);
    assert.equal(updatedUser.creditBalanceCents, 450);

    for (let attempt = 1; attempt <= 4; attempt++) {
      const claim = (await creditStorage.claimPendingNotifications())
        .find(item => item.id === adjustment.transaction.id);
      assert.ok(claim?.notificationLeaseId);
      await creditStorage.failNotification(claim.id, claim.notificationLeaseId, "Retry failure");
    }
    const finalClaim = (await creditStorage.claimPendingNotifications())
      .find(item => item.id === adjustment.transaction.id);
    assert.ok(finalClaim?.notificationLeaseId);
    await db.update(creditTransactions).set({
      notificationAttemptedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    }).where(eq(creditTransactions.id, adjustment.transaction.id));

    const stale = (await creditStorage.getExhaustedNotifications())
      .find(item => item.id === adjustment.transaction.id);
    assert.equal(stale?.notificationStatus, "exhausted");
    assert.equal(
      stale?.notificationLastError,
      "Email delivery attempt timed out before completion",
    );
    assert.ok(await creditStorage.retryExhaustedNotification(adjustment.transaction.id));

    const ledger = await db.select().from(creditTransactions)
      .where(eq(creditTransactions.id, adjustment.transaction.id));
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0].amountCents, 450);
    assert.equal(ledger[0].notificationAttempts, 0);
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