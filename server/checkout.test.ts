import { after, afterEach, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { registerRoutes, stopOrderPolling } from "./routes";
import { storage } from "./storage";
import { nowPaymentsService, type CreatePaymentRequest, type PaymentResponse } from "./nowpayments";
import { paymentLimiter } from "./security";
import { PAYMENT_CURRENCIES } from "@shared/payment-currencies";
import { orderItems, orders, products, users } from "@shared/schema";

const fixtureIds: string[] = [];
const fixtureOrderIds: string[] = [];
const prices = [0.01, 0.29, 0.99];
const fixtures = new Map<number, string>();
let server: Server;
let baseUrl: string;
let token: string;
let userId: string;
let rejectPayment = false;
const providerRequests: CreatePaymentRequest[] = [];

before(async () => {
  // No merchant secrets, email or Telegram calls are used by this isolated server.
  mock.method(storage, "getSetting", async () => undefined);
  mock.method(nowPaymentsService, "isConfigured", () => true);
  mock.method(nowPaymentsService, "getMinimumPaymentAmount", async () => ({
    currencyTo: "btc", minimumCryptoAmount: 1, minimumFiatAmount: 100, fiatEquivalent: "usd",
  }));
  mock.method(nowPaymentsService, "createPayment", async (request: CreatePaymentRequest): Promise<PaymentResponse> => {
    providerRequests.push(request);
    if (rejectPayment) throw new Error("The amount is below the provider minimum for this network");
    return {
      ...request,
      payment_id: `mock-${randomUUID()}`,
      payment_status: "waiting",
      pay_address: "test-only-not-a-real-wallet",
      pay_amount: 0.001,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  const app = express();
  app.use(express.json());
  server = createServer(app);
  await registerRoutes(server, app);
  stopOrderPolling();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
  for (const price of prices) {
    const id = `checkout-test-${randomUUID()}`;
    fixtureIds.push(id);
    fixtures.set(price, id);
    await db.insert(products).values({
      id, name: `Cent checkout fixture ${price}`, description: "Isolated test",
      price, category: "TEST", stock: 5, stockList: "A\nB\nC\nD\nE", enabled: 1,
    });
  }
  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `checkout-${randomUUID()}@example.com`, password: randomUUID(), recaptchaToken: "" }),
  });
  assert.equal(registration.status, 201);
  const account = await registration.json();
  token = account.token;
  userId = account.user.id;
});

afterEach(() => {
  paymentLimiter.resetKey("127.0.0.1");
  rejectPayment = false;
  providerRequests.length = 0;
});

after(async () => {
  stopOrderPolling();
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (fixtureOrderIds.length) {
    await db.delete(orderItems).where(inArray(orderItems.orderId, fixtureOrderIds));
    await db.delete(orders).where(inArray(orders.orderId, fixtureOrderIds));
  }
  if (fixtureIds.length) await db.delete(products).where(inArray(products.id, fixtureIds));
  if (userId) await db.delete(users).where(eq(users.id, userId));
  mock.restoreAll();
  await pool.end();
});

async function checkout(currency: string, price = 0.01, extra: Record<string, unknown> = {}) {
  const orderId = `checkout-test-order-${randomUUID()}`;
  fixtureOrderIds.push(orderId);
  const response = await fetch(`${baseUrl}/api/payments/create`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currency, orderId, email: "checkout-test@example.com",
      productId: fixtures.get(price), quantity: 1, amount: 999, ...extra,
    }),
  });
  return { response, body: await response.json(), orderId };
}

describe("cent-priced product checkout", () => {
  for (const currency of PAYMENT_CURRENCIES) {
    it(`creates cent-priced ${currency.name} orders without an app-only $1 floor`, async () => {
      for (const price of prices) {
        const { response, body, orderId } = await checkout(currency.id, price);
        assert.equal(response.status, 200, JSON.stringify(body));
        assert.equal(body.price_amount, price);
        assert.equal(body.pay_currency, currency.id);
        const sent = providerRequests.at(-1)!;
        assert.equal(sent.price_amount, price);
        assert.equal(sent.price_currency, "usd");
        assert.equal(sent.pay_currency, currency.id);
        const stored = await storage.getOrderByOrderId(orderId);
        assert.equal(Math.round(stored!.totalAmount * 100), Math.round(price * 100));
        assert.equal(stored!.paymentId, body.payment_id);
        assert.equal(stored!.payCurrency, currency.id);
        assert.equal((await storage.getProduct(fixtures.get(price)!))!.stock, 5);
      }
    });
  }

  it("calculates a mixed cart in cents from database prices, ignoring a tampered amount", async () => {
    const { response, body } = await checkout("bnbbsc", 0.01, {
      amount: 0.01,
      items: [{ productId: fixtures.get(0.29), quantity: 3 }, { productId: fixtures.get(0.01), quantity: 3 }],
    });
    assert.equal(response.status, 200);
    assert.equal(body.price_amount, 0.90);
    assert.equal(providerRequests.at(-1)!.price_amount, 0.90);
  });

  it("returns the real provider minimum error without claiming payment succeeded or taking stock", async () => {
    rejectPayment = true;
    const { response, body, orderId } = await checkout("usdttrc20");
    assert.equal(response.status, 500);
    assert.match(body.error, /below the provider minimum/);
    assert.equal((await storage.getOrderByOrderId(orderId))!.status, "failed");
    assert.equal((await storage.getProduct(fixtures.get(0.01)!))!.stock, 5);
  });

  it("rejects insufficient stock before contacting the provider", async () => {
    const { response } = await checkout("eth", 0.01, { quantity: 6 });
    assert.equal(response.status, 400);
    assert.equal(providerRequests.length, 0);
  });

  it("keeps the $1 account top-up floor separate from cent-priced products", async () => {
    const response = await fetch(`${baseUrl}/api/credit/topups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Idempotency-Key": randomUUID() },
      body: JSON.stringify({ amountCents: 99, payCurrency: "usdtbsc" }),
    });
    assert.equal(response.status, 400);
    assert.equal(providerRequests.length, 0);
  });
});
