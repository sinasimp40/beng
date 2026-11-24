import { randomUUID } from "node:crypto";
import { decryptToken, encryptToken } from "./services/databaseBackupService";
import { storage } from "./storage";
import type { Product } from "@shared/schema";

const MIRAI_BASE_URL = "https://api.miraiapi.com/api/reseller/v1";
const MIRAI_PUBLIC_API_URL = "https://api.miraiapi.com/api";
const MIRAI_OPENAI_URL = "https://api.miraiapi.com/v1";
const KEY_SETTING = "mirai_reseller_api_key";

export interface MiraiPackage {
  code: string;
  group?: string;
  name: string;
  quota_tokens?: number;
  duration_seconds?: number;
  retail_price_vnd?: number;
  reseller_price_vnd: number;
  models?: string[];
  remaining_today?: number;
  unlimited?: boolean;
  // These optional flags are respected if Mirai returns them in a future live catalog.
  enabled?: boolean;
  active?: boolean;
  available?: boolean;
}

interface MiraiResponse<T> { success: boolean; data?: T; message?: string; error?: string }
class MiraiRequestError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

async function getKey(): Promise<string> {
  const stored = await storage.getSetting(KEY_SETTING);
  if (!stored) throw new Error("Mirai reseller API key is not configured");
  return decryptToken(stored);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = await getKey();
  const response = await fetch(`${MIRAI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "User-Agent": "Store-Mirai-Reseller/1.0",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({})) as MiraiResponse<T>;
  if (!response.ok || !body.success) {
    throw new MiraiRequestError(body.message || body.error || `Mirai API request failed (${response.status})`, response.status);
  }
  if (body.data === undefined) throw new Error("Mirai API returned no data");
  return body.data;
}

async function publicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${MIRAI_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({})) as { success?: boolean; data?: T; message?: string; error?: string };
  if (!response.ok || body.success === false) throw new MiraiRequestError(body.message || body.error || `Access request failed (${response.status})`, response.status);
  return (body.data === undefined ? body : body.data) as T;
}

export async function redeemAccessCode(code: string) {
  return publicRequest<{ api_key: string; quota_tokens?: number; expires_at?: string; recovered?: boolean }>("/redeem/new", {
    method: "POST", body: JSON.stringify({ redeem_code: code }),
  });
}

export async function previewAccessCode(code: string) {
  return publicRequest<{ code_prefix?: string; status?: string; package_code?: string; package_name?: string; quota_tokens?: number; duration_seconds?: number; expires_at?: string }>(`/redeem/preview?code=${encodeURIComponent(code)}`);
}

export async function renewAccessCode(code: string, apiKey: string) {
  return publicRequest<{ api_key?: string; quota_before?: number; quota_after?: number; expires_at?: string }>("/redeem/renew", {
    method: "POST", body: JSON.stringify({ redeem_code: code, api_key: apiKey }),
  });
}

export async function checkAccessKey(apiKey: string) {
  return publicRequest<Record<string, unknown>>("/usage/check", {
    method: "POST", body: JSON.stringify({ api_key: apiKey }),
  });
}

export async function proxyPublicApi(path: string, init: RequestInit = {}) {
  const response = await fetch(`${MIRAI_PUBLIC_API_URL}${path}`, init);
  return response;
}

export async function forwardAccessApi(path: string, init: RequestInit = {}) {
  const response = await fetch(`${MIRAI_OPENAI_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": "Store-Access-Proxy/1.0",
      ...(init.headers || {}),
    },
    signal: init.signal || AbortSignal.timeout(60000),
  });
  return response;
}

export async function getMiraiBalance() {
  return request<{ balance_vnd: number; discount_bps?: number; tier?: string }>("/balance");
}

export async function getMiraiPackages() {
  return request<MiraiPackage[]>("/packages");
}

export async function saveMiraiApiKey(apiKey: string) {
  await storage.setSetting(KEY_SETTING, encryptToken(apiKey.trim()));
}

export async function clearMiraiApiKey() {
  await storage.setSetting(KEY_SETTING, "");
}

export async function miraiConfigured() {
  return Boolean(await storage.getSetting(KEY_SETTING));
}

export async function purchaseMiraiPackage(params: {
  externalOrderId: string;
  packageCode: string;
  quantity: number;
  idempotencyKey: string;
}) {
  const body = JSON.stringify({
    external_order_id: params.externalOrderId,
    package_code: params.packageCode,
    quantity: params.quantity,
  });
  const orderRequest = () => request<{ status: string; redeem_codes?: string[]; redeem_code?: string }>("/orders", {
      method: "POST",
      body,
      headers: { "Idempotency-Key": params.idempotencyKey },
    });
  try {
    return await orderRequest();
  } catch (error) {
    // A timeout can happen after Mirai has charged the wallet. The lookup is
    // safe and returns the original codes without creating another order.
    if (error instanceof TypeError || error instanceof MiraiRequestError && (error.status === undefined || error.status >= 500) || /timeout|fetch failed|network/i.test(String(error))) {
      try {
        return await orderRequest();
      } catch {
        return request<{ status: string; redeem_codes?: string[]; redeem_code?: string }>(`/orders/${encodeURIComponent(params.externalOrderId)}`);
      }
    }
    throw error;
  }
}

export function miraiCodes(data: { redeem_codes?: string[]; redeem_code?: string }) {
  return Array.isArray(data.redeem_codes) && data.redeem_codes.length > 0
    ? data.redeem_codes
    : data.redeem_code ? [data.redeem_code] : [];
}

export function providerStock(
  balanceVnd: number,
  unitPriceVnd: number,
  options: { remainingToday?: number; unlimited?: boolean; active?: boolean } = {},
) {
  // A provider-side disabled package must never be sellable, even if there is
  // still enough reseller balance for it.
  if (options.active === false) return 0;

  const price = Number(unitPriceVnd);
  const balance = Number(balanceVnd);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(balance) || balance <= 0) return 0;

  // Mirai permits up to 10,000 units per order. This also prevents an
  // unexpectedly large wallet balance from becoming an unsafe storefront stock value.
  const affordable = Math.min(10000, Math.floor(Math.max(0, balance) / price));
  if (affordable <= 0 || options.unlimited) return affordable;

  // `remaining_today` only caps daily-limited packages. An absent value means
  // Mirai did not publish a daily cap, so balance remains the source of truth.
  if (options.remainingToday === undefined || options.remainingToday === null) return affordable;
  const remaining = Number(options.remainingToday);
  if (!Number.isFinite(remaining)) return affordable;
  return Math.min(affordable, Math.max(0, Math.floor(remaining)));
}

export function miraiPackageStock(balanceVnd: number, pkg: MiraiPackage) {
  return providerStock(balanceVnd, pkg.reseller_price_vnd, {
    remainingToday: pkg.remaining_today,
    unlimited: pkg.unlimited,
    // Live catalogs commonly omit these flags. If Mirai supplies one, false
    // takes precedence and removes the product from customer availability.
    active: pkg.active ?? pkg.enabled ?? pkg.available,
  });
}

export function newProviderIdempotencyKey() {
  return `store-${randomUUID()}`;
}

const translations: Record<string, string> = {
  "\u0054\u0072\u0075\u006e\u0067 \u0051\u0075\u1ed1\u0063": "Chinese",
  "\u004b\u0068\u00f4\u006e\u0067 \u0067\u0069\u1edb\u0069 \u0068\u1ea1\u006e": "Unlimited",
  "\u0074\u0068\u00e1\u006e\u0067": "month",
  "\u006e\u0067\u00e0\u0079": "days",
  "\u0047\u00f3\u0069": "Package",
};

export function translateMiraiLabel(value?: string) {
  if (!value) return "";
  let translated = value;
  for (const [from, to] of Object.entries(translations)) translated = translated.replaceAll(from, to);
  return translated.replace(/\s+/g, " ").trim();
}

export function providerProductName(pkg: { name: string }) {
  return translateMiraiLabel(pkg.name);
}

export function providerCategory(group?: string) {
  const label = translateMiraiLabel(group);
  return label && label.toLowerCase() !== "mirai" ? label : "AI Access";
}

export function providerDefaultPrice(pkg: MiraiPackage, vndPerUsd: number) {
  const vnd = Number(pkg.reseller_price_vnd || pkg.retail_price_vnd || 0);
  if (!Number.isFinite(vnd) || vnd <= 0 || !Number.isFinite(vndPerUsd) || vndPerUsd <= 0) return 0.01;
  return Math.max(0.01, Math.round((vnd / vndPerUsd) * 100) / 100);
}

export function providerDescription(pkg: MiraiPackage) {
  const quota = pkg.unlimited ? "Unlimited quota" : pkg.quota_tokens ? `${pkg.quota_tokens.toLocaleString()} tokens` : "Included API quota";
  const days = pkg.duration_seconds ? Math.round(pkg.duration_seconds / 86400) : 0;
  const duration = days ? `${days} day${days === 1 ? "" : "s"}` : "provider-defined duration";
  const models = pkg.models?.length ? `\n\nIncluded models: ${pkg.models.join(", ")}.` : "";
  return `${providerProductName(pkg)} provides ${quota} for ${duration}.${models}\n\nRedeem the delivered access code on the Developer Access page to create a new API key or add access to an existing key.`;
}

export function isMiraiProduct(product: Product) {
  return product.fulfillmentProvider === "mirai" && Boolean(product.providerPackageCode);
}
