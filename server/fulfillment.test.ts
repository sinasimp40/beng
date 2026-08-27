import { after, afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { db, pool } from "./db";
import { InsufficientStockError, storage } from "./storage";
import { orderItems, orders, products } from "@shared/schema";

const fixtureOrderIds = new Set<string>();
const fixtureProductIds = new Set<string>();

function newOrderId(): string {
  const orderId = `fulfillment-test-order-${randomUUID()}`;
  fixtureOrderIds.add(orderId);
  return orderId;
}

async function createProduct(stockItems: string[]): Promise<string> {
  const id = `fulfillment-test-product-${randomUUID()}`;
  fixtureProductIds.add(id);
  await db.insert(products).values({
    id,
    name: `Test product ${id.slice(-8)}`,
    description: "A product used by fulfillment integration tests",
    price: 1,
    category: "TEST",
    stock: stockItems.length,
    stockList: stockItems.join("\n"),
    enabled: 1,
    isHot: 0,
    countries: [],
  });
  return id;
}

async function createOrder(params: {
  orderId?: string;
  productId: string;
  productName?: string;
  quantity: number;
  status?: string;
  sentStock?: string | null;
  email?: string | null;
}): Promise<string> {
  const orderId = params.orderId || newOrderId();
  if (params.orderId) fixtureOrderIds.add(params.orderId);

  await db.insert(orders).values({
    orderId,
    productId: params.productId,
    productName: params.productName || "Test product",
    quantity: params.quantity,
    totalAmount: params.quantity,
    status: params.status || "pending",
    sentStock: params.sentStock,
    email: params.email === undefined ? "fulfillment-test@example.com" : params.email,
    createdAt: new Date().toISOString(),
  });
  return orderId;
}

async function addOrderItem(params: {
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
}): Promise<void> {
  await db.insert(orderItems).values({
    orderId: params.orderId,
    productId: params.productId,
    productName: params.productName,
    quantity: params.quantity,
    unitPrice: 1,
  });
}

beforeEach(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for fulfillment integration tests");
  }
});

afterEach(async () => {
  const orderIds = Array.from(fixtureOrderIds);
  const productIds = Array.from(fixtureProductIds);

  if (orderIds.length > 0) {
    await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
    await db.delete(orders).where(inArray(orders.orderId, orderIds));
  }
  if (productIds.length > 0) {
    await db.delete(products).where(inArray(products.id, productIds));
  }

  fixtureOrderIds.clear();
  fixtureProductIds.clear();
});

after(async () => {
  await pool.end();
});

describe("digital fulfillment integrity", () => {
  it("does not consume credentials twice for duplicate fulfillment attempts", async () => {
    const productId = await createProduct(["duplicate-a", "duplicate-b"]);
    const orderId = await createOrder({
      productId,
      productName: "Duplicate attempt product",
      quantity: 2,
    });

    const results = await Promise.all([
      storage.claimOrderStock(orderId),
      storage.claimOrderStock(orderId),
    ]);

    assert.ok(results[0]);
    assert.ok(results[1]);
    assert.equal(results[0].order.sentStock, results[1].order.sentStock);
    assert.deepEqual(
      [results[0].productIds, results[1].productIds].sort((a, b) => a.length - b.length),
      [[], [productId]],
    );

    const remaining = await storage.getProduct(productId);
    assert.equal(remaining?.stock, 0);
    assert.equal(remaining?.stockList, "");
  });

  it("assigns each credential once when orders claim the same stock concurrently", async () => {
    const productId = await createProduct(["credential-a", "credential-b"]);
    const firstOrderId = await createOrder({
      productId,
      productName: "Shared stock product",
      quantity: 1,
    });
    const secondOrderId = await createOrder({
      productId,
      productName: "Shared stock product",
      quantity: 1,
    });

    const results = await Promise.all([
      storage.claimOrderStock(firstOrderId),
      storage.claimOrderStock(secondOrderId),
    ]);

    assert.ok(results[0]);
    assert.ok(results[1]);
    const delivered = results.map(result => result!.order.sentStock || "");
    assert.notEqual(delivered[0], delivered[1]);
    assert.equal(new Set(delivered).size, 2);
    assert.ok(delivered[0].includes("credential-a") || delivered[1].includes("credential-a"));
    assert.ok(delivered[0].includes("credential-b") || delivered[1].includes("credential-b"));

    const remaining = await storage.getProduct(productId);
    assert.equal(remaining?.stock, 0);
    assert.equal(remaining?.stockList, "");
  });

  it("does not partially claim a cart when a later line is short on stock", async () => {
    const firstProductId = await createProduct(["first-credential"]);
    const secondProductId = await createProduct(["second-credential"]);
    const orderId = await createOrder({
      productId: firstProductId,
      productName: "Multi-product order",
      quantity: 3,
    });
    await addOrderItem({
      orderId,
      productId: firstProductId,
      productName: "First product",
      quantity: 1,
    });
    await addOrderItem({
      orderId,
      productId: secondProductId,
      productName: "Second product",
      quantity: 2,
    });

    await assert.rejects(
      storage.claimOrderStock(orderId),
      (error: unknown) =>
        error instanceof InsufficientStockError &&
        error.productName === "Second product" &&
        error.available === 1 &&
        error.requested === 2,
    );

    const firstProduct = await storage.getProduct(firstProductId);
    const secondProduct = await storage.getProduct(secondProductId);
    assert.equal(firstProduct?.stock, 1);
    assert.equal(firstProduct?.stockList, "first-credential");
    assert.equal(secondProduct?.stock, 1);
    assert.equal(secondProduct?.stockList, "second-credential");

    const order = await storage.getOrderByOrderId(orderId);
    assert.equal(order?.sentStock, null);
    assert.equal(order?.status, "pending");
    const items = await storage.getOrderItemsByOrderId(orderId);
    assert.deepEqual(items.map(item => item.fulfillmentStatus), ["pending", "pending"]);
    assert.deepEqual(items.map(item => item.fulfilledStock), [null, null]);
  });

  it("gives only one concurrent worker the delivery lease", async () => {
    const productId = await createProduct([]);
    const orderId = await createOrder({
      productId,
      quantity: 1,
      status: "fulfilling",
      sentStock: "leased-credential",
    });

    const claims = await Promise.all(
      Array.from({ length: 8 }, () => storage.claimOrderDelivery(orderId)),
    );

    assert.equal(claims.filter(Boolean).length, 1);
    const order = await storage.getOrderByOrderId(orderId);
    assert.equal(order?.deliveryStatus, "sending");
    assert.ok(order?.deliveryAttemptedAt);
  });

  it("returns a failed delivery to the retryable state", async () => {
    const productId = await createProduct([]);
    const orderId = await createOrder({
      productId,
      quantity: 1,
      status: "fulfilling",
      sentStock: "retryable-credential",
    });

    assert.ok(await storage.claimOrderDelivery(orderId));
    const failed = await storage.failOrderDelivery(orderId);
    assert.equal(failed?.status, "fulfilling");
    assert.equal(failed?.deliveryStatus, "failed");

    const retryClaim = await storage.claimOrderDelivery(orderId);
    assert.ok(retryClaim);
    assert.equal(retryClaim.deliveryStatus, "sending");
  });

  it("fulfills a legacy order without order_items rows", async () => {
    const productId = await createProduct(["legacy-a", "legacy-b"]);
    const orderId = await createOrder({
      productId,
      productName: "Legacy product",
      quantity: 2,
      email: null,
    });

    const stockClaim = await storage.claimOrderStock(orderId);
    assert.ok(stockClaim);
    assert.deepEqual(stockClaim.productIds, [productId]);
    assert.ok(stockClaim.order.sentStock?.includes("legacy-a"));
    assert.ok(stockClaim.order.sentStock?.includes("legacy-b"));

    const items = await storage.getOrderItemsByOrderId(orderId);
    assert.equal(items.length, 0);
    const remaining = await storage.getProduct(productId);
    assert.equal(remaining?.stock, 0);
    assert.equal(remaining?.stockList, "");

    assert.ok(await storage.claimOrderDelivery(orderId));
    const completed = await storage.completeOrderDelivery(orderId);
    assert.equal(completed?.status, "completed");
    assert.equal(completed?.deliveryStatus, "sent");
  });
});