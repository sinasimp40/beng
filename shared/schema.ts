import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  banned: integer("banned").notNull().default(0),
  creditBalanceCents: integer("credit_balance_cents").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  role: true,
});

// Cap the password length at 256 bytes everywhere so an attacker cannot
// submit a multi-megabyte "password" and force the server to spend large
// amounts of CPU/memory hashing it.
const MAX_PW = 256;

export const registerUserSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
  password: z.string().min(6, "Password must be at least 6 characters").max(MAX_PW, "Password is too long"),
  recaptchaToken: z.string().optional(),
});

export const loginUserSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
  password: z.string().min(1, "Password is required").max(MAX_PW, "Password is too long"),
  recaptchaToken: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(MAX_PW),
  newPassword: z.string().min(6, "New password must be at least 6 characters").max(MAX_PW, "Password is too long"),
});

export const adminUpdateUserSchema = z.object({
  email: z.string().email("Invalid email address").max(254).optional(),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(MAX_PW, "Password is too long").optional(),
  banned: z.boolean().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "password">;

// Categories available for products
export const CATEGORIES = [
  "All",
  "FLIGHTS",
  "HOTELS",
  "SHOPPING",
  "CASHOUTS",
  "GIFTCARDS",
  "FOOD",
  "STREAMING",
  "VPN",
  "FUEL",
  "GAMES",
  "MUSIC",
  "LUXURY",
  "GROCERIES",
  "RENT",
] as const;

export type Category = (typeof CATEGORIES)[number];

// All countries with ISO 3166-1 alpha-2 codes for flag support
export const COUNTRIES = [
  { code: "ww", name: "Worldwide" },
  { code: "af", name: "Afghanistan" },
  { code: "al", name: "Albania" },
  { code: "dz", name: "Algeria" },
  { code: "ad", name: "Andorra" },
  { code: "ao", name: "Angola" },
  { code: "ag", name: "Antigua and Barbuda" },
  { code: "ar", name: "Argentina" },
  { code: "am", name: "Armenia" },
  { code: "au", name: "Australia" },
  { code: "at", name: "Austria" },
  { code: "az", name: "Azerbaijan" },
  { code: "bs", name: "Bahamas" },
  { code: "bh", name: "Bahrain" },
  { code: "bd", name: "Bangladesh" },
  { code: "bb", name: "Barbados" },
  { code: "by", name: "Belarus" },
  { code: "be", name: "Belgium" },
  { code: "bz", name: "Belize" },
  { code: "bj", name: "Benin" },
  { code: "bt", name: "Bhutan" },
  { code: "bo", name: "Bolivia" },
  { code: "ba", name: "Bosnia and Herzegovina" },
  { code: "bw", name: "Botswana" },
  { code: "br", name: "Brazil" },
  { code: "bn", name: "Brunei" },
  { code: "bg", name: "Bulgaria" },
  { code: "bf", name: "Burkina Faso" },
  { code: "bi", name: "Burundi" },
  { code: "cv", name: "Cabo Verde" },
  { code: "kh", name: "Cambodia" },
  { code: "cm", name: "Cameroon" },
  { code: "ca", name: "Canada" },
  { code: "cf", name: "Central African Republic" },
  { code: "td", name: "Chad" },
  { code: "cl", name: "Chile" },
  { code: "cn", name: "China" },
  { code: "co", name: "Colombia" },
  { code: "km", name: "Comoros" },
  { code: "cg", name: "Congo" },
  { code: "cd", name: "Congo (DRC)" },
  { code: "cr", name: "Costa Rica" },
  { code: "ci", name: "Ivory Coast" },
  { code: "hr", name: "Croatia" },
  { code: "cu", name: "Cuba" },
  { code: "cy", name: "Cyprus" },
  { code: "cz", name: "Czech Republic" },
  { code: "dk", name: "Denmark" },
  { code: "dj", name: "Djibouti" },
  { code: "dm", name: "Dominica" },
  { code: "do", name: "Dominican Republic" },
  { code: "ec", name: "Ecuador" },
  { code: "eg", name: "Egypt" },
  { code: "sv", name: "El Salvador" },
  { code: "gq", name: "Equatorial Guinea" },
  { code: "er", name: "Eritrea" },
  { code: "ee", name: "Estonia" },
  { code: "sz", name: "Eswatini" },
  { code: "et", name: "Ethiopia" },
  { code: "fj", name: "Fiji" },
  { code: "fi", name: "Finland" },
  { code: "fr", name: "France" },
  { code: "ga", name: "Gabon" },
  { code: "gm", name: "Gambia" },
  { code: "ge", name: "Georgia" },
  { code: "de", name: "Germany" },
  { code: "gh", name: "Ghana" },
  { code: "gr", name: "Greece" },
  { code: "gd", name: "Grenada" },
  { code: "gt", name: "Guatemala" },
  { code: "gn", name: "Guinea" },
  { code: "gw", name: "Guinea-Bissau" },
  { code: "gy", name: "Guyana" },
  { code: "ht", name: "Haiti" },
  { code: "hn", name: "Honduras" },
  { code: "hk", name: "Hong Kong" },
  { code: "hu", name: "Hungary" },
  { code: "is", name: "Iceland" },
  { code: "in", name: "India" },
  { code: "id", name: "Indonesia" },
  { code: "ir", name: "Iran" },
  { code: "iq", name: "Iraq" },
  { code: "ie", name: "Ireland" },
  { code: "il", name: "Israel" },
  { code: "it", name: "Italy" },
  { code: "jm", name: "Jamaica" },
  { code: "jp", name: "Japan" },
  { code: "jo", name: "Jordan" },
  { code: "kz", name: "Kazakhstan" },
  { code: "ke", name: "Kenya" },
  { code: "ki", name: "Kiribati" },
  { code: "kp", name: "North Korea" },
  { code: "kr", name: "South Korea" },
  { code: "kw", name: "Kuwait" },
  { code: "kg", name: "Kyrgyzstan" },
  { code: "la", name: "Laos" },
  { code: "lv", name: "Latvia" },
  { code: "lb", name: "Lebanon" },
  { code: "ls", name: "Lesotho" },
  { code: "lr", name: "Liberia" },
  { code: "ly", name: "Libya" },
  { code: "li", name: "Liechtenstein" },
  { code: "lt", name: "Lithuania" },
  { code: "lu", name: "Luxembourg" },
  { code: "mo", name: "Macau" },
  { code: "mg", name: "Madagascar" },
  { code: "mw", name: "Malawi" },
  { code: "my", name: "Malaysia" },
  { code: "mv", name: "Maldives" },
  { code: "ml", name: "Mali" },
  { code: "mt", name: "Malta" },
  { code: "mh", name: "Marshall Islands" },
  { code: "mr", name: "Mauritania" },
  { code: "mu", name: "Mauritius" },
  { code: "mx", name: "Mexico" },
  { code: "fm", name: "Micronesia" },
  { code: "md", name: "Moldova" },
  { code: "mc", name: "Monaco" },
  { code: "mn", name: "Mongolia" },
  { code: "me", name: "Montenegro" },
  { code: "ma", name: "Morocco" },
  { code: "mz", name: "Mozambique" },
  { code: "mm", name: "Myanmar" },
  { code: "na", name: "Namibia" },
  { code: "nr", name: "Nauru" },
  { code: "np", name: "Nepal" },
  { code: "nl", name: "Netherlands" },
  { code: "nz", name: "New Zealand" },
  { code: "ni", name: "Nicaragua" },
  { code: "ne", name: "Niger" },
  { code: "ng", name: "Nigeria" },
  { code: "mk", name: "North Macedonia" },
  { code: "no", name: "Norway" },
  { code: "om", name: "Oman" },
  { code: "pk", name: "Pakistan" },
  { code: "pw", name: "Palau" },
  { code: "ps", name: "Palestine" },
  { code: "pa", name: "Panama" },
  { code: "pg", name: "Papua New Guinea" },
  { code: "py", name: "Paraguay" },
  { code: "pe", name: "Peru" },
  { code: "ph", name: "Philippines" },
  { code: "pl", name: "Poland" },
  { code: "pt", name: "Portugal" },
  { code: "qa", name: "Qatar" },
  { code: "ro", name: "Romania" },
  { code: "ru", name: "Russia" },
  { code: "rw", name: "Rwanda" },
  { code: "kn", name: "Saint Kitts and Nevis" },
  { code: "lc", name: "Saint Lucia" },
  { code: "vc", name: "Saint Vincent and the Grenadines" },
  { code: "ws", name: "Samoa" },
  { code: "sm", name: "San Marino" },
  { code: "st", name: "Sao Tome and Principe" },
  { code: "sa", name: "Saudi Arabia" },
  { code: "sn", name: "Senegal" },
  { code: "rs", name: "Serbia" },
  { code: "sc", name: "Seychelles" },
  { code: "sl", name: "Sierra Leone" },
  { code: "sg", name: "Singapore" },
  { code: "sk", name: "Slovakia" },
  { code: "si", name: "Slovenia" },
  { code: "sb", name: "Solomon Islands" },
  { code: "so", name: "Somalia" },
  { code: "za", name: "South Africa" },
  { code: "ss", name: "South Sudan" },
  { code: "es", name: "Spain" },
  { code: "lk", name: "Sri Lanka" },
  { code: "sd", name: "Sudan" },
  { code: "sr", name: "Suriname" },
  { code: "se", name: "Sweden" },
  { code: "ch", name: "Switzerland" },
  { code: "sy", name: "Syria" },
  { code: "tw", name: "Taiwan" },
  { code: "tj", name: "Tajikistan" },
  { code: "tz", name: "Tanzania" },
  { code: "th", name: "Thailand" },
  { code: "tl", name: "Timor-Leste" },
  { code: "tg", name: "Togo" },
  { code: "to", name: "Tonga" },
  { code: "tt", name: "Trinidad and Tobago" },
  { code: "tn", name: "Tunisia" },
  { code: "tr", name: "Turkey" },
  { code: "tm", name: "Turkmenistan" },
  { code: "tv", name: "Tuvalu" },
  { code: "ug", name: "Uganda" },
  { code: "ua", name: "Ukraine" },
  { code: "ae", name: "United Arab Emirates" },
  { code: "gb", name: "United Kingdom" },
  { code: "us", name: "United States" },
  { code: "uy", name: "Uruguay" },
  { code: "uz", name: "Uzbekistan" },
  { code: "vu", name: "Vanuatu" },
  { code: "va", name: "Vatican City" },
  { code: "ve", name: "Venezuela" },
  { code: "vn", name: "Vietnam" },
  { code: "ye", name: "Yemen" },
  { code: "zm", name: "Zambia" },
  { code: "zw", name: "Zimbabwe" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  category: text("category").default(""),
  stock: integer("stock").notNull().default(0),
  imageUrl: text("image_url"),
  countries: text("countries").array().default([]),
  stockList: text("stock_list"),
  enabled: integer("enabled").notNull().default(1),
  isHot: integer("is_hot").notNull().default(0),
  parentId: varchar("parent_id"),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type ProductWithVariants = Product & { variants?: Product[] };

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: text("order_id").notNull().unique(),
  userId: varchar("user_id"),
  productId: varchar("product_id").notNull(),
  productName: text("product_name"),
  quantity: integer("quantity").notNull().default(1),
  totalAmount: real("total_amount").notNull(),
  status: text("status").notNull().default("pending"),
  paymentId: text("payment_id"),
  payAddress: text("pay_address"),
  payCurrency: text("pay_currency"),
  payAmount: real("pay_amount"),
  email: text("email"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  sentStock: text("sent_stock"),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  deliveryAttemptedAt: text("delivery_attempted_at"),
  deliveryAttempts: integer("delivery_attempts").notNull().default(0),
  deliveryLeaseId: text("delivery_lease_id"),
  ipAddress: text("ip_address"),
  paymentMethod: text("payment_method").notNull().default("crypto"),
  refundedAt: text("refunded_at"),
  refundedBy: varchar("refunded_by"),
  refundReason: text("refund_reason"),
});

// Individual products included in a payment. Existing orders without rows in
// this table continue to use the legacy single-product fields above.
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: text("order_id").notNull().references(() => orders.orderId, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull(),
  fulfillmentStatus: text("fulfillment_status").notNull().default("pending"),
  fulfilledStock: text("fulfilled_stock"),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Email templates table
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  isDefault: integer("is_default").default(0),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Immutable account-credit ledger. The user's balance is a cached aggregate;
// every mutation is represented exactly once by an idempotency-keyed row.
export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  type: text("type").notNull(),
  amountCents: integer("amount_cents").notNull(),
  balanceAfterCents: integer("balance_after_cents").notNull(),
  status: text("status").notNull().default("completed"),
  idempotencyKey: text("idempotency_key").notNull().unique().default(sql`gen_random_uuid()::text`),
  operationFingerprint: text("operation_fingerprint").notNull().default(""),
  orderId: text("order_id"),
  topupId: varchar("topup_id"),
  actorUserId: varchar("actor_user_id"),
  actorEmail: text("actor_email"),
  reason: text("reason"),
  notificationStatus: text("notification_status").notNull().default("pending"),
  notificationAttempts: integer("notification_attempts").notNull().default(0),
  notificationLeaseId: text("notification_lease_id"),
  notificationAttemptedAt: text("notification_attempted_at"),
  notificationLastError: text("notification_last_error"),
  notifiedAt: text("notified_at"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const creditTopups = pgTable("credit_topups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  idempotencyKey: text("idempotency_key").notNull().unique().default(sql`gen_random_uuid()::text`),
  operationFingerprint: text("operation_fingerprint").notNull().default(""),
  userId: varchar("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("creating"),
  paymentId: text("payment_id").unique(),
  payCurrency: text("pay_currency").notNull(),
  payAddress: text("pay_address"),
  payAmount: real("pay_amount"),
  gatewayStatus: text("gateway_status"),
  transactionId: varchar("transaction_id"),
  lastReconciledAt: text("last_reconciled_at"),
  createdAt: text("created_at").notNull().default(sql`now()`),
  completedAt: text("completed_at"),
  updatedAt: text("updated_at").notNull().default(sql`now()`),
});

// Durable Telegram outbox for top-up lifecycle events. eventKey prevents
// duplicate polling, callback, or idempotent request paths from duplicating alerts.
export const creditTelegramEvents = pgTable("credit_telegram_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventKey: text("event_key").notNull().unique(),
  topupId: varchar("topup_id").notNull(),
  userEmail: text("user_email").notNull(),
  amountCents: integer("amount_cents").notNull(),
  payCurrency: text("pay_currency").notNull(),
  paymentId: text("payment_id"),
  eventStatus: text("event_status").notNull(),
  gatewayStatus: text("gateway_status"),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  deliveryAttempts: integer("delivery_attempts").notNull().default(0),
  deliveryLeaseId: text("delivery_lease_id"),
  deliveryAttemptedAt: text("delivery_attempted_at"),
  deliveryLastError: text("delivery_last_error"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
});
export const insertCreditTopupSchema = createInsertSchema(creditTopups).omit({
  id: true,
});

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTopup = typeof creditTopups.$inferSelect;
export type InsertCreditTopup = z.infer<typeof insertCreditTopupSchema>;
export type CreditTelegramEvent = typeof creditTelegramEvents.$inferSelect;

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
});

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Settings table for app configuration
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
});

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`now()`),
  used: integer("used").notNull().default(0),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Reviews/Vouches table
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: text("order_id"),
  customerName: text("customer_name").notNull(),
  rating: integer("rating").notNull().default(5),
  comment: text("comment").notNull(),
  platform: text("platform").default(""),
  avatarUrl: text("avatar_url"),
  verified: integer("verified").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`now()`),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
});

export const submitReviewSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  rating: z.number().min(1).max(5),
  comment: z.string().min(3, "Review must be at least 3 characters").max(500, "Review must be under 500 characters"),
});

export type InsertReview = z.infer<typeof insertReviewSchema>;
export type SubmitReview = z.infer<typeof submitReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// Statistics type
export interface Statistics {
  productsSold: number;
  customers: number;
  averageRating: number;
}

// Database backup settings schema
export const databaseBackupSettingsSchema = z.object({
  telegramBotToken: z.string().optional(),
  telegramChannelId: z.string().optional(),
  backupIntervalHours: z.number().min(1).max(168).default(5),
  autoBackupEnabled: z.boolean().default(false),
  hasToken: z.boolean().optional(),
});

export type DatabaseBackupSettings = z.infer<typeof databaseBackupSettingsSchema>;

// Backup progress types for WebSocket communication
export interface BackupProgress {
  jobId: string;
  phase: 'preparing' | 'exporting' | 'importing' | 'uploading' | 'completed' | 'error';
  percent: number;
  message: string;
  tableName?: string;
  totalRows?: number;
  processedRows?: number;
}

// Export data structure
export interface DatabaseExport {
  version: string;
  exportedAt: string;
  tables: {
    [tableName: string]: {
      rowCount: number;
      data: Record<string, unknown>[];
    };
  };
}
