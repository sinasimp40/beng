import crypto from "crypto";

const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1";

export interface CreatePaymentRequest {
  price_amount: number;
  price_currency: string;
  pay_currency: string;
  order_id: string;
  order_description?: string;
  ipn_callback_url?: string;
  success_url?: string;
  cancel_url?: string;
}

export interface PaymentResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description?: string;
  created_at: string;
  updated_at: string;
  purchase_id?: string;
}

export interface PaymentStatusResponse {
  payment_id: number;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  actually_paid: number;
  pay_currency: string;
  order_id: string;
  order_description?: string;
  created_at: string;
  updated_at: string;
  outcome_amount?: number;
  outcome_currency?: string;
}

export interface CurrencyInfo {
  id: number;
  code: string;
  name: string;
  enable: boolean;
  wallet_regex?: string;
  priority?: number;
  extra_id_exists: boolean;
  extra_id_regex?: string;
  logo_url?: string;
  track?: boolean;
  cg_id?: string;
  is_maxlimit?: boolean;
  network?: string;
  smart_contract?: string;
  network_precision?: string;
}

export class NowPaymentsService {
  private getApiKey(): string | undefined {
    return process.env.NOWPAYMENTS_API_KEY;
  }

  private getIpnSecret(): string | undefined {
    return process.env.NOWPAYMENTS_IPN_SECRET;
  }

  isConfigured(): boolean {
    return !!this.getApiKey();
  }

  isIpnConfigured(): boolean {
    return !!this.getIpnSecret();
  }

  async getApiStatus(): Promise<{ message: string }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("NOWPayments API key not configured");
    }

    const response = await fetch(`${NOWPAYMENTS_API_URL}/status`, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`NOWPayments API returned ${response.status}`);
    }

    return response.json();
  }

  async getAvailableCurrencies(): Promise<string[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("NOWPayments API key not configured");
    }

    const response = await fetch(`${NOWPAYMENTS_API_URL}/currencies`, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch currencies: ${response.statusText}`);
    }

    const data = await response.json();
    return data.currencies || [];
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("NOWPayments API key not configured");
    }

    const response = await fetch(`${NOWPAYMENTS_API_URL}/payment`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to create payment: ${response.statusText}`);
    }

    return response.json();
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("NOWPayments API key not configured");
    }

    const response = await fetch(`${NOWPAYMENTS_API_URL}/payment/${paymentId}`, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get payment status: ${response.statusText}`);
    }

    return response.json();
  }

  async getMinimumPaymentAmount(currencyFrom: string, currencyTo: string): Promise<number> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("NOWPayments API key not configured");
    }

    const response = await fetch(
      `${NOWPAYMENTS_API_URL}/min-amount?currency_from=${currencyFrom}&currency_to=${currencyTo}`,
      {
        headers: {
          "x-api-key": apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get minimum amount: ${response.statusText}`);
    }

    const data = await response.json();
    return data.min_amount;
  }

  verifyIpnSignature(payload: string, signature: string): boolean {
    const ipnSecret = this.getIpnSecret();
    if (!ipnSecret) {
      return false;
    }

    const sortedPayload = JSON.stringify(
      Object.keys(JSON.parse(payload))
        .sort()
        .reduce((obj: Record<string, unknown>, key) => {
          obj[key] = JSON.parse(payload)[key];
          return obj;
        }, {})
    );

    const hash = crypto
      .createHmac("sha512", ipnSecret)
      .update(sortedPayload)
      .digest("hex");

    // Use a constant-time comparison so an attacker can't brute-force the
    // signature byte-by-byte by measuring response time.
    try {
      const expected = Buffer.from(hash, "hex");
      const actual = Buffer.from(signature || "", "hex");
      if (expected.length === 0 || expected.length !== actual.length) return false;
      return crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }
}

export const nowPaymentsService = new NowPaymentsService();
