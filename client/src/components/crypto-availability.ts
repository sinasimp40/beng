import type { PaymentCurrency } from "@shared/payment-currencies";

export interface MinimumEstimate {
  minimumUsd?: unknown;
}

export function meetsCryptoMinimum(
  amountUsd: number,
  minimum: MinimumEstimate | null | undefined,
): boolean {
  const minimumUsd = minimum?.minimumUsd;
  return Number.isFinite(amountUsd)
    && typeof minimumUsd === "number"
    && Number.isFinite(minimumUsd)
    && minimumUsd > 0
    && Math.round(amountUsd * 100) >= Math.ceil(minimumUsd * 100 - 1e-8);
}

export function eligibleCurrencies<T extends string>(
  currencies: readonly T[],
  amountUsd: number,
  minimums: Record<string, MinimumEstimate | null | undefined> | null | undefined,
  unavailable: ReadonlySet<string> = new Set(),
  rejectionKey?: (currency: T) => string,
): T[] {
  return currencies.filter(currency =>
    meetsCryptoMinimum(amountUsd, minimums?.[currency])
      && (!rejectionKey || !unavailable.has(rejectionKey(currency))),
  );
}

export function minimumRejectionKey(amountUsd: number, currency: PaymentCurrency): string {
  return `${Math.round(amountUsd * 100)}:${currency.toLowerCase()}`;
}
