import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { storage } from "./storage";

interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
}

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

async function getThemeColors(): Promise<{ hex: string; rgba02: string }> {
  const h = parseInt(await storage.getSetting("theme_primary_hue") || "185");
  const s = parseInt(await storage.getSetting("theme_primary_saturation") || "80");
  const l = parseInt(await storage.getSetting("theme_primary_lightness") || "50");
  return {
    hex: hslToHex(h, s, l),
    rgba02: hslToRgba(h, s, l, 0.2),
  };
}

class EmailService {
  private config: SmtpConfig = {};
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.config.fromEmail = process.env.EMAIL_FROM || "noreply@example.com";
    this.config.fromName = process.env.EMAIL_FROM_NAME || "Store";
  }

  isConfigured(): boolean {
    return !!(this.config.host && this.config.user && this.config.password);
  }

  updateConfig(config: Partial<SmtpConfig>) {
    if (config.host !== undefined) this.config.host = config.host;
    if (config.port !== undefined) this.config.port = config.port;
    if (config.secure !== undefined) this.config.secure = config.secure;
    if (config.user !== undefined) this.config.user = config.user;
    if (config.password !== undefined) this.config.password = config.password;
    if (config.fromEmail !== undefined) this.config.fromEmail = config.fromEmail;
    if (config.fromName !== undefined) this.config.fromName = config.fromName;

    if (this.config.host && this.config.user && this.config.password) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port || 587,
        secure: this.config.secure || false,
        auth: {
          user: this.config.user,
          pass: this.config.password,
        },
      });
    }
  }

  getConfig(): { 
    host: string; 
    port: number; 
    secure: boolean; 
    user: string; 
    passwordConfigured: boolean;
    fromEmail: string; 
    fromName: string;
  } {
    return {
      host: this.config.host || "",
      port: this.config.port || 587,
      secure: this.config.secure || false,
      user: this.config.user || "",
      passwordConfigured: !!this.config.password,
      fromEmail: this.config.fromEmail || "",
      fromName: this.config.fromName || "",
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: "SMTP not configured" };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private getEmailTemplate(params: {
    orderId: string;
    productName: string;
    totalAmount: string;
    stockItem: string;
    themeColor: string;
    themeRgba02: string;
  }): { subject: string; htmlContent: string } {
    const subject = `Order Confirmed - ${params.orderId}`;
    const tc = params.themeColor;
    const tr = params.themeRgba02;
    
    const htmlContent = `<!DOCTYPE html>
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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #000000; border: 1px solid ${tr}; border-radius: 16px; overflow: hidden;">
          
          <!-- Success Icon Section -->
          <tr>
            <td align="center" style="padding: 48px 32px 24px 32px;">
              <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.1)); border: 1px solid rgba(34, 197, 94, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto;">
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
                        <td align="right" style="color: ${tc}; font-family: monospace; font-size: 12px;">${params.orderId}</td>
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
                        <td align="right" style="color: #ffffff; font-weight: 500; font-size: 14px; max-width: 180px;">${params.productName}</td>
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
                        <td align="right" style="color: ${tc}; font-weight: 500; font-size: 14px;">$${params.totalAmount}</td>
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
                    <div style="background-color: rgba(0, 0, 0, 0.5); border: 1px solid ${tr}; border-radius: 8px; padding: 16px;">
                      <code style="color: ${tc}; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-all; line-height: 1.5;">${params.stockItem}</code>
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

    return { subject, htmlContent };
  }

  async sendOrderEmail(params: {
    to: string;
    orderId: string;
    productName: string;
    totalAmount: number;
    stockItem: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured() || !this.transporter) {
      console.log("Email not configured, skipping email send");
      return { success: false, error: "Email service not configured" };
    }

    try {
      const themeColors = await getThemeColors();
      const { subject, htmlContent } = this.getEmailTemplate({
        orderId: params.orderId,
        productName: params.productName,
        totalAmount: params.totalAmount.toFixed(2),
        stockItem: params.stockItem,
        themeColor: themeColors.hex,
        themeRgba02: themeColors.rgba02,
      });

      await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: params.to,
        subject,
        html: htmlContent,
        messageId: `<order-${createHash("sha256").update(params.orderId).digest("hex").slice(0, 32)}@digital-delivery.local>`,
      });

      console.log(`Email sent successfully to ${params.to}`);
      return { success: true };
    } catch (error: any) {
      console.error("Email send error:", error);
      return { success: false, error: error.message };
    }
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured() || !this.transporter) {
      console.log("Email not configured, skipping email send");
      return { success: false, error: "Email service not configured" };
    }

    try {
      await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      console.log(`Email sent successfully to ${params.to}`);
      return { success: true };
    } catch (error: any) {
      console.error("Email send error:", error);
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();
