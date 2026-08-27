import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { InsufficientStockError, storage } from "./storage";
import { insertProductSchema, insertOrderSchema, insertEmailTemplateSchema, registerUserSchema, loginUserSchema, changePasswordSchema, adminUpdateUserSchema, type SafeUser, type BackupProgress, databaseBackupSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { nowPaymentsService } from "./nowpayments";
import { emailService } from "./email";
import { verifyRecaptcha, hashPassword, verifyPassword, generateSessionToken, needsRehash } from "./auth";
import { exportDatabase, importDatabase, generateJobId, encryptToken, decryptToken, scheduleAutoBackup, initializeEncryption } from "./services/databaseBackupService";
import { testTelegramConnection, sendBackupToTelegram, sendOrderNotification } from "./services/telegramService";
import { clearThemeCache } from "./themeInjector";
import { validateGitHubRepo, checkForUpdates, applyUpdate, verifyRepoFingerprint, generateRepoFingerprint, getLatestProgress, clearProgress } from "./services/updateService";
import type { Order } from "@shared/schema";
import { authLimiter, paymentLimiter, checkBruteForce, recordFailedLogin, recordSuccessfulLogin } from "./security";

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hslToRgba(h: number, s: number, l: number, alpha: number = 1): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return `rgba(${f(0)}, ${f(8)}, ${f(4)}, ${alpha})`;
}

async function getThemeColors(): Promise<{ hex: string; rgba02: string; rgba01: string; rgba04: string }> {
  const h = parseInt(await storage.getSetting("theme_primary_hue") || "185");
  const s = parseInt(await storage.getSetting("theme_primary_saturation") || "80");
  const l = parseInt(await storage.getSetting("theme_primary_lightness") || "50");
  return {
    hex: hslToHex(h, s, l),
    rgba02: hslToRgba(h, s, l, 0.2),
    rgba01: hslToRgba(h, s, l, 0.1),
    rgba04: hslToRgba(h, s, l, 0.4),
  };
}

async function notifyTelegramOrder(order: Order, isStatusChange: boolean = false): Promise<void> {
  try {
    const encryptedToken = await storage.getSetting("telegram_bot_token");
    const channelId = await storage.getSetting("telegram_channel_id");
    
    if (!encryptedToken || !channelId) {
      return;
    }
    
    const botToken = decryptToken(encryptedToken);
    if (!botToken) {
      return;
    }
    
    await sendOrderNotification(botToken, channelId, order, isStatusChange);
  } catch (error) {
    console.error('Failed to send Telegram order notification:', error);
  }
}

function getDefaultForgotPasswordTemplate(themeColor: string = "#06b6d4", themeRgba02: string = "rgba(6, 182, 212, 0.2)", themeRgba01: string = "rgba(6, 182, 212, 0.1)", themeRgba04: string = "rgba(6, 182, 212, 0.4)"): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background: linear-gradient(135deg, #111111 0%, #1a1a1a 100%); border-radius: 16px; border: 1px solid ${themeRgba02}; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(90deg, ${themeRgba02} 0%, ${themeRgba01} 100%); padding: 32px 40px; border-bottom: 1px solid ${themeRgba01};">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${themeColor}; letter-spacing: -0.5px;">{{shopName}}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h2 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #ffffff;">Password Reset Request</h2>
                <p style="margin: 0; font-size: 14px; color: #9ca3af;">We received a request to reset your password</p>
              </div>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #d1d5db;">Hello,<br><br>We received a request to reset your password for your account. Click the button below to create a new password.</p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="{{resetLink}}" style="display: inline-block; padding: 16px 48px; background: ${themeColor}; color: #000000; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px ${themeRgba04};">Reset Password</a>
              </div>
              <p style="margin: 24px 0; font-size: 14px; line-height: 1.6; color: #9ca3af;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin: 0 0 24px; padding: 16px; background: ${themeRgba01}; border-radius: 8px; font-size: 12px; color: ${themeColor}; word-break: break-all; border: 1px solid ${themeRgba02};">{{resetLink}}</p>
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <p style="margin: 0; font-size: 14px; color: #6b7280;"><strong style="color: #9ca3af;">Security Notice:</strong><br>This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">This is an automated message, please do not reply.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Session storage for authentication
const sessions = new Map<string, { userId: string; email: string; role: string; expiresAt: Date }>();
// Track sessions by userId for single session enforcement
const userSessions = new Map<string, Set<string>>();
// WebSocket connections for session invalidation notifications (token -> WebSocket)
const sessionSubscribers = new Map<string, WebSocket>();

// Active admin WebSocket connections bound to their session token, so we can
// force-close privileged streams when the session is revoked/expired.
const adminWsByToken = new Map<string, Set<WebSocket>>();

function registerAdminWs(token: string, ws: WebSocket) {
  let set = adminWsByToken.get(token);
  if (!set) {
    set = new Set();
    adminWsByToken.set(token, set);
  }
  set.add(ws);
  const cleanup = () => {
    const s = adminWsByToken.get(token);
    if (s) {
      s.delete(ws);
      if (s.size === 0) adminWsByToken.delete(token);
    }
  };
  ws.on("close", cleanup);
  ws.on("error", cleanup);
}

function closeAdminWsForToken(token: string) {
  const set = adminWsByToken.get(token);
  if (!set) return;
  set.forEach((ws) => {
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(4401, "session revoked");
      }
    } catch {}
  });
  adminWsByToken.delete(token);
}

// Wrap sessions.delete so revocation always force-closes bound admin WS streams.
const _origSessionsDelete = sessions.delete.bind(sessions);
sessions.delete = (token: string) => {
  closeAdminWsForToken(token);
  return _origSessionsDelete(token);
};

// Cleanup expired sessions periodically (this now also closes their admin WS).
setInterval(() => {
  const now = new Date();
  Array.from(sessions.entries()).forEach(([token, session]) => {
    if (session.expiresAt < now) {
      sessions.delete(token);
    }
  });
}, 60000); // Run every minute

// Store active payment subscriptions for real-time updates
const paymentSubscriptions = new Map<string, Set<WebSocket>>();
// Store WebSocket clients for admin order updates
const orderSubscribers = new Set<WebSocket>();
// Store WebSocket clients for product updates
const productSubscribers = new Set<WebSocket>();
// Store WebSocket clients for theme updates (all visitors)
const themeSubscribers = new Set<WebSocket>();
// Store WebSocket clients for review updates
const reviewSubscribers = new Set<WebSocket>();
const statusSubscribers = new Set<WebSocket>();
// Lock for processing completed orders (prevents duplicate email/stock consumption)
const processingOrders = new Set<string>();

const checkoutItemsSchema = z.array(z.object({
  productId: z.string().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(100),
})).min(1).max(50);

async function fulfillCompletedOrder(orderId: string): Promise<Order | undefined> {
  if (processingOrders.has(orderId)) {
    return storage.getOrderByOrderId(orderId);
  }

  processingOrders.add(orderId);
  try {
    let order = await storage.getOrderByOrderId(orderId);
    if (!order || order.status === "completed") return order;

    let productIds: string[] = [];
    if (!order.sentStock) {
      try {
        const claim = await storage.claimOrderStock(orderId);
        if (!claim) return undefined;
        order = claim.order;
        productIds = claim.productIds;
      } catch (error) {
        if (!(error instanceof InsufficientStockError)) throw error;
        const failedOrder = await storage.updateOrderByOrderId(orderId, {
          status: "fulfillment_failed",
        });
        if (failedOrder) {
          broadcastOrderUpdate("order_updated", failedOrder);
        }
        console.error(`Fulfillment paused for ${orderId}: ${error.message}`);
        return failedOrder;
      }
    }

    for (const productId of productIds) {
      const updatedProduct = await storage.getProduct(productId);
      if (updatedProduct) broadcastProductUpdate("product_updated", updatedProduct);
    }

    const deliveryEmail = order.email;
    const deliveryStock = order.sentStock;
    let deliveryLeaseId: string | undefined;
    if (deliveryStock && deliveryEmail) {
      const deliveryClaim = await storage.claimOrderDelivery(orderId);
      if (!deliveryClaim) {
        return storage.getOrderByOrderId(orderId);
      }
      order = deliveryClaim;
      if (!order.deliveryLeaseId) {
        throw new Error(`Delivery lease ${orderId} has no ownership token`);
      }
      deliveryLeaseId = order.deliveryLeaseId;
      const emailResult = await emailService.sendOrderEmail({
        to: deliveryEmail,
        orderId: order.orderId,
        productName: order.productName || "Order",
        totalAmount: order.totalAmount,
        stockItem: deliveryStock,
      });
      if (!emailResult.success) {
        const failedOrder = await storage.failOrderDelivery(orderId, deliveryLeaseId);
        if (failedOrder) {
          broadcastOrderUpdate("order_updated", failedOrder);
        }
        console.error(`Delivery email pending for ${orderId}: ${emailResult.error || "Unknown email error"}`);
        return storage.getOrderByOrderId(orderId);
      }
    }

    const updatedOrder = deliveryLeaseId
      ? await storage.completeOrderDelivery(orderId, deliveryLeaseId)
      : await storage.completeOrderWithoutDelivery(orderId);
    if (updatedOrder) {
      broadcastOrderUpdate("order_updated", updatedOrder);
      notifyTelegramOrder(updatedOrder, true);
    }
    return updatedOrder;
  } finally {
    processingOrders.delete(orderId);
  }
}

// Background polling interval for pending orders (auto-update from NOWPayments)
let orderPollingInterval: NodeJS.Timeout | null = null;

async function pollPendingOrders() {
  try {
    const allOrders = await storage.getAllOrders();
    const fulfillmentRetries = allOrders.filter(order =>
      (order.status === "fulfilling" || order.status === "fulfillment_failed") &&
      order.deliveryStatus !== "exhausted"
    );
    for (const order of fulfillmentRetries) {
      try {
        await fulfillCompletedOrder(order.orderId);
      } catch (error) {
        console.error(`Fulfillment retry failed for ${order.orderId}:`, error);
      }
    }

    if (!nowPaymentsService.isConfigured()) {
      return;
    }

    const pendingOrders = allOrders.filter(o => 
      (o.status === 'pending' || o.status === 'confirming') && o.paymentId
    );

    for (const order of pendingOrders) {
      try {
        const status = await nowPaymentsService.getPaymentStatus(order.paymentId!);
        
        const statusMap: Record<string, string> = {
          'waiting': 'pending',
          'confirming': 'confirming',
          'confirmed': 'confirming',
          'sending': 'confirming',
          'partially_paid': 'pending',
          'finished': 'completed',
          'failed': 'failed',
          'refunded': 'refunded',
          'expired': 'expired'
        };
        
        const newStatus = statusMap[status.payment_status] || order.status;
        
        if (newStatus !== order.status) {
          // Complete fulfillment (including retrying delivery after stock was claimed).
          if (newStatus === 'completed') {
            const updatedOrder = await fulfillCompletedOrder(order.orderId);
            if (updatedOrder) {
              broadcastPaymentStatus(order.paymentId!, { ...status, order: updatedOrder });
            }
          } else {
            // Just update the status
            await storage.updateOrderByOrderId(order.orderId, { status: newStatus });
            const updatedOrder = await storage.getOrderByOrderId(order.orderId);
            if (updatedOrder) {
              broadcastPaymentStatus(order.paymentId!, { ...status, order: updatedOrder });
              broadcastOrderUpdate("order_updated", updatedOrder);
              notifyTelegramOrder(updatedOrder, true);
            }
          }
        }
      } catch (err) {
        // Silently fail for individual orders, continue with others
      }
    }
  } catch (error) {
    console.error("Error in order polling:", error);
  }
}

// Start background order polling (every 30 seconds)
function startOrderPolling() {
  if (orderPollingInterval) {
    clearInterval(orderPollingInterval);
  }
  orderPollingInterval = setInterval(pollPendingOrders, 30000);
  console.log("Started automatic order status polling (every 30 seconds)");
}

// Broadcast payment status to all subscribers
function broadcastPaymentStatus(paymentId: string, status: any) {
  const subscribers = paymentSubscriptions.get(paymentId);
  if (subscribers) {
    const message = JSON.stringify({ type: "payment_status", paymentId, status });
    subscribers.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

// Broadcast order updates to all admin subscribers
function broadcastOrderUpdate(eventType: "order_created" | "order_updated", order: any) {
  const message = JSON.stringify({ type: eventType, order });
  orderSubscribers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Middleware to require admin authentication
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  const session = sessions.get(token);

  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({ error: "Session expired" });
  }

  if (session.role !== "admin") {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }

  next();
}

// Broadcast product updates to all subscribers
function broadcastProductUpdate(eventType: "product_created" | "product_updated" | "product_deleted", product: any) {
  const message = JSON.stringify({ type: eventType, product });
  productSubscribers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Broadcast review updates to all subscribers
function broadcastReviewUpdate(eventType: "review_created" | "review_updated" | "review_deleted", review: any) {
  const message = JSON.stringify({ type: eventType, review });
  reviewSubscribers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Broadcast theme updates to all connected clients
function broadcastThemeUpdate(theme: { primaryHue: number; primarySaturation: number; primaryLightness: number }) {
  const message = JSON.stringify({ type: "theme_updated", theme });
  themeSubscribers.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Invalidate all sessions for a user except the current one and notify via WebSocket
function invalidateUserSessions(userId: string, exceptToken?: string) {
  const userTokens = userSessions.get(userId);
  if (!userTokens) return;

  userTokens.forEach((token) => {
    if (token !== exceptToken) {
      sessions.delete(token);
      // Notify WebSocket subscriber if connected
      const ws = sessionSubscribers.get(token);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "session_invalidated", reason: "logged_in_elsewhere" }));
        sessionSubscribers.delete(token);
      }
    }
  });

  // Clear and set only current token
  if (exceptToken) {
    userSessions.set(userId, new Set([exceptToken]));
  } else {
    userSessions.delete(userId);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Authentication endpoints
  app.post("/api/auth/register", authLimiter, checkBruteForce, async (req, res) => {
    try {
      const validatedData = registerUserSchema.parse(req.body);
      
      // Verify reCAPTCHA
      const isValidRecaptcha = await verifyRecaptcha(validatedData.recaptchaToken);
      if (!isValidRecaptcha) {
        return res.status(400).json({ error: "reCAPTCHA verification failed" });
      }

      // Check if user already exists. We DELIBERATELY return the same
      // success-shaped 200 as a real registration to avoid email enumeration,
      // BUT we never issue a session token for an existing account — the
      // attacker just sees a generic message and cannot tell if the email is
      // in use or not.
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(200).json({
          success: true,
          message: "If this email is available, your account has been created. Please log in.",
        });
      }

      // Create user with hashed password
      const hashedPassword = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        email: validatedData.email,
        password: hashedPassword,
        role: "user",
      });

      // Create session
      const token = generateSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      sessions.set(token, { userId: user.id, email: user.email, role: user.role, expiresAt });

      // Track this session for the user
      const tokens = userSessions.get(user.id) || new Set();
      tokens.add(token);
      userSessions.set(user.id, tokens);

      const safeUser: SafeUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
      };

      res.status(201).json({ user: safeUser, token });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || "Validation error" });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ error: "Failed to register user" });
    }
  });

  app.post("/api/auth/login", authLimiter, checkBruteForce, async (req, res) => {
    try {
      const validatedData = loginUserSchema.parse(req.body);
      
      // Verify reCAPTCHA
      const isValidRecaptcha = await verifyRecaptcha(validatedData.recaptchaToken);
      if (!isValidRecaptcha) {
        recordFailedLogin(req);
        return res.status(400).json({ error: "reCAPTCHA verification failed" });
      }

      // Find user
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user) {
        recordFailedLogin(req);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await verifyPassword(validatedData.password, user.password);
      if (!isValidPassword) {
        recordFailedLogin(req);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check if user is banned
      if (user.banned === 1) {
        return res.status(403).json({ error: "Your account has been suspended" });
      }

      // Transparently upgrade legacy (weak sha256) password hashes to scrypt
      // now that we have the plaintext password in memory and have verified it.
      if (needsRehash(user.password)) {
        try {
          await storage.updateUser(user.id, { password: await hashPassword(validatedData.password) });
        } catch (e) {
          console.error("Failed to upgrade password hash:", e);
        }
      }

      recordSuccessfulLogin(req);

      // Invalidate existing sessions for single session enforcement
      invalidateUserSessions(user.id);

      // Create session
      const token = generateSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      sessions.set(token, { userId: user.id, email: user.email, role: user.role, expiresAt });

      // Track this session for the user
      const tokens = userSessions.get(user.id) || new Set();
      tokens.add(token);
      userSessions.set(user.id, tokens);

      const safeUser: SafeUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
      };

      res.json({ user: safeUser, token });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || "Validation error" });
      }
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const session = sessions.get(token);
        if (session) {
          // Remove from userSessions
          const userTokens = userSessions.get(session.userId);
          if (userTokens) {
            userTokens.delete(token);
            if (userTokens.size === 0) {
              userSessions.delete(session.userId);
            }
          }
        }
        sessions.delete(token);
        sessionSubscribers.delete(token);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging out:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const token = authHeader.substring(7);
      const session = sessions.get(token);

      if (!session || session.expiresAt < new Date()) {
        sessions.delete(token);
        return res.status(401).json({ error: "Session expired" });
      }

      const user = await storage.getUser(session.userId);
      if (!user) {
        sessions.delete(token);
        return res.status(401).json({ error: "User not found" });
      }

      // Check if user is banned
      if (user.banned === 1) {
        sessions.delete(token);
        return res.status(403).json({ error: "Your account has been suspended" });
      }

      const safeUser: SafeUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
      };

      res.json({ user: safeUser });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Change password endpoint
  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const token = authHeader.substring(7);
      const session = sessions.get(token);

      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Session expired" });
      }

      const validatedData = changePasswordSchema.parse(req.body);
      
      const user = await storage.getUser(session.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValidPassword = await verifyPassword(validatedData.currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Update password
      const hashedPassword = await hashPassword(validatedData.newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || "Validation error" });
      }
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Forgot password - send reset email
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email, recaptchaToken } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Verify reCAPTCHA
      const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidRecaptcha) {
        return res.status(400).json({ error: "reCAPTCHA verification failed" });
      }

      // Find user
      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ success: true, message: "If an account exists with this email, you will receive a password reset link." });
      }

      // Generate reset token - create both raw token for email and hashed token for storage
      const crypto = await import("crypto");
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Save hashed token (never store raw token in database)
      await storage.createPasswordResetToken({
        userId: user.id,
        token: hashedToken,
        expiresAt,
      });

      // Get the base URL for the reset link from trusted server config ONLY.
      // NEVER use request headers (Host / X-Forwarded-*) — they are attacker
      // controlled and enable host-header password-reset poisoning.
      const trustedBaseUrl =
        process.env.APP_BASE_URL ||
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "") ||
        (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "") ||
        "http://localhost:5000";
      const resetLink = `${trustedBaseUrl.replace(/\/+$/, "")}/reset-password?token=${rawToken}`;

      // Get the forgot password email template with dynamic theme colors
      const themeColors = await getThemeColors();
      const templateSubject = await storage.getSetting("forgot_password_template_subject") || "Reset Your Password";
      const templateContent = await storage.getSetting("forgot_password_template_content") || getDefaultForgotPasswordTemplate(themeColors.hex, themeColors.rgba02, themeColors.rgba01, themeColors.rgba04);
      const shopName = await storage.getSetting("shop_name") || "";

      // Replace template variables
      const emailSubject = templateSubject.replace(/{{resetLink}}/g, resetLink).replace(/{{shopName}}/g, shopName);
      const emailHtml = templateContent.replace(/{{resetLink}}/g, resetLink).replace(/{{shopName}}/g, shopName);

      // Send email
      await emailService.sendEmail({
        to: email,
        subject: emailSubject,
        html: emailHtml,
      });

      res.json({ success: true, message: "If an account exists with this email, you will receive a password reset link." });
    } catch (error) {
      console.error("Error sending forgot password email:", error);
      res.status(500).json({ error: "Failed to send reset email" });
    }
  });

  // Verify reset token
  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const rawToken = req.query.token as string;

      if (!rawToken) {
        return res.json({ valid: false, error: "Token is required" });
      }

      // Hash the incoming token to match against stored hash
      const crypto = await import("crypto");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      const resetToken = await storage.getPasswordResetToken(hashedToken);

      if (!resetToken) {
        return res.json({ valid: false, error: "Invalid reset token" });
      }

      if (resetToken.used === 1) {
        return res.json({ valid: false, error: "This reset link has already been used" });
      }

      if (new Date(resetToken.expiresAt) < new Date()) {
        return res.json({ valid: false, error: "This reset link has expired" });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.json({ valid: false, error: "Failed to verify token" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token: rawToken, newPassword } = req.body;

      if (!rawToken || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Hash the incoming token to match against stored hash
      const crypto = await import("crypto");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

      const resetToken = await storage.getPasswordResetToken(hashedToken);

      if (!resetToken) {
        return res.status(400).json({ error: "Invalid reset token" });
      }

      if (resetToken.used === 1) {
        return res.status(400).json({ error: "This reset link has already been used" });
      }

      if (new Date(resetToken.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This reset link has expired" });
      }

      // Get user
      const user = await storage.getUser(resetToken.userId);
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }

      // Update password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      // Mark token as used (use hashed token for database lookup)
      await storage.markPasswordResetTokenUsed(hashedToken);

      // Invalidate all user sessions
      invalidateUserSessions(user.id);

      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Forgot password template settings
  app.get("/api/settings/forgot-password-template", requireAdmin, async (req, res) => {
    try {
      const subject = await storage.getSetting("forgot_password_template_subject");
      const htmlContent = await storage.getSetting("forgot_password_template_content");
      const themeColors = await getThemeColors();

      if (!subject && !htmlContent) {
        return res.json({
          subject: "Reset Your Password",
          htmlContent: getDefaultForgotPasswordTemplate(themeColors.hex, themeColors.rgba02, themeColors.rgba01, themeColors.rgba04),
        });
      }

      res.json({
        subject: subject || "Reset Your Password",
        htmlContent: htmlContent || getDefaultForgotPasswordTemplate(themeColors.hex, themeColors.rgba02, themeColors.rgba01, themeColors.rgba04),
      });
    } catch (error) {
      console.error("Error fetching forgot password template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/settings/forgot-password-template", requireAdmin, async (req, res) => {
    try {
      const { subject, htmlContent } = req.body;

      if (subject) {
        await storage.setSetting("forgot_password_template_subject", subject);
      }
      if (htmlContent) {
        await storage.setSetting("forgot_password_template_content", htmlContent);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving forgot password template:", error);
      res.status(500).json({ error: "Failed to save template" });
    }
  });

  // Get user's orders by email
  app.get("/api/auth/orders", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const token = authHeader.substring(7);
      const session = sessions.get(token);

      if (!session || session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Session expired" });
      }

      const orders = await storage.getOrdersByEmail(session.email);
      const ordersWithItems = await Promise.all(orders.map(async order => ({
        ...order,
        items: await storage.getOrderItemsByOrderId(order.orderId),
      })));
      res.json(ordersWithItems);
    } catch (error) {
      console.error("Error fetching user orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Products endpoints
  app.get("/api/products", async (req, res) => {
    try {
      const allProducts = await storage.getAllProducts();
      let isAdmin = false;
      if (req.query.admin === "true") {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.substring(7);
          const session = sessions.get(token);
          if (session && session.expiresAt > new Date() && session.role === "admin") {
            isAdmin = true;
          }
        }
      }
      const products = isAdmin ? allProducts : allProducts.filter(p => p.enabled === 1);

      const productsWithVariants = products.map(p => {
        const variants = products.filter(v => v.parentId === p.id);
        return { ...p, variants: variants.length > 0 ? variants : undefined };
      });

      if (isAdmin) {
        res.json(productsWithVariants);
      } else {
        const storefront = productsWithVariants.filter(p => !p.parentId);
        res.json(storefront);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      broadcastProductUpdate("product_created", product);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, validatedData);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      broadcastProductUpdate("product_updated", product);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAdmin, async (req, res) => {
    try {
      console.log(`Deleting product with ID: ${req.params.id}`);
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        console.log(`Product not found: ${req.params.id}`);
        return res.status(404).json({ error: "Product not found" });
      }
      console.log(`Found product to delete: ${product.name}`);
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        console.log(`Failed to delete product: ${req.params.id}`);
        return res.status(404).json({ error: "Product not found" });
      }
      console.log(`Successfully deleted product: ${product.name} (${req.params.id})`);
      broadcastProductUpdate("product_deleted", product);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.post("/api/products/:id/variants", requireAdmin, async (req, res) => {
    try {
      const parentId = req.params.id;
      const { childIds } = req.body as { childIds: string[] };
      if (!childIds || !Array.isArray(childIds) || childIds.length === 0) {
        return res.status(400).json({ error: "childIds array is required" });
      }
      const parent = await storage.getProduct(parentId);
      if (!parent) {
        return res.status(404).json({ error: "Parent product not found" });
      }
      if (parent.parentId) {
        return res.status(400).json({ error: "Cannot add variants to a product that is itself a variant" });
      }
      for (const childId of childIds) {
        if (childId === parentId) {
          return res.status(400).json({ error: "Product cannot be a variant of itself" });
        }
        const child = await storage.getProduct(childId);
        if (!child) {
          return res.status(404).json({ error: `Child product ${childId} not found` });
        }
        if (child.parentId) {
          return res.status(400).json({ error: `Product "${child.name}" is already a variant of another product` });
        }
        const allProducts = await storage.getAllProducts();
        const hasChildren = allProducts.some(p => p.parentId === childId);
        if (hasChildren) {
          return res.status(400).json({ error: `Product "${child.name}" already has its own variants` });
        }
        await storage.updateProduct(childId, { parentId });
      }
      broadcastProductUpdate("product_updated", parent);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting variants:", error);
      res.status(500).json({ error: "Failed to set variants" });
    }
  });

  app.delete("/api/products/:id/variants/:childId", requireAdmin, async (req, res) => {
    try {
      const { childId } = req.params;
      await storage.updateProduct(childId, { parentId: null });
      broadcastProductUpdate("product_updated", { id: childId });
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing variant:", error);
      res.status(500).json({ error: "Failed to remove variant" });
    }
  });

  // Reviews endpoints (public)
  app.get("/api/reviews", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 24;
      const result = await storage.getReviewsPaginated(page, limit);
      res.json(result);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews/verify-order", async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "Please enter your Order ID" });
      }

      const order = await storage.getOrderByOrderId(orderId.trim());
      if (!order) {
        return res.status(404).json({ error: "Order not found. Please check your Order ID." });
      }

      if (order.status !== "completed") {
        return res.status(400).json({ error: "This order hasn't been completed yet" });
      }

      if (!order.sentStock) {
        return res.status(400).json({ error: "This order hasn't been delivered yet" });
      }

      const existingReview = await storage.getReviewByOrderId(orderId.trim());
      if (existingReview) {
        return res.status(400).json({ error: "A review has already been submitted for this order" });
      }

      res.json({ verified: true, productName: order.productName || "Product" });
    } catch (error) {
      console.error("Error verifying order for review:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const { orderId, rating, comment } = req.body;

      if (!orderId || !rating || !comment) {
        return res.status(400).json({ error: "Order ID, rating, and comment are required" });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      if (comment.length < 3 || comment.length > 500) {
        return res.status(400).json({ error: "Review must be between 3 and 500 characters" });
      }

      const order = await storage.getOrderByOrderId(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found. Please check your Order ID." });
      }

      if (order.status !== "completed") {
        return res.status(400).json({ error: "Order has not been completed yet. You can leave a review after your order is fulfilled." });
      }

      if (!order.sentStock) {
        return res.status(400).json({ error: "Order has not been delivered yet. Please wait for your delivery." });
      }

      const existingReview = await storage.getReviewByOrderId(orderId);
      if (existingReview) {
        return res.status(400).json({ error: "A review has already been submitted for this order." });
      }

      const review = await storage.createReview({
        orderId,
        customerName: order.email ? order.email.split("@")[0] : "Customer",
        rating,
        comment,
        verified: 1,
        platform: "",
      });

      broadcastReviewUpdate("review_created", review);
      res.status(201).json(review);
    } catch (error) {
      console.error("Error submitting review:", error);
      res.status(500).json({ error: "Failed to submit review" });
    }
  });

  // Admin Reviews endpoints
  app.post("/api/admin/reviews", requireAdmin, async (req, res) => {
    try {
      const reviewData = req.body;
      const review = await storage.createReview(reviewData);
      broadcastReviewUpdate("review_created", review);
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  app.patch("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const reviewData = req.body;
      const review = await storage.updateReview(id, reviewData);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      broadcastReviewUpdate("review_updated", review);
      res.json(review);
    } catch (error) {
      console.error("Error updating review:", error);
      res.status(500).json({ error: "Failed to update review" });
    }
  });

  app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteReview(id);
      broadcastReviewUpdate("review_deleted", { id });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // Orders endpoints
  app.get("/api/orders", requireAdmin, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Get unique users from orders (for admin)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      const usersMap = new Map<string, { email: string; orderCount: number; totalSpent: number; lastOrder: string; ips: Set<string> }>();
      
      orders.forEach(order => {
        if (!order.email) return;
        const existing = usersMap.get(order.email);
        if (existing) {
          existing.orderCount++;
          existing.totalSpent += order.totalAmount;
          if (new Date(order.createdAt) > new Date(existing.lastOrder)) {
            existing.lastOrder = order.createdAt;
          }
          if (order.ipAddress) existing.ips.add(order.ipAddress);
        } else {
          usersMap.set(order.email, {
            email: order.email,
            orderCount: 1,
            totalSpent: order.totalAmount,
            lastOrder: order.createdAt,
            ips: new Set(order.ipAddress ? [order.ipAddress] : []),
          });
        }
      });
      
      const users = Array.from(usersMap.values()).map(u => ({
        ...u,
        ips: Array.from(u.ips),
      }));
      
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Get orders for a specific user (for admin)
  app.get("/api/admin/users/:email/orders", requireAdmin, async (req, res) => {
    try {
      const orders = await storage.getOrdersByEmail(req.params.email);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching user orders:", error);
      res.status(500).json({ error: "Failed to fetch user orders" });
    }
  });

  // Sync order status from NOWPayments (for admin)
  app.post("/api/admin/orders/sync-status", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const token = authHeader.substring(7);
      const session = sessions.get(token);

      if (!session || session.expiresAt < new Date() || session.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!nowPaymentsService.isConfigured()) {
        return res.status(400).json({ error: "NOWPayments is not configured" });
      }

      const { orderId } = req.body;
      
      if (orderId) {
        // Sync single order
        const order = await storage.getOrderByOrderId(orderId);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        
        if (!order.paymentId) {
          return res.status(400).json({ error: "Order has no payment ID" });
        }

        try {
          const paymentStatus = await nowPaymentsService.getPaymentStatus(order.paymentId);
          let newStatus = order.status;
          
          // Map NOWPayments status to our status
          const statusMap: Record<string, string> = {
            'waiting': 'pending',
            'confirming': 'pending',
            'confirmed': 'pending',
            'sending': 'pending',
            'partially_paid': 'pending',
            'finished': 'completed',
            'failed': 'failed',
            'refunded': 'refunded',
            'expired': 'expired'
          };
          
          newStatus = statusMap[paymentStatus.payment_status] || order.status;
          
          if (newStatus !== order.status) {
            await storage.updateOrderByOrderId(orderId, { status: newStatus });
          }
          
          res.json({ 
            success: true, 
            orderId, 
            previousStatus: order.status,
            newStatus,
            nowpaymentsStatus: paymentStatus.payment_status
          });
        } catch (err) {
          console.error(`Failed to fetch status for order ${orderId}:`, err);
          res.status(500).json({ error: `Failed to fetch status from NOWPayments: ${err}` });
        }
      } else {
        // Sync all pending orders
        const allOrders = await storage.getAllOrders();
        const pendingOrders = allOrders.filter(o => o.status === 'pending' && o.paymentId);
        
        const results: Array<{ orderId: string; previousStatus: string; newStatus: string; nowpaymentsStatus?: string; error?: string }> = [];
        
        for (const order of pendingOrders) {
          try {
            const paymentStatus = await nowPaymentsService.getPaymentStatus(order.paymentId!);
            
            const statusMap: Record<string, string> = {
              'waiting': 'pending',
              'confirming': 'pending',
              'confirmed': 'pending',
              'sending': 'pending',
              'partially_paid': 'pending',
              'finished': 'completed',
              'failed': 'failed',
              'refunded': 'refunded',
              'expired': 'expired'
            };
            
            const newStatus = statusMap[paymentStatus.payment_status] || order.status;
            
            if (newStatus !== order.status) {
              await storage.updateOrderByOrderId(order.orderId, { status: newStatus });
            }
            
            results.push({
              orderId: order.orderId,
              previousStatus: order.status,
              newStatus,
              nowpaymentsStatus: paymentStatus.payment_status
            });
          } catch (err) {
            results.push({
              orderId: order.orderId,
              previousStatus: order.status,
              newStatus: order.status,
              error: `Failed: ${err}`
            });
          }
        }
        
        res.json({ 
          success: true, 
          synced: results.length,
          results 
        });
      }
    } catch (error) {
      console.error("Error syncing order status:", error);
      res.status(500).json({ error: "Failed to sync order status" });
    }
  });

  // Get all registered users (for admin)
  app.get("/api/admin/registered-users", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const token = authHeader.substring(7);
      const session = sessions.get(token);

      if (!session || session.expiresAt < new Date() || session.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const users = await storage.getAllUsers();
      const safeUsers = users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        banned: u.banned,
        createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching registered users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Admin user management - update user (ban, change password, change email)
  app.patch("/api/admin/users/:userId", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const token = authHeader.substring(7);
      const session = sessions.get(token);

      if (!session || session.expiresAt < new Date() || session.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const validatedData = adminUpdateUserSchema.parse(req.body);
      const userId = req.params.userId;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updates: Record<string, any> = {};

      if (validatedData.email !== undefined) {
        // Check if email is already taken
        const existingUser = await storage.getUserByEmail(validatedData.email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: "Email already in use" });
        }
        updates.email = validatedData.email;
      }

      if (validatedData.newPassword !== undefined) {
        updates.password = await hashPassword(validatedData.newPassword);
      }

      if (validatedData.banned !== undefined) {
        updates.banned = validatedData.banned ? 1 : 0;
        // If banning the user, invalidate all their sessions
        if (validatedData.banned) {
          invalidateUserSessions(userId);
        }
      }

      if (Object.keys(updates).length > 0) {
        await storage.updateUser(userId, updates);
      }

      const updatedUser = await storage.getUser(userId);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const safeUser: SafeUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        banned: updatedUser.banned,
        createdAt: updatedUser.createdAt,
      };

      res.json({ success: true, user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || "Validation error" });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:userId", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const token = authHeader.substring(7);
      const session = sessions.get(token);

      if (!session || session.expiresAt < new Date() || session.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const userId = req.params.userId;

      if (session.userId === userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const deletedOrdersCount = await storage.deleteOrdersByEmail(user.email);

      invalidateUserSessions(userId);

      await storage.deleteUser(userId);

      res.json({ success: true, deletedOrders: deletedOrdersCount });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.delete("/api/admin/guest-users/:email", requireAdmin, async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Invalid email address" });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "This is a registered user. Use the registered user delete instead." });
      }
      const deletedOrdersCount = await storage.deleteOrdersByEmail(email);
      res.json({ success: true, deletedOrders: deletedOrdersCount });
    } catch (error) {
      console.error("Error deleting guest user:", error);
      res.status(500).json({ error: "Failed to delete guest user" });
    }
  });

  app.post("/api/orders", paymentLimiter, async (req, res) => {
    try {
      const validatedData = insertOrderSchema.parse(req.body);

      // Verify product exists and has stock
      const product = await storage.getProduct(validatedData.productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const quantity = validatedData.quantity ?? 1;
      if (product.stock < quantity) {
        return res.status(400).json({ error: "Insufficient stock" });
      }

      // Capture client IP address (req.ip uses trust proxy setting)
      const ipAddress = req.ip || 
                        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || 
                        req.headers['x-real-ip']?.toString() || 
                        req.socket.remoteAddress || 
                        'unknown';

      // Create order with IP
      const order = await storage.createOrder({
        ...validatedData,
        ipAddress,
      });

      // Reduce product stock and broadcast update
      const updatedProduct = await storage.updateProduct(product.id, {
        stock: product.stock - quantity,
      });
      
      if (updatedProduct) {
        broadcastProductUpdate("product_updated", updatedProduct);
      }

      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  app.patch("/api/orders/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertOrderSchema.partial().parse(req.body);
      const order = await storage.updateOrder(req.params.id, validatedData);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Broadcast order update to admin subscribers
      broadcastOrderUpdate("order_updated", order);
      notifyTelegramOrder(order, true);
      
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating order:", error);
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteOrder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // Statistics endpoint
  app.get("/api/statistics", async (req, res) => {
    try {
      const statistics = await storage.getStatistics();
      res.json(statistics);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Payment settings endpoints
  app.get("/api/settings/payment", async (req, res) => {
    try {
      res.json({
        apiKeyConfigured: nowPaymentsService.isConfigured(),
        ipnSecretConfigured: nowPaymentsService.isIpnConfigured(),
      });
    } catch (error) {
      console.error("Error fetching payment settings:", error);
      res.status(500).json({ error: "Failed to fetch payment settings" });
    }
  });

  app.post("/api/settings/payment", requireAdmin, async (req, res) => {
    try {
      const { apiKey, ipnSecret } = req.body;

      // Save to environment variables and persist to database
      if (apiKey) {
        process.env.NOWPAYMENTS_API_KEY = apiKey;
        await storage.setSetting("nowpayments_api_key", apiKey);
      }
      if (ipnSecret) {
        process.env.NOWPAYMENTS_IPN_SECRET = ipnSecret;
        await storage.setSetting("nowpayments_ipn_secret", ipnSecret);
      }

      res.json({
        success: true,
        apiKeyConfigured: nowPaymentsService.isConfigured(),
        ipnSecretConfigured: nowPaymentsService.isIpnConfigured(),
      });
    } catch (error) {
      console.error("Error saving payment settings:", error);
      res.status(500).json({ error: "Failed to save payment settings" });
    }
  });

  // Theme settings endpoints (GET is public for visitors to see theme, POST is admin-only)
  app.get("/api/settings/theme", async (req, res) => {
    try {
      const primaryHue = await storage.getSetting("theme_primary_hue");
      const primarySaturation = await storage.getSetting("theme_primary_saturation");
      const primaryLightness = await storage.getSetting("theme_primary_lightness");
      res.json({
        primaryHue: primaryHue ? parseInt(primaryHue) : 185,
        primarySaturation: primarySaturation ? parseInt(primarySaturation) : 80,
        primaryLightness: primaryLightness ? parseInt(primaryLightness) : 50,
      });
    } catch (error) {
      console.error("Error fetching theme settings:", error);
      res.status(500).json({ error: "Failed to fetch theme settings" });
    }
  });

  app.post("/api/settings/theme", requireAdmin, async (req, res) => {
    try {
      const { primaryHue, primarySaturation, primaryLightness } = req.body;
      
      const hue = typeof primaryHue === 'number' ? Math.max(0, Math.min(360, primaryHue)) : undefined;
      const saturation = typeof primarySaturation === 'number' ? Math.max(0, Math.min(100, primarySaturation)) : undefined;
      const lightness = typeof primaryLightness === 'number' ? Math.max(20, Math.min(80, primaryLightness)) : undefined;
      
      if (hue !== undefined) {
        await storage.setSetting("theme_primary_hue", String(hue));
      }
      if (saturation !== undefined) {
        await storage.setSetting("theme_primary_saturation", String(saturation));
      }
      if (lightness !== undefined) {
        await storage.setSetting("theme_primary_lightness", String(lightness));
      }
      
      // Clear server-side theme cache so next HTML request gets new theme
      clearThemeCache();
      
      // Broadcast theme update to all connected clients
      const savedHue = hue ?? (Number(await storage.getSetting("theme_primary_hue")) || 185);
      const savedSaturation = saturation ?? (Number(await storage.getSetting("theme_primary_saturation")) || 80);
      const savedLightness = lightness ?? (Number(await storage.getSetting("theme_primary_lightness")) || 50);
      broadcastThemeUpdate({
        primaryHue: savedHue,
        primarySaturation: savedSaturation,
        primaryLightness: savedLightness
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving theme settings:", error);
      res.status(500).json({ error: "Failed to save theme settings" });
    }
  });

  // Shop settings endpoints
  app.get("/api/settings/shop", async (req, res) => {
    try {
      const shopName = await storage.getSetting("shop_name") || "";
      const shopLogo = await storage.getSetting("shop_logo") || "";
      const bannerUrl = await storage.getSetting("banner_url") || "";
      const announcementEnabled = (await storage.getSetting("announcement_enabled")) === "true";
      const announcementText = await storage.getSetting("announcement_text") || "";
      res.json({ shopName, shopLogo, bannerUrl, announcementEnabled, announcementText });
    } catch (error) {
      console.error("Error fetching shop settings:", error);
      res.status(500).json({ error: "Failed to fetch shop settings" });
    }
  });

  app.post("/api/settings/shop", requireAdmin, async (req, res) => {
    try {
      const { shopName, shopLogo, bannerUrl } = req.body;
      if (shopName !== undefined) {
        await storage.setSetting("shop_name", shopName);
      }
      if (shopLogo !== undefined) {
        await storage.setSetting("shop_logo", shopLogo);
      }
      if (bannerUrl !== undefined) {
        await storage.setSetting("banner_url", bannerUrl);
      }
      const { announcementEnabled, announcementText } = req.body;
      if (announcementEnabled !== undefined) {
        await storage.setSetting("announcement_enabled", String(announcementEnabled));
      }
      if (announcementText !== undefined) {
        await storage.setSetting("announcement_text", announcementText);
      }
      
      // Broadcast shop settings update via WebSocket
      broadcastProductUpdate("settings_updated" as any, { type: "shop" });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving shop settings:", error);
      res.status(500).json({ error: "Failed to save shop settings" });
    }
  });

  // Social widget settings endpoints
  app.get("/api/settings/social", async (req, res) => {
    try {
      const widgetEnabled = await storage.getSetting("social_widget_enabled");
      const widgetTitle = await storage.getSetting("social_widget_title") || "Connect With Us";
      const widgetSubtitle = await storage.getSetting("social_widget_subtitle") || "Get in touch through our channels";
      const linksJson = await storage.getSetting("social_widget_links") || "[]";
      
      let links = [];
      try {
        links = JSON.parse(linksJson);
      } catch {
        links = [];
      }
      
      res.json({ 
        widgetEnabled: widgetEnabled !== "false",
        widgetTitle, 
        widgetSubtitle,
        links 
      });
    } catch (error) {
      console.error("Error fetching social settings:", error);
      res.status(500).json({ error: "Failed to fetch social settings" });
    }
  });

  app.post("/api/settings/social", requireAdmin, async (req, res) => {
    try {
      const { widgetEnabled, widgetTitle, widgetSubtitle, links } = req.body;
      
      if (widgetEnabled !== undefined) {
        await storage.setSetting("social_widget_enabled", widgetEnabled ? "true" : "false");
      }
      if (widgetTitle !== undefined) {
        await storage.setSetting("social_widget_title", widgetTitle);
      }
      if (widgetSubtitle !== undefined) {
        await storage.setSetting("social_widget_subtitle", widgetSubtitle);
      }
      if (links !== undefined) {
        await storage.setSetting("social_widget_links", JSON.stringify(links));
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving social settings:", error);
      res.status(500).json({ error: "Failed to save social settings" });
    }
  });

  // reCAPTCHA settings endpoints
  app.get("/api/settings/recaptcha", async (req, res) => {
    try {
      const siteKey = await storage.getSetting("recaptcha_site_key") || "";
      const secretKey = await storage.getSetting("recaptcha_secret_key") || "";
      res.json({ 
        siteKeyConfigured: !!siteKey,
        secretKeyConfigured: !!secretKey,
        siteKey: siteKey && secretKey ? siteKey : "",
        enabled: !!siteKey && !!secretKey,
      });
    } catch (error) {
      console.error("Error fetching reCAPTCHA settings:", error);
      res.status(500).json({ error: "Failed to fetch reCAPTCHA settings" });
    }
  });

  app.post("/api/settings/recaptcha", requireAdmin, async (req, res) => {
    try {
      const { siteKey, secretKey } = req.body;
      if (siteKey !== undefined) {
        await storage.setSetting("recaptcha_site_key", siteKey);
        process.env.VITE_RECAPTCHA_SITE_KEY = siteKey;
      }
      if (secretKey !== undefined) {
        await storage.setSetting("recaptcha_secret_key", secretKey);
        process.env.RECAPTCHA_SECRET_KEY = secretKey;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving reCAPTCHA settings:", error);
      res.status(500).json({ error: "Failed to save reCAPTCHA settings" });
    }
  });

  // Get available cryptocurrencies
  app.get("/api/status", async (_req, res) => {
    try {
      const statuses: Record<string, any> = {};

      statuses.server = { status: "operational", message: "Server is running" };

      try {
        if (nowPaymentsService.isConfigured()) {
          const apiStatus = await nowPaymentsService.getApiStatus();
          statuses.payment = { 
            status: apiStatus.message === "OK" ? "operational" : "degraded",
            message: apiStatus.message === "OK" ? "Payment gateway is operational" : `Payment gateway: ${apiStatus.message}`,
            configured: true
          };
        } else {
          statuses.payment = { status: "unconfigured", message: "Payment gateway not configured", configured: false };
        }
      } catch (e: any) {
        statuses.payment = { status: "down", message: e.message || "Payment gateway unreachable", configured: nowPaymentsService.isConfigured() };
      }

      try {
        const testResult = await storage.getAllProducts();
        statuses.database = { status: "operational", message: "Database is connected" };
      } catch (e: any) {
        statuses.database = { status: "down", message: e.message || "Database unreachable" };
      }

      const smtpHost = await storage.getSetting("smtp_host");
      const smtpUser = await storage.getSetting("smtp_user");
      if (smtpHost && smtpUser) {
        statuses.email = { status: "operational", message: "SMTP configured", configured: true };
      } else {
        statuses.email = { status: "unconfigured", message: "SMTP not configured", configured: false };
      }

      statuses.websocket = { status: "operational", message: `${productSubscribers.size + statusSubscribers.size} active connections` };

      const overallStatus = Object.values(statuses).some((s: any) => s.status === "down") 
        ? "degraded" 
        : Object.values(statuses).every((s: any) => s.status === "operational" || s.status === "unconfigured") 
          ? "operational" 
          : "degraded";

      res.json({ overall: overallStatus, services: statuses, timestamp: Date.now() });
    } catch (error) {
      console.error("Error fetching status:", error);
      res.status(500).json({ error: "Failed to fetch status" });
    }
  });

  app.get("/api/payments/currencies", async (req, res) => {
    try {
      if (!nowPaymentsService.isConfigured()) {
        return res.status(400).json({ error: "Payment gateway not configured" });
      }
      const currencies = await nowPaymentsService.getAvailableCurrencies();
      res.json({ currencies });
    } catch (error) {
      console.error("Error fetching currencies:", error);
      res.status(500).json({ error: "Failed to fetch currencies" });
    }
  });

  // Create payment
  app.post("/api/payments/create", paymentLimiter, async (req, res) => {
    try {
      if (!nowPaymentsService.isConfigured()) {
        return res.status(400).json({ error: "Payment gateway not configured" });
      }

      const request = z.object({
        currency: z.string().min(1).max(20),
        orderId: z.string().min(1).max(200),
        email: z.string().email().max(320),
        productId: z.string().optional(),
        quantity: z.coerce.number().int().min(1).max(100).optional(),
        items: z.unknown().optional(),
      }).parse(req.body);
      const { currency, orderId, email, productId, quantity, items } = request;

      const requestedItems = checkoutItemsSchema.parse(
        Array.isArray(items) && items.length > 0
          ? items
          : [{ productId, quantity: quantity || 1 }],
      );
      const quantitiesByProduct = new Map<string, number>();
      requestedItems.forEach(item => {
        quantitiesByProduct.set(item.productId, (quantitiesByProduct.get(item.productId) || 0) + item.quantity);
      });

      const checkoutLines = [];
      for (const [requestedProductId, requestedQuantity] of quantitiesByProduct) {
        if (requestedQuantity > 100) {
          return res.status(400).json({ error: "Maximum quantity per product is 100" });
        }
        const product = await storage.getProduct(requestedProductId);
        if (!product || product.enabled !== 1) {
          return res.status(400).json({ error: "A product in your cart is no longer available" });
        }
        if (product.stock < requestedQuantity) {
          return res.status(400).json({ error: `Only ${product.stock} units of ${product.name} are available` });
        }
        checkoutLines.push({
          product,
          quantity: requestedQuantity,
          displayName: product.parentId && product.category?.trim()
            ? `${product.name} - ${product.category.trim()}`
            : product.name,
        });
      }

      const authoritativeAmount = Math.round(
        checkoutLines.reduce((total, line) => total + line.product.price * line.quantity, 0) * 100,
      ) / 100;
      if (authoritativeAmount <= 0) {
        return res.status(400).json({ error: "Invalid cart total" });
      }
      const totalQuantity = checkoutLines.reduce((total, line) => total + line.quantity, 0);
      const orderProductName = checkoutLines.length === 1
        ? checkoutLines[0].displayName
        : `${checkoutLines.length} products`;

      // Capture client IP address
      const ipAddress = req.ip || 
                        req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || 
                        req.headers['x-real-ip']?.toString() || 
                        req.socket.remoteAddress || 
                        'unknown';

      await storage.createOrderWithItems({
        orderId,
        productId: checkoutLines[0].product.id,
        productName: orderProductName,
        quantity: totalQuantity,
        totalAmount: authoritativeAmount,
        status: "creating",
        email,
        createdAt: new Date().toISOString(),
        ipAddress,
      }, checkoutLines.map(line => ({
        orderId,
        productId: line.product.id,
        productName: line.displayName,
        quantity: line.quantity,
        unitPrice: line.product.price,
      })));

      // Construct IPN callback URL using REPLIT_DOMAINS
      const domain = process.env.REPLIT_DOMAINS || process.env.REPLIT_DEV_DOMAIN;
      const ipnCallbackUrl = domain ? `https://${domain}/api/payments/ipn` : undefined;

      let payment;
      try {
        payment = await nowPaymentsService.createPayment({
          price_amount: authoritativeAmount,
          price_currency: "usd",
          pay_currency: currency.toLowerCase(),
          order_id: orderId,
          order_description: `Purchase: ${orderProductName}`,
          ipn_callback_url: ipnCallbackUrl,
        });
      } catch (error) {
        await storage.updateOrderByOrderId(orderId, { status: "failed" });
        throw error;
      }

      const newOrder = await storage.attachPaymentToOrder(orderId, {
        paymentId: payment.payment_id?.toString(),
        payAddress: payment.pay_address,
        payCurrency: payment.pay_currency,
        payAmount: payment.pay_amount,
      });
      if (!newOrder) throw new Error("Order could not be finalized");

      // Broadcast order creation to admin subscribers
      broadcastOrderUpdate("order_created", newOrder);
      
      // Send Telegram notification for new order
      notifyTelegramOrder(newOrder, false);

      res.json({ ...payment, price_amount: authoritativeAmount });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message || "Invalid cart" });
      }
      console.error("Error creating payment:", error);
      res.status(500).json({ error: error.message || "Failed to create payment" });
    }
  });

  // Get payment status
  app.get("/api/payments/:paymentId/status", async (req, res) => {
    try {
      if (!nowPaymentsService.isConfigured()) {
        return res.status(400).json({ error: "Payment gateway not configured" });
      }

      const status = await nowPaymentsService.getPaymentStatus(req.params.paymentId);
      res.json(status);
    } catch (error: any) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({ error: error.message || "Failed to fetch payment status" });
    }
  });

  // IPN callback endpoint for NOWPayments webhooks
  app.post("/api/payments/ipn", async (req, res) => {
    try {
      const signature = req.headers["x-nowpayments-sig"] as string;
      
      if (!signature) {
        return res.status(400).json({ error: "Missing signature" });
      }

      const rawBody = JSON.stringify(req.body);
      
      if (!nowPaymentsService.verifyIpnSignature(rawBody, signature)) {
        return res.status(400).json({ error: "Invalid signature" });
      }

      const { payment_id, payment_status, order_id } = req.body;

      // Update order status based on payment status
      if (order_id) {
        const newStatus = payment_status === "finished" ? "completed" 
          : payment_status === "failed" ? "failed"
          : payment_status === "expired" ? "expired"
          : payment_status === "confirming" ? "confirming"
          : "pending";

        const order = await storage.getOrderByOrderId(order_id);
        
        // Complete fulfillment (including retrying delivery after stock was claimed).
        if (newStatus === "completed" && order) {
          await fulfillCompletedOrder(order_id);
        } else if (order && order.status !== newStatus) {
          const updatedOrder = await storage.updateOrderByOrderId(order_id, { status: newStatus });
          if (updatedOrder) {
            broadcastOrderUpdate("order_updated", updatedOrder);
            notifyTelegramOrder(updatedOrder, true);
          }
        }
      }

      // Broadcast to WebSocket subscribers
      if (payment_id) {
        broadcastPaymentStatus(payment_id.toString(), req.body);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error processing IPN:", error);
      res.status(500).json({ error: "Failed to process IPN" });
    }
  });

  // Email Template endpoints
  app.get("/api/email-templates", requireAdmin, async (req, res) => {
    try {
      const templates = await storage.getAllEmailTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  app.get("/api/email-templates/:id", requireAdmin, async (req, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching email template:", error);
      res.status(500).json({ error: "Failed to fetch email template" });
    }
  });

  app.post("/api/email-templates", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertEmailTemplateSchema.parse(req.body);
      const template = await storage.createEmailTemplate(validatedData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating email template:", error);
      res.status(500).json({ error: "Failed to create email template" });
    }
  });

  app.patch("/api/email-templates/:id", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertEmailTemplateSchema.partial().parse(req.body);
      const template = await storage.updateEmailTemplate(req.params.id, validatedData);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating email template:", error);
      res.status(500).json({ error: "Failed to update email template" });
    }
  });

  app.delete("/api/email-templates/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteEmailTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting email template:", error);
      res.status(500).json({ error: "Failed to delete email template" });
    }
  });

  // Preview email template with sample data
  app.post("/api/email-templates/:id/preview", requireAdmin, async (req, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      const themeColors = await getThemeColors();
      const shopName = await storage.getSetting("shop_name") || "Store";

      const sampleData: Record<string, string> = {
        orderId: "ORD-123456",
        productName: "Sample Product",
        totalAmount: "49.99",
        stockItem: "sample@example.com:password123",
        shopName,
        themeColor: themeColors.hex,
        themeRgba: themeColors.rgba02,
      };

      let previewHtml = template.htmlContent;
      let previewSubject = template.subject;
      
      for (const [key, value] of Object.entries(sampleData)) {
        previewHtml = previewHtml.replace(new RegExp(`{{${key}}}`, "g"), value);
        previewSubject = previewSubject.replace(new RegExp(`{{${key}}}`, "g"), value);
      }

      res.json({ subject: previewSubject, html: previewHtml });
    } catch (error) {
      console.error("Error previewing email template:", error);
      res.status(500).json({ error: "Failed to preview email template" });
    }
  });

  // Email settings endpoint
  app.get("/api/settings/email", async (req, res) => {
    try {
      res.json({
        configured: emailService.isConfigured(),
      });
    } catch (error) {
      console.error("Error fetching email settings:", error);
      res.status(500).json({ error: "Failed to fetch email settings" });
    }
  });

  // SMTP settings endpoints
  app.get("/api/settings/smtp", requireAdmin, async (req, res) => {
    try {
      const config = emailService.getConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching SMTP settings:", error);
      res.status(500).json({ error: "Failed to fetch SMTP settings" });
    }
  });

  app.post("/api/settings/smtp", requireAdmin, async (req, res) => {
    try {
      const { host, port, secure, user, password, fromEmail, fromName } = req.body;

      // Save to database
      if (host !== undefined) await storage.setSetting("smtp_host", host);
      if (port !== undefined) await storage.setSetting("smtp_port", port.toString());
      if (secure !== undefined) await storage.setSetting("smtp_secure", secure.toString());
      if (user !== undefined) await storage.setSetting("smtp_user", user);
      if (password !== undefined && password !== "") await storage.setSetting("smtp_password", password);
      if (fromEmail !== undefined) await storage.setSetting("smtp_from_email", fromEmail);
      if (fromName !== undefined) await storage.setSetting("smtp_from_name", fromName);

      // Update the email service config
      emailService.updateConfig({
        host,
        port: port || 587,
        secure: secure || false,
        user,
        password: password || (await storage.getSetting("smtp_password")) || undefined,
        fromEmail,
        fromName,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving SMTP settings:", error);
      res.status(500).json({ error: "Failed to save SMTP settings" });
    }
  });

  app.post("/api/settings/smtp/test", requireAdmin, async (req, res) => {
    try {
      const result = await emailService.testConnection();
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ error: result.error || "Connection test failed" });
      }
    } catch (error: any) {
      console.error("Error testing SMTP connection:", error);
      res.status(500).json({ error: error.message || "Failed to test SMTP connection" });
    }
  });

  const updateSubscribers = new Set<WebSocket>();
  let updateLock = false;

  const broadcastUpdateProgress = (progress: any) => {
    const message = JSON.stringify(progress);
    updateSubscribers.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  };

  let memoryGithubUrl = "";
  let memoryRepoFingerprint = "";

  app.get("/api/admin/update/settings", requireAdmin, async (req, res) => {
    try {
      const currentCommit = await storage.getSetting("update_current_commit") || "";
      const lastChecked = await storage.getSetting("update_last_checked") || "";
      const lastUpdated = await storage.getSetting("update_last_updated") || "";

      res.json({ connected: !!memoryGithubUrl, repoDisplay: "", currentCommit, lastChecked, lastUpdated });
    } catch (error) {
      console.error("Error fetching update settings:", error);
      res.status(500).json({ error: "Failed to fetch update settings" });
    }
  });

  app.post("/api/admin/update/set-repo", requireAdmin, async (req, res) => {
    try {
      const { githubUrl } = req.body;
      if (!githubUrl) {
        return res.status(400).json({ error: "GitHub URL is required" });
      }

      const validation = await validateGitHubRepo(githubUrl);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      memoryGithubUrl = githubUrl.trim();
      memoryRepoFingerprint = validation.fingerprint!;
      res.json({ success: true, owner: validation.owner, repo: validation.repo, branch: validation.branch });
    } catch (error: any) {
      console.error("Error setting repo:", error);
      res.status(500).json({ error: error.message || "Failed to validate repository" });
    }
  });

  app.post("/api/admin/update/check", requireAdmin, async (req, res) => {
    try {
      if (!memoryGithubUrl) {
        return res.status(400).json({ error: "No GitHub repository configured. Please enter your repository URL first." });
      }

      const currentCommit = await storage.getSetting("update_current_commit") || "";
      const updateInfo = await checkForUpdates(memoryGithubUrl, currentCommit);

      await storage.setSetting("update_last_checked", new Date().toISOString());
      const { repoUrl: _stripped, ...safeInfo } = updateInfo;
      res.json(safeInfo);
    } catch (error: any) {
      console.error("Error checking for updates:", error);
      res.status(500).json({ error: error.message || "Failed to check for updates" });
    }
  });

  app.post("/api/admin/update/apply", requireAdmin, async (req, res) => {
    try {
      if (updateLock) {
        return res.status(409).json({ error: "An update is already in progress" });
      }

      if (!memoryGithubUrl) {
        return res.status(400).json({ error: "No GitHub repository configured" });
      }

      if (memoryRepoFingerprint) {
        const validation = await validateGitHubRepo(memoryGithubUrl);
        if (!validation.valid || !validation.fingerprint || validation.fingerprint !== memoryRepoFingerprint) {
          return res.status(403).json({ error: "Repository identity verification failed. The repo URL may have been tampered with. Please re-connect the repository." });
        }
      }

      updateLock = true;
      const jobId = `update_${Date.now()}`;
      res.json({ jobId, started: true });

      try {
        const result = await applyUpdate(memoryGithubUrl, jobId, broadcastUpdateProgress);

        if (result.success) {
          await storage.setSetting("update_current_commit", result.newCommit);
          await storage.setSetting("update_last_updated", new Date().toISOString());
          memoryGithubUrl = "";
          memoryRepoFingerprint = "";
        }
      } finally {
        updateLock = false;
      }
    } catch (error: any) {
      updateLock = false;
      console.error("Error applying update:", error);
      broadcastUpdateProgress({
        jobId: "update_error",
        type: "error",
        progress: 0,
        message: error.message || "Update failed",
      });
    }
  });

  app.get("/api/admin/update/progress", requireAdmin, async (req, res) => {
    const progress = getLatestProgress();
    if (progress) {
      res.json(progress);
    } else {
      res.json({ jobId: "", type: "idle", progress: 0, message: "" });
    }
  });

  app.post("/api/admin/update/progress/clear", requireAdmin, async (req, res) => {
    clearProgress();
    res.json({ success: true });
  });

  // Database backup subscribers
  const databaseSubscribers = new Set<WebSocket>();

  const broadcastDatabaseProgress = (progress: BackupProgress) => {
    const message = JSON.stringify(progress);
    databaseSubscribers.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  };

  // Database settings endpoints
  app.get("/api/database/settings", requireAdmin, async (req, res) => {
    try {
      const encryptedToken = await storage.getSetting("telegram_bot_token");
      const telegramChannelId = await storage.getSetting("telegram_channel_id");
      const backupIntervalHours = await storage.getSetting("backup_interval_hours");
      const autoBackupEnabled = await storage.getSetting("auto_backup_enabled");

      const hasToken = encryptedToken && encryptedToken.length > 0;

      res.json({
        settings: {
          telegramBotToken: hasToken ? "********" : "",
          telegramChannelId: telegramChannelId || "",
          backupIntervalHours: parseInt(backupIntervalHours || "5"),
          autoBackupEnabled: autoBackupEnabled === "true",
          hasToken,
        },
      });
    } catch (error) {
      console.error("Error fetching database settings:", error);
      res.status(500).json({ error: "Failed to fetch database settings" });
    }
  });

  app.post("/api/database/settings", requireAdmin, async (req, res) => {
    try {
      const data = databaseBackupSettingsSchema.parse(req.body);

      if (data.telegramBotToken !== undefined && data.telegramBotToken !== "********") {
        const encryptedToken = data.telegramBotToken ? encryptToken(data.telegramBotToken) : "";
        await storage.setSetting("telegram_bot_token", encryptedToken);
      }
      if (data.telegramChannelId !== undefined) {
        await storage.setSetting("telegram_channel_id", data.telegramChannelId);
      }
      if (data.backupIntervalHours !== undefined) {
        await storage.setSetting("backup_interval_hours", data.backupIntervalHours.toString());
      }
      if (data.autoBackupEnabled !== undefined) {
        await storage.setSetting("auto_backup_enabled", data.autoBackupEnabled.toString());
        
        if (data.autoBackupEnabled && data.backupIntervalHours) {
          const encryptedToken = await storage.getSetting("telegram_bot_token");
          const channelId = await storage.getSetting("telegram_channel_id");
          
          if (encryptedToken && channelId) {
            const botToken = decryptToken(encryptedToken);
            scheduleAutoBackup(data.backupIntervalHours, async () => {
              const jobId = generateJobId();
              const exportData = await exportDatabase(jobId, broadcastDatabaseProgress);
              const jsonString = JSON.stringify(exportData, null, 2);
              const filename = `buybit-backup-${new Date().toISOString().split("T")[0]}.json`;
              await sendBackupToTelegram(botToken, channelId, jsonString, filename);
            });
          }
        } else {
          scheduleAutoBackup(0, async () => {});
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving database settings:", error);
      res.status(500).json({ error: "Failed to save database settings" });
    }
  });

  app.post("/api/database/export", requireAdmin, async (req, res) => {
    try {
      const jobId = generateJobId();
      
      const exportData = await exportDatabase(jobId, broadcastDatabaseProgress);
      
      const jsonString = JSON.stringify(exportData, null, 2);
      
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=buybit-backup-${new Date().toISOString().split("T")[0]}.json`);
      res.send(jsonString);
    } catch (error) {
      console.error("Error exporting database:", error);
      res.status(500).json({ error: "Failed to export database" });
    }
  });

  app.post("/api/database/import", requireAdmin, async (req, res) => {
    try {
      const jobId = generateJobId();
      const importData = req.body;

      if (!importData.version || !importData.tables) {
        return res.status(400).json({ error: "Invalid import file format" });
      }

      const result = await importDatabase(jobId, importData, broadcastDatabaseProgress);
      
      // After import, reload settings into environment variables and services
      // This ensures NOWPayments, SMTP, Telegram settings are immediately active
      try {
        const apiKey = await storage.getSetting("nowpayments_api_key");
        const ipnSecret = await storage.getSetting("nowpayments_ipn_secret");
        const recaptchaSiteKey = await storage.getSetting("recaptcha_site_key");
        const recaptchaSecretKey = await storage.getSetting("recaptcha_secret_key");
        
        if (apiKey) {
          process.env.NOWPAYMENTS_API_KEY = apiKey;
          console.log("Reloaded NOWPayments API key after import");
        }
        if (ipnSecret) {
          process.env.NOWPAYMENTS_IPN_SECRET = ipnSecret;
          console.log("Reloaded NOWPayments IPN secret after import");
        }
        if (recaptchaSiteKey) {
          process.env.VITE_RECAPTCHA_SITE_KEY = recaptchaSiteKey;
        }
        if (recaptchaSecretKey) {
          process.env.RECAPTCHA_SECRET_KEY = recaptchaSecretKey;
        }

        // Reload SMTP settings
        const smtpHost = await storage.getSetting("smtp_host");
        const smtpPort = await storage.getSetting("smtp_port");
        const smtpSecure = await storage.getSetting("smtp_secure");
        const smtpUser = await storage.getSetting("smtp_user");
        const smtpPassword = await storage.getSetting("smtp_password");
        const smtpFromEmail = await storage.getSetting("smtp_from_email");
        const smtpFromName = await storage.getSetting("smtp_from_name");

        if (smtpHost && smtpUser && smtpPassword) {
          emailService.updateConfig({
            host: smtpHost,
            port: parseInt(smtpPort || "587"),
            secure: smtpSecure === "true",
            user: smtpUser,
            password: smtpPassword,
            fromEmail: smtpFromEmail || undefined,
            fromName: smtpFromName || undefined,
          });
          console.log("Reloaded SMTP settings after import");
        }
        
        console.log("Settings reloaded successfully after database import");
      } catch (settingsError) {
        console.error("Error reloading settings after import:", settingsError);
        // Don't fail the import, just log the error
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error importing database:", error);
      res.status(500).json({ error: "Failed to import database" });
    }
  });

  app.post("/api/database/telegram/test", requireAdmin, async (req, res) => {
    try {
      let { botToken, channelId, useStored } = req.body;

      if (useStored) {
        const encryptedToken = await storage.getSetting("telegram_bot_token");
        const storedChannelId = await storage.getSetting("telegram_channel_id");
        
        if (!encryptedToken || !storedChannelId) {
          return res.status(400).json({ success: false, message: "No stored Telegram settings found" });
        }
        
        botToken = decryptToken(encryptedToken);
        channelId = storedChannelId;
      }

      if (!botToken || !channelId) {
        return res.status(400).json({ success: false, message: "Bot token and channel ID are required" });
      }

      const result = await testTelegramConnection(botToken, channelId);
      res.json(result);
    } catch (error) {
      console.error("Error testing Telegram connection:", error);
      res.status(500).json({ success: false, message: "Failed to test Telegram connection" });
    }
  });

  app.post("/api/database/telegram/send-backup", requireAdmin, async (req, res) => {
    try {
      let { botToken, channelId, useStored } = req.body;

      if (useStored) {
        const encryptedToken = await storage.getSetting("telegram_bot_token");
        const storedChannelId = await storage.getSetting("telegram_channel_id");
        
        if (!encryptedToken || !storedChannelId) {
          return res.status(400).json({ success: false, message: "No stored Telegram settings found" });
        }
        
        botToken = decryptToken(encryptedToken);
        channelId = storedChannelId;
      }

      if (!botToken || !channelId) {
        return res.status(400).json({ success: false, message: "Bot token and channel ID are required" });
      }

      const jobId = generateJobId();
      
      const exportData = await exportDatabase(jobId, broadcastDatabaseProgress);
      const jsonString = JSON.stringify(exportData, null, 2);
      const filename = `buybit-backup-${new Date().toISOString().split("T")[0]}.json`;

      const result = await sendBackupToTelegram(botToken, channelId, jsonString, filename, broadcastDatabaseProgress, jobId);
      
      res.json(result);
    } catch (error) {
      console.error("Error sending backup to Telegram:", error);
      res.status(500).json({ success: false, message: "Failed to send backup to Telegram" });
    }
  });

  // WebSocket servers using noServer mode to avoid intercepting Vite HMR upgrades
  const wss = new WebSocketServer({ noServer: true });
  // Admin WS endpoints accept the token via Sec-WebSocket-Protocol; we must
  // echo back the first requested subprotocol or browsers will reject the handshake.
  const echoProto = (protocols: Set<string>) => {
    const first = protocols.values().next().value;
    return first || false;
  };
  const ordersWss = new WebSocketServer({ noServer: true, handleProtocols: echoProto });
  const productsWss = new WebSocketServer({ noServer: true });
  const sessionWss = new WebSocketServer({ noServer: true });
  const databaseWss = new WebSocketServer({ noServer: true, handleProtocols: echoProto });
  const themeWss = new WebSocketServer({ noServer: true });
  const reviewsWss = new WebSocketServer({ noServer: true });
  const statusWss = new WebSocketServer({ noServer: true });
  const updateWss = new WebSocketServer({ noServer: true, handleProtocols: echoProto });

  // Manual WebSocket upgrade router — only handle /ws/* paths, leave others for Vite HMR
  // Admin-only WS endpoints stream sensitive PII (orders, DB ops, update progress)
  // and MUST require a valid admin session token at handshake time.
  const ADMIN_WS_PATHS = new Set(["/ws/orders", "/ws/database", "/ws/updates"]);

  httpServer.on("upgrade", (req, socket, head) => {
    const parsed = req.url ? new URL(req.url, "http://localhost") : null;
    const pathname = parsed?.pathname || "";
    if (!pathname.startsWith("/ws/")) return; // Let Vite handle non-/ws/ upgrades

    const wsMap: Record<string, WebSocketServer> = {
      "/ws/payments": wss,
      "/ws/orders": ordersWss,
      "/ws/products": productsWss,
      "/ws/session": sessionWss,
      "/ws/database": databaseWss,
      "/ws/theme": themeWss,
      "/ws/reviews": reviewsWss,
      "/ws/status": statusWss,
      "/ws/updates": updateWss,
    };
    const server = wsMap[pathname];
    if (!server) {
      socket.destroy();
      return;
    }

    // Enforce admin auth on sensitive WS endpoints.
    // Token is read from the Sec-WebSocket-Protocol header (preferred — not
    // logged by proxies) with a fallback to ?token= query string.
    let adminToken: string | undefined;
    if (ADMIN_WS_PATHS.has(pathname)) {
      const protoHeader = req.headers["sec-websocket-protocol"] as string | undefined;
      const protoToken = protoHeader
        ? protoHeader.split(",").map((p) => p.trim()).find((p) => p.length > 0)
        : undefined;
      adminToken = protoToken || parsed?.searchParams.get("token") || undefined;

      const session = adminToken ? sessions.get(adminToken) : undefined;
      if (!session || session.expiresAt < new Date() || session.role !== "admin") {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    server.handleUpgrade(req, socket as any, head, (ws) => {
      // Bind admin WS to its session token so revocation force-closes it.
      if (adminToken) {
        registerAdminWs(adminToken, ws);
      }
      server.emit("connection", ws, req);
    });
  });

  reviewsWss.on("connection", (ws) => {
    reviewSubscribers.add(ws);
    
    ws.on("close", () => {
      reviewSubscribers.delete(ws);
    });
    
    ws.on("error", () => {
      reviewSubscribers.delete(ws);
    });
  });

  statusWss.on("connection", async (ws) => {
    statusSubscribers.add(ws);
    
    try {
      const statuses: Record<string, any> = {};
      statuses.server = { status: "operational", message: "Server is running" };
      try {
        if (nowPaymentsService.isConfigured()) {
          const apiStatus = await nowPaymentsService.getApiStatus();
          statuses.payment = { 
            status: apiStatus.message === "OK" ? "operational" : "degraded",
            message: apiStatus.message === "OK" ? "Payment gateway is operational" : `Payment gateway: ${apiStatus.message}`,
            configured: true
          };
        } else {
          statuses.payment = { status: "unconfigured", message: "Payment gateway not configured", configured: false };
        }
      } catch (e: any) {
        statuses.payment = { status: "down", message: e.message || "Payment gateway unreachable", configured: nowPaymentsService.isConfigured() };
      }
      try {
        await storage.getAllProducts();
        statuses.database = { status: "operational", message: "Database is connected" };
      } catch (e: any) {
        statuses.database = { status: "down", message: e.message || "Database unreachable" };
      }
      const smtpHost = await storage.getSetting("smtp_host");
      const smtpUser = await storage.getSetting("smtp_user");
      if (smtpHost && smtpUser) {
        statuses.email = { status: "operational", message: "SMTP configured", configured: true };
      } else {
        statuses.email = { status: "unconfigured", message: "SMTP not configured", configured: false };
      }
      statuses.websocket = { status: "operational", message: `${productSubscribers.size + statusSubscribers.size} active connections` };
      const overallStatus = Object.values(statuses).some((s: any) => s.status === "down") 
        ? "degraded" 
        : Object.values(statuses).every((s: any) => s.status === "operational" || s.status === "unconfigured") 
          ? "operational" 
          : "degraded";
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "status_update", overall: overallStatus, services: statuses, timestamp: Date.now() }));
      }
    } catch (e) {}
    
    ws.on("close", () => {
      statusSubscribers.delete(ws);
    });
    
    ws.on("error", () => {
      statusSubscribers.delete(ws);
    });
  });

  async function broadcastStatus() {
    if (statusSubscribers.size === 0) return;
    try {
      const statuses: Record<string, any> = {};
      statuses.server = { status: "operational", message: "Server is running" };
      
      try {
        if (nowPaymentsService.isConfigured()) {
          const apiStatus = await nowPaymentsService.getApiStatus();
          statuses.payment = { 
            status: apiStatus.message === "OK" ? "operational" : "degraded",
            message: apiStatus.message === "OK" ? "Payment gateway is operational" : `Payment gateway: ${apiStatus.message}`,
            configured: true
          };
        } else {
          statuses.payment = { status: "unconfigured", message: "Payment gateway not configured", configured: false };
        }
      } catch (e: any) {
        statuses.payment = { status: "down", message: e.message || "Payment gateway unreachable", configured: nowPaymentsService.isConfigured() };
      }
      
      try {
        await storage.getAllProducts();
        statuses.database = { status: "operational", message: "Database is connected" };
      } catch (e: any) {
        statuses.database = { status: "down", message: e.message || "Database unreachable" };
      }
      
      const smtpHost = await storage.getSetting("smtp_host");
      const smtpUser = await storage.getSetting("smtp_user");
      if (smtpHost && smtpUser) {
        statuses.email = { status: "operational", message: "SMTP configured", configured: true };
      } else {
        statuses.email = { status: "unconfigured", message: "SMTP not configured", configured: false };
      }
      
      statuses.websocket = { status: "operational", message: `${productSubscribers.size + statusSubscribers.size} active connections` };
      
      const overallStatus = Object.values(statuses).some((s: any) => s.status === "down") 
        ? "degraded" 
        : Object.values(statuses).every((s: any) => s.status === "operational" || s.status === "unconfigured") 
          ? "operational" 
          : "degraded";
      
      const message = JSON.stringify({ type: "status_update", overall: overallStatus, services: statuses, timestamp: Date.now() });
      statusSubscribers.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    } catch (e) {
      // Silently handle broadcast errors
    }
  }
  
  setInterval(broadcastStatus, 30000);

  themeWss.on("connection", (ws) => {
    themeSubscribers.add(ws);
    
    ws.on("close", () => {
      themeSubscribers.delete(ws);
    });
    
    ws.on("error", () => {
      themeSubscribers.delete(ws);
    });
  });

  databaseWss.on("connection", (ws) => {
    databaseSubscribers.add(ws);
    
    ws.on("close", () => {
      databaseSubscribers.delete(ws);
    });
    
    ws.on("error", () => {
      databaseSubscribers.delete(ws);
    });
  });

  updateWss.on("connection", (ws) => {
    updateSubscribers.add(ws);

    ws.on("close", () => {
      updateSubscribers.delete(ws);
    });

    ws.on("error", () => {
      updateSubscribers.delete(ws);
    });
  });
  
  sessionWss.on("connection", (ws) => {
    let sessionToken: string | null = null;
    
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "auth" && data.token) {
          sessionToken = data.token;
          // Register this WebSocket for session notifications
          sessionSubscribers.set(data.token, ws);
        }
      } catch (e) {
        console.error("Session WebSocket message error:", e);
      }
    });
    
    ws.on("close", () => {
      if (sessionToken) {
        sessionSubscribers.delete(sessionToken);
      }
    });
    
    ws.on("error", () => {
      if (sessionToken) {
        sessionSubscribers.delete(sessionToken);
      }
    });
  });
  
  productsWss.on("connection", (ws) => {
    productSubscribers.add(ws);
    
    ws.on("close", () => {
      productSubscribers.delete(ws);
    });
    
    ws.on("error", () => {
      productSubscribers.delete(ws);
    });
  });
  
  ordersWss.on("connection", (ws) => {
    orderSubscribers.add(ws);
    
    ws.on("close", () => {
      orderSubscribers.delete(ws);
    });
    
    ws.on("error", () => {
      orderSubscribers.delete(ws);
    });
  });

  wss.on("connection", (ws) => {
    let subscribedPaymentId: string | null = null;

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "subscribe" && data.paymentId) {
          subscribedPaymentId = data.paymentId;

          if (!paymentSubscriptions.has(data.paymentId)) {
            paymentSubscriptions.set(data.paymentId, new Set());
          }
          paymentSubscriptions.get(data.paymentId)!.add(ws);

          // Send current status immediately
          if (nowPaymentsService.isConfigured()) {
            try {
              const status = await nowPaymentsService.getPaymentStatus(data.paymentId);
              ws.send(JSON.stringify({ type: "payment_status", paymentId: data.paymentId, status }));
            } catch (e) {
              // Payment might not exist yet
            }
          }
        }

        if (data.type === "unsubscribe" && subscribedPaymentId) {
          const subscribers = paymentSubscriptions.get(subscribedPaymentId);
          if (subscribers) {
            subscribers.delete(ws);
            if (subscribers.size === 0) {
              paymentSubscriptions.delete(subscribedPaymentId);
            }
          }
          subscribedPaymentId = null;
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    });

    ws.on("close", () => {
      if (subscribedPaymentId) {
        const subscribers = paymentSubscriptions.get(subscribedPaymentId);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            paymentSubscriptions.delete(subscribedPaymentId);
          }
        }
      }
    });
  });

  // Polling endpoint for payment status (fallback for WebSocket)
  app.get("/api/payments/:paymentId/poll", async (req, res) => {
    try {
      if (!nowPaymentsService.isConfigured()) {
        return res.status(400).json({ error: "Payment gateway not configured" });
      }

      const status = await nowPaymentsService.getPaymentStatus(req.params.paymentId);
      
      // Also broadcast to WebSocket subscribers
      broadcastPaymentStatus(req.params.paymentId, status);
      
      // Sync order status in database if payment status has changed
      if (status.order_id && status.payment_status) {
        const newStatus = status.payment_status === "finished" ? "completed" 
          : status.payment_status === "failed" ? "failed"
          : status.payment_status === "expired" ? "expired"
          : status.payment_status === "confirming" ? "confirming"
          : status.payment_status === "sending" ? "confirming"
          : status.payment_status === "confirmed" ? "confirming"
          : "pending";

        const order = await storage.getOrderByOrderId(status.order_id);
        
        // Only process if order exists and status has changed
        if (order && order.status !== newStatus) {
          // Complete fulfillment (including retrying delivery after stock was claimed).
          if (newStatus === "completed") {
            await fulfillCompletedOrder(status.order_id);
          } else {
            // Update status for non-completed states
            const updatedOrder = await storage.updateOrderByOrderId(status.order_id, { status: newStatus });
            if (updatedOrder) {
              broadcastOrderUpdate("order_updated", updatedOrder);
              notifyTelegramOrder(updatedOrder, true);
            }
          }
        }
      }
      
      res.json(status);
    } catch (error: any) {
      console.error("Error polling payment status:", error);
      res.status(500).json({ error: error.message || "Failed to poll payment status" });
    }
  });

  // Start automatic background polling for pending orders
  startOrderPolling();

  return httpServer;
}
