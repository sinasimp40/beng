import { useQuery } from "@tanstack/react-query";

export interface CryptoMinimum {
  minimumUsd: number;
  minimumCrypto: number;
}

interface CryptoMinimumsResponse {
  minimums: Record<string, CryptoMinimum | null>;
}

export function useCryptoMinimums(enabled = true) {
  return useQuery<CryptoMinimumsResponse>({
    queryKey: ["/api/payments/minimums"],
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function isBelowCryptoMinimum(
  amountUsd: number,
  minimum: CryptoMinimum | null | undefined,
): boolean {
  return !!minimum && amountUsd + Number.EPSILON < minimum.minimumUsd;
}