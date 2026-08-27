import {
  type User,
  type InsertUser,
  type Product,
  type InsertProduct,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type EmailTemplate,
  type InsertEmailTemplate,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type Review,
  type InsertReview,
  type Statistics,
  type SafeUser,
  users,
  products,
  orders,
  orderItems,
  emailTemplates,
  settings,
  passwordResetTokens,
  reviews,
} from "@shared/schema";
import { db } from "./db";
import { and, eq, desc, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getOrdersByEmail(email: string): Promise<Order[]>;
  deleteOrdersByEmail(email: string): Promise<number>;

  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Orders
  getAllOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByOrderId(orderId: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderWithItems(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  attachPaymentToOrder(orderId: string, payment: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrderByOrderId(orderId: string, order: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;
  getOrderItemsByOrderId(orderId: string): Promise<OrderItem[]>;
  deleteOrderItemsByOrderIds(orderIds: string[]): Promise<void>;
  claimOrderStock(orderId: string): Promise<{ order: Order; productIds: string[] } | null>;
  claimOrderDelivery(orderId: string): Promise<Order | undefined>;
  failOrderDelivery(orderId: string): Promise<Order | undefined>;
  completeOrderDelivery(orderId: string): Promise<Order | undefined>;

  // Statistics
  getStatistics(): Promise<Statistics>;

  // Email Templates
  getAllEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateByName(name: string): Promise<EmailTemplate | undefined>;
  getDefaultEmailTemplate(): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: string): Promise<boolean>;

  // Settings
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
  getAllSettings(): Promise<Record<string, string>>;

  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;

  // Reviews
  getAllReviews(): Promise<Review[]>;
  getReviewsPaginated(page: number, limit: number): Promise<{ reviews: Review[]; total: number }>;
  getReview(id: string): Promise<Review | undefined>;
  getReviewByOrderId(orderId: string): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, review: Partial<InsertReview>): Promise<Review | undefined>;
  deleteReview(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.email, email)).orderBy(desc(orders.createdAt));
  }

  async deleteOrdersByEmail(email: string): Promise<number> {
    const existingOrders = await this.getOrdersByEmail(email);
    await this.deleteOrderItemsByOrderIds(existingOrders.map(order => order.orderId));
    const result = await db.delete(orders).where(eq(orders.email, email)).returning();
    return result.length;
  }

  // Products
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return product || undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  // Orders
  async getAllOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByOrderId(orderId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderId, orderId));
    return order || undefined;
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    return order;
  }

  async createOrderWithItems(insertOrder: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values(insertOrder).returning();
      if (items.length > 0) {
        await tx.insert(orderItems).values(items);
      }
      return order;
    });
  }

  async attachPaymentToOrder(orderId: string, payment: Partial<InsertOrder>): Promise<Order | undefined> {
    const [pendingOrder] = await db.update(orders).set({
      ...payment,
      status: "pending",
    }).where(and(eq(orders.orderId, orderId), eq(orders.status, "creating"))).returning();
    if (pendingOrder) return pendingOrder;

    const [existingOrder] = await db.update(orders).set(payment)
      .where(eq(orders.orderId, orderId))
      .returning();
    return existingOrder || undefined;
  }

  async updateOrder(id: string, updates: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return order || undefined;
  }

  async updateOrderByOrderId(orderId: string, updates: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db.update(orders).set(updates).where(eq(orders.orderId, orderId)).returning();
    return order || undefined;
  }

  async deleteOrder(id: string): Promise<boolean> {
    const order = await this.getOrder(id);
    const result = await db.delete(orders).where(eq(orders.id, id)).returning();
    if (order) {
      await this.deleteOrderItemsByOrderIds([order.orderId]);
    }
    return result.length > 0;
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const [item] = await db.insert(orderItems).values(insertOrderItem).returning();
    return item;
  }

  async getOrderItemsByOrderId(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async deleteOrderItemsByOrderIds(orderIds: string[]): Promise<void> {
    if (orderIds.length === 0) return;
    await db.delete(orderItems).where(inArray(orderItems.orderId, orderIds));
  }

  async claimOrderStock(orderId: string): Promise<{ order: Order; productIds: string[] } | null> {
    return await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.orderId, orderId))
        .for("update");
      if (!order) return null;
      if (order.sentStock) return { order, productIds: [] };

      const savedItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const lines = savedItems.length > 0
        ? savedItems
        : [{
            id: "",
            orderId,
            productId: order.productId,
            productName: order.productName || "Product",
            quantity: order.quantity,
            unitPrice: order.totalAmount / Math.max(1, order.quantity),
            fulfillmentStatus: "pending",
            fulfilledStock: null,
          }];

      const productIds = Array.from(new Set(lines.map(line => line.productId))).sort();
      const lockedProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id, productIds))
        .orderBy(products.id)
        .for("update");
      const productsById = new Map(lockedProducts.map(product => [product.id, product]));
      const deliveryByProduct = new Map<string, string[]>();

      for (const line of lines) {
        const product = productsById.get(line.productId);
        const available = product?.stockList?.split("\n").filter(item => item.trim() !== "") || [];
        const alreadyClaimed = deliveryByProduct.get(line.productId)?.length || 0;
        if (!product || available.length - alreadyClaimed < line.quantity) {
          throw new InsufficientStockError(line.productName, Math.max(0, available.length - alreadyClaimed), line.quantity);
        }
        deliveryByProduct.set(line.productId, [
          ...(deliveryByProduct.get(line.productId) || []),
          ...available.slice(alreadyClaimed, alreadyClaimed + line.quantity),
        ]);
      }

      for (const productId of productIds) {
        const product = productsById.get(productId)!;
        const available = product.stockList?.split("\n").filter(item => item.trim() !== "") || [];
        const claimed = deliveryByProduct.get(productId) || [];
        const remaining = available.slice(claimed.length);
        await tx.update(products).set({
          stockList: remaining.join("\n"),
          stock: remaining.length,
        }).where(eq(products.id, productId));
      }

      const deliveredSections: string[] = [];
      const productOffsets = new Map<string, number>();
      for (const line of lines) {
        const offset = productOffsets.get(line.productId) || 0;
        const delivered = (deliveryByProduct.get(line.productId) || []).slice(offset, offset + line.quantity);
        productOffsets.set(line.productId, offset + line.quantity);
        deliveredSections.push(`${line.productName} (x${delivered.length})\n${delivered.join("\n")}`);
        if (line.id) {
          await tx.update(orderItems).set({
            fulfillmentStatus: "claimed",
            fulfilledStock: delivered.join("\n"),
          }).where(eq(orderItems.id, line.id));
        }
      }

      const sentStock = deliveredSections.join("\n\n");
      const [claimedOrder] = await tx.update(orders).set({
        status: "fulfilling",
        sentStock,
        deliveryStatus: "pending",
        deliveryAttemptedAt: null,
      }).where(eq(orders.orderId, orderId)).returning();
      return { order: claimedOrder, productIds };
    });
  }

  async claimOrderDelivery(orderId: string): Promise<Order | undefined> {
    const [order] = await db.update(orders).set({
      deliveryStatus: "sending",
      deliveryAttemptedAt: new Date().toISOString(),
    }).where(and(
      eq(orders.orderId, orderId),
      eq(orders.status, "fulfilling"),
      inArray(orders.deliveryStatus, ["pending", "failed"]),
    )).returning();
    return order || undefined;
  }

  async failOrderDelivery(orderId: string): Promise<Order | undefined> {
    const [order] = await db.update(orders).set({
      status: "fulfilling",
      deliveryStatus: "failed",
    }).where(and(
      eq(orders.orderId, orderId),
      eq(orders.deliveryStatus, "sending"),
    )).returning();
    return order || undefined;
  }

  async completeOrderDelivery(orderId: string): Promise<Order | undefined> {
    const [order] = await db.update(orders).set({
      status: "completed",
      deliveryStatus: "sent",
    }).where(eq(orders.orderId, orderId)).returning();
    return order || undefined;
  }

  // Statistics
  async getStatistics(): Promise<Statistics> {
    const completedOrders = await db.select().from(orders).where(eq(orders.status, "completed"));
    
    const productsSold = completedOrders.reduce((sum, order) => sum + order.quantity, 0);
    const uniqueEmails = new Set(completedOrders.filter(o => o.email).map(o => o.email));

    return {
      productsSold,
      customers: uniqueEmails.size,
      averageRating: 5.0,
    };
  }

  // Email Templates
  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates);
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template || undefined;
  }

  async getEmailTemplateByName(name: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.name, name));
    return template || undefined;
  }

  async getDefaultEmailTemplate(): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.isDefault, 1));
    return template || undefined;
  }

  async createEmailTemplate(insertTemplate: InsertEmailTemplate): Promise<EmailTemplate> {
    const [template] = await db.insert(emailTemplates).values(insertTemplate).returning();
    return template;
  }

  async updateEmailTemplate(id: string, updates: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const [template] = await db.update(emailTemplates).set(updates).where(eq(emailTemplates.id, id)).returning();
    return template || undefined;
  }

  async deleteEmailTemplate(id: string): Promise<boolean> {
    const result = await db.delete(emailTemplates).where(eq(emailTemplates.id, id)).returning();
    return result.length > 0;
  }

  // Settings
  async getSetting(key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.getSetting(key);
    if (existing !== undefined) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const allSettings = await db.select().from(settings);
    const result: Record<string, string> = {};
    allSettings.forEach(s => {
      result[s.key] = s.value;
    });
    return result;
  }

  // Password Reset Tokens
  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db.insert(passwordResetTokens).values(insertToken).returning();
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return resetToken || undefined;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens).set({ used: 1 }).where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    const now = new Date().toISOString();
    await db.delete(passwordResetTokens).where(sql`${passwordResetTokens.expiresAt} < ${now}`);
  }

  // Reviews
  async getAllReviews(): Promise<Review[]> {
    return db.select().from(reviews).orderBy(desc(reviews.createdAt));
  }

  async getReviewsPaginated(page: number, limit: number): Promise<{ reviews: Review[]; total: number }> {
    const offset = (page - 1) * limit;
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(reviews);
    const total = Number(countResult.count);
    const result = await db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(limit).offset(offset);
    return { reviews: result, total };
  }

  async getReview(id: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id));
    return review || undefined;
  }

  async getReviewByOrderId(orderId: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.orderId, orderId));
    return review || undefined;
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    return created;
  }

  async updateReview(id: string, review: Partial<InsertReview>): Promise<Review | undefined> {
    const [updated] = await db.update(reviews).set(review).where(eq(reviews.id, id)).returning();
    return updated || undefined;
  }

  async deleteReview(id: string): Promise<boolean> {
    const result = await db.delete(reviews).where(eq(reviews.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();

export class InsufficientStockError extends Error {
  constructor(
    public readonly productName: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(`Insufficient stock for ${productName}: ${available} available, ${requested} requested`);
    this.name = "InsufficientStockError";
  }
}
