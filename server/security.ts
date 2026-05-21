import type { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";

const loginAttempts = new Map<string, { count: number; lastAttempt: number; blockedUntil: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now - data.lastAttempt > 15 * 60 * 1000) {
      loginAttempts.delete(key);
    }
  }
}, 60 * 1000);

export function checkBruteForce(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${ip}`;
  const now = Date.now();
  const data = loginAttempts.get(key);

  if (data && data.blockedUntil > now) {
    const remainingSeconds = Math.ceil((data.blockedUntil - now) / 1000);
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${remainingSeconds} seconds.`,
    });
  }

  next();
}

export function recordFailedLogin(req: Request) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${ip}`;
  const now = Date.now();
  const data = loginAttempts.get(key) || { count: 0, lastAttempt: now, blockedUntil: 0 };

  data.count++;
  data.lastAttempt = now;

  if (data.count >= 10) {
    data.blockedUntil = now + 15 * 60 * 1000;
    data.count = 0;
  } else if (data.count >= 5) {
    data.blockedUntil = now + 2 * 60 * 1000;
  }

  loginAttempts.set(key, data);
}

export function recordSuccessfulLogin(req: Request) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  loginAttempts.delete(`${ip}`);
}

const rateLimitOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
};

export const globalLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: "Too many requests, please try again later." },
  skip: (req: Request) => {
    return req.path.startsWith("/assets") || req.path.startsWith("/@") || req.path.endsWith(".js") || req.path.endsWith(".css") || req.path.startsWith("/vite-hmr") || req.path.startsWith("/ws/");
  },
});

// Tightened to limit CPU-DoS via repeated scrypt hashing. 10 attempts per IP
// per 15 minutes is plenty for real users and pushes back hard against
// brute-force / DoS attempts. The async hash semaphore in server/auth.ts
// additionally bounds total concurrent scrypt work across all sources.
export const authLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many authentication attempts. Please try again later." },
});

export const apiLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 1 * 60 * 1000,
  max: 300,
  message: { error: "Too many API requests. Please slow down." },
});

export const paymentLimiter = rateLimit({
  ...rateLimitOptions,
  windowMs: 1 * 60 * 1000,
  max: 15,
  message: { error: "Too many payment requests. Please wait before trying again." },
});

function safeDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

export function setupSecurity(app: Express) {
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );

  app.use(hpp());

  app.use(globalLimiter);

  app.use("/api", apiLimiter);

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.removeHeader("X-Powered-By");
    res.removeHeader("Server");
    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const suspiciousPatterns = [
      /(\.\.|%2e%2e)/i,
      /<script[\s>]/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /union\s+(all\s+)?select/i,
      /;\s*(drop|alter|delete|insert|update|create)\s/i,
      /\/etc\/(passwd|shadow|hosts)/i,
      /\.(env|git|htaccess|htpasswd)/i,
      /wp-(admin|login|content)/i,
      /phpmyadmin/i,
    ];

    const fullUrl = req.originalUrl || req.url;
    const decoded = safeDecode(fullUrl);
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(decoded)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    next();
  });

  console.log("[Security] All security middleware initialized");
}
