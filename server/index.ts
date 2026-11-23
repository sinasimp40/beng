import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { emailService } from "./email";
import { initializeEncryption } from "./services/databaseBackupService";
import { setupSecurity } from "./security";

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", reason);
});

const app = express();

// Trust ONLY the first hop (Replit / Nginx). Setting this to `true` would
// trust any client-supplied X-Forwarded-For header, letting attackers spoof
// their IP and bypass the rate limiter / brute-force lockouts on /api/auth/*.
app.set('trust proxy', 1);

setupSecurity(app);

// Default email template HTML matching the payment success modal design
const DEFAULT_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #000000; border: 1px solid {{themeRgba}}; border-radius: 16px; overflow: hidden;">
          
          <!-- Success Icon Section -->
          <tr>
            <td align="center" style="padding: 48px 32px 24px 32px;">
              <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.1)); border: 1px solid rgba(34, 197, 94, 0.3); margin: 0 auto;">
                <span style="font-size: 40px; line-height: 80px; display: block; text-align: center;">&#127881;</span>
              </div>
              <h1 style="margin: 24px 0 8px 0; font-size: 28px; font-weight: 700; color: #ffffff;">Payment Successful</h1>
              <p style="margin: 0; color: #9ca3af; font-size: 14px;">Your order has been confirmed</p>
            </td>
          </tr>
          
          <!-- Order Details Card -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: rgba(17, 24, 39, 0.5); border: 1px solid #1f2937; border-radius: 12px;">
                
                <!-- Order ID -->
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Order ID</td>
                        <td align="right" style="color: {{themeColor}}; font-family: monospace; font-size: 12px;">{{orderId}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Divider -->
                <tr><td style="padding: 0 20px;"><div style="height: 1px; background-color: #1f2937;"></div></td></tr>
                
                <!-- Product -->
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Product</td>
                        <td align="right" style="color: #ffffff; font-weight: 500; font-size: 14px; max-width: 180px;">{{productName}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Amount -->
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Amount Paid</td>
                        <td align="right" style="color: {{themeColor}}; font-weight: 500; font-size: 14px;">\${{totalAmount}}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Divider -->
                <tr><td style="padding: 0 20px;"><div style="height: 1px; background-color: #1f2937;"></div></td></tr>
                
                <!-- Your Item Section -->
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Your Item</p>
                    <div style="background-color: rgba(0, 0, 0, 0.5); border: 1px solid {{themeRgba}}; border-radius: 8px; padding: 16px;">
                      <code style="color: {{themeColor}}; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-all; line-height: 1.5;">{{stockItem}}</code>
                    </div>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 0 32px 32px 32px;">
              <p style="margin: 0; color: #4b5563; font-size: 12px;">Thank you for your purchase</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Load saved settings from database on startup
async function initializeSettings() {
  try {
    const apiKey = await storage.getSetting("nowpayments_api_key");
    const ipnSecret = await storage.getSetting("nowpayments_ipn_secret");
    const recaptchaSiteKey = await storage.getSetting("recaptcha_site_key");
    const recaptchaSecretKey = await storage.getSetting("recaptcha_secret_key");
    
    if (apiKey) {
      process.env.NOWPAYMENTS_API_KEY = apiKey;
      console.log("Loaded NOWPayments API key from database");
    }
    if (ipnSecret) {
      process.env.NOWPAYMENTS_IPN_SECRET = ipnSecret;
      console.log("Loaded NOWPayments IPN secret from database");
    }
    if (recaptchaSiteKey) {
      process.env.VITE_RECAPTCHA_SITE_KEY = recaptchaSiteKey;
    }
    if (recaptchaSecretKey) {
      process.env.RECAPTCHA_SECRET_KEY = recaptchaSecretKey;
    }

    // Load SMTP settings
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
      console.log("Loaded SMTP settings from database");
    }

    // Seed default email template if none exists
    const existingTemplates = await storage.getAllEmailTemplates();
    if (existingTemplates.length === 0) {
      await storage.createEmailTemplate({
        name: "Order Confirmation",
        subject: "Your Order is Complete - {{productName}}",
        htmlContent: DEFAULT_EMAIL_TEMPLATE,
        isDefault: 1,
      });
      console.log("Created default email template");
    }
  } catch (error) {
    console.error("Error loading settings from database:", error);
  }
}
const httpServer = createServer(app);
httpServer.setMaxListeners(20);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Cap request body size to prevent memory-exhaustion DoS. Database import is
// the largest legitimate body and is admin-only, so 25mb is plenty.
app.use(
  express.json({
    limit: "25mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    console.log("[Startup] Initializing server...");

    console.log("[Startup] Loading settings from database...");
    await initializeSettings();
    
    console.log("[Startup] Initializing encryption...");
    await initializeEncryption();
    
    console.log("[Startup] Registering routes...");
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      if (!res.headersSent) {
        res.status(status).json({ message });
      }
      console.error("[Express Error]", err.stack || err.message || err);
    });

    if (process.env.NODE_ENV === "production") {
      console.log("[Startup] Serving static files (production)...");
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  } catch (error) {
    console.error("[FATAL] Server failed to start:", error);
    process.exit(1);
  }
})();
