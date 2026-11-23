import { randomUUID } from "node:crypto";
import { decryptToken, encryptToken } from "./services/databaseBackupService";
import { storage } from "./storage";
import type { Product } from "@shared/schema";

const MIRAI_BASE_URL = "https://api.miraiapi.com/api/reseller/v1";
const KEY_SETTING = "mirai_reseller_api_key";

export interface MiraiPackage {
  code: string;
  group?: string;
  name: string;
  quota_tokens?: number;
  duration_seconds?: number;
  reseller_price_vnd: number;
  models?: string[];
  remaining_today?: number;
  unlimited?: boolean;
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

export function providerStock(balanceVnd: number, unitPriceVnd: number) {
  if (!Number.isFinite(unitPriceVnd) || unitPriceVnd <= 0) return 0;
  return Math.min(10000, Math.floor(Math.max(0, balanceVnd) / unitPriceVnd));
}

export function newProviderIdempotencyKey() {
  return `store-${randomUUID()}`;
}

export function providerDescription(pkg: MiraiPackage) {
  const models = pkg.models?.length ? `\n\nModels: ${pkg.models.join(", ")}` : "";
  return `${pkg.name}${models}`;
}

export function isMiraiProduct(product: Product) {
  return product.fulfillmentProvider === "mirai" && Boolean(product.providerPackageCode);
}
