import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

export async function verifyRecaptcha(token: string | undefined | null): Promise<boolean> {
  // Read the secret on every call so that keys loaded from the database at
  // startup (or rotated at runtime via the admin panel) take effect
  // immediately, rather than being frozen to whatever value was present
  // when this module was first imported.
  const secret = process.env.RECAPTCHA_SECRET_KEY || "";

  // reCAPTCHA is an OPT-IN feature: the admin enables it by configuring a
  // secret key in the admin panel. If no key is configured, the feature is
  // simply off and we allow the request through. This avoids locking the
  // owner out of their own site on a fresh install.
  if (!secret) {
    return true;
  }

  // reCAPTCHA IS configured, so a token is now mandatory.
  if (!token) return false;

  try {
    const response = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });

    const data = await response.json();
    if (!data.success) return false;
    // v3 returns a "score" (0.0-1.0); v2 checkbox does not. If a score is
    // present, require >= 0.5. If absent (v2), success alone is enough.
    if (typeof data.score === "number") return data.score >= 0.5;
    return true;
  } catch (error) {
    console.error("reCAPTCHA verification failed:", error);
    return false;
  }
}

// Password hashing uses scrypt (Node built-in), which is memory-hard and
// resistant to GPU brute-force. Stored format: "scrypt:<salt-hex>:<hash-hex>".
// Legacy "<salt>:<hash>" raw-sha256 records are still accepted on login and
// transparently re-hashed on the next successful login (see needsRehash).
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N — ~64MB memory per attempt
const SCRYPT_BLOCK = 8;
const SCRYPT_PARALLEL = 1;
const SCRYPT_MAXMEM = 128 * 1024 * 1024; // 128MB cap per op

// Hard cap on the password length we are willing to hash. Without this an
// attacker could submit a multi-megabyte "password" and force the server to
// chew on it. This also protects against memory amplification when many
// concurrent logins arrive.
const MAX_PASSWORD_BYTES = 256;

// Bounded semaphore so a flood of concurrent login attempts can't spawn
// unbounded scrypt jobs that exhaust CPU/memory. 4 in-flight at a time is
// plenty for a real workload and still gives clear back-pressure.
const HASH_CONCURRENCY = 4;
let inFlight = 0;
const waiters: Array<() => void> = [];
function acquireSlot(): Promise<void> {
  if (inFlight < HASH_CONCURRENCY) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
}
function releaseSlot() {
  const next = waiters.shift();
  if (next) {
    next(); // still counts toward inFlight
  } else {
    inFlight--;
  }
}

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK, p: SCRYPT_PARALLEL, maxmem: SCRYPT_MAXMEM },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey as Buffer);
      }
    );
  });
}

function tooLong(password: string): boolean {
  return !password || Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES;
}

export async function hashPassword(password: string): Promise<string> {
  if (tooLong(password)) {
    throw new Error("Password exceeds maximum length");
  }
  const salt = randomBytes(16).toString("hex");
  await acquireSlot();
  try {
    const hash = (await scryptAsync(password, salt)).toString("hex");
    return `scrypt:${salt}:${hash}`;
  } finally {
    releaseSlot();
  }
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || tooLong(password)) return false;

  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;
    await acquireSlot();
    try {
      const expected = Buffer.from(hash, "hex");
      const actual = await scryptAsync(password, salt);
      if (expected.length !== actual.length) return false;
      return timingSafeEqual(expected, actual);
    } catch {
      return false;
    } finally {
      releaseSlot();
    }
  }

  // Legacy sha256+salt records (backward compatibility for existing users).
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const testHash = createHash("sha256")
    .update(password + salt)
    .digest("hex");
  try {
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(testHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function needsRehash(stored: string): boolean {
  return !stored.startsWith("scrypt:");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}
