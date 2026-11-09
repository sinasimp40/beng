import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { NowPaymentsService } from "./nowpayments";
import { PAYMENT_CURRENCIES } from "@shared/payment-currencies";

// This file runs in its own test process. No real API calls or credentials.
process.env.NOWPAYMENTS_API_KEY = "unit-test-key";
afterEach(() => mock.restoreAll());

describe("NOWPayments network-specific currencies", () => {
  it("does not offer ambiguous legacy BNB or USDT identifiers", () => {
    const ids = PAYMENT_CURRENCIES.map(currency => currency.id) as string[];
    assert.ok(!ids.includes("bnb"));
    assert.ok(!ids.includes("usdt"));
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ["bnbbsc", "usdttrc20", "usdterc20", "usdtbsc"]) {
      assert.ok(ids.includes(id));
    }
  });

  for (const currency of PAYMENT_CURRENCIES.filter(c => c.symbol === "bnb" || c.symbol === "usdt")) {
    it(`uses ${currency.id} consistently for minimums and payment creation`, async () => {
      const service = new NowPaymentsService();
      const calls: { url: string; init?: RequestInit }[] = [];
      mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return Response.json(String(url).includes("/min-amount?")
          ? { currency_from: currency.id, currency_to: currency.id, min_amount: 0.01, fiat_equivalent: 1 }
          : { payment_id: "mock-payment", payment_status: "waiting", pay_currency: currency.id });
      });

      await service.getMinimumPaymentAmount(currency.id);
      const minimumUrl = new URL(calls[0].url);
      assert.equal(minimumUrl.searchParams.get("currency_from"), currency.id);
      assert.equal(minimumUrl.searchParams.get("currency_to"), currency.id);
      const payment = await service.createPayment({
        price_amount: 50,
        price_currency: "usd",
        pay_currency: currency.id,
        order_id: "unit-test-order",
      });
      assert.equal(calls[1].init?.method, "POST");
      assert.equal(JSON.parse(String(calls[1].init?.body)).pay_currency, currency.id);
      assert.equal(payment.pay_currency, currency.id);
    });
  }

  it("preserves the provider's failure reason instead of a generic payment error", async () => {
    mock.method(globalThis, "fetch", async () => Response.json({
      code: "CURRENCY_NOT_SUPPORTED",
      message: "Currency is not available for this merchant",
    }, { status: 400 }));
    await assert.rejects(
      new NowPaymentsService().createPayment({
        price_amount: 50,
        price_currency: "usd",
        pay_currency: "usdttrc20",
        order_id: "unit-test-order",
      }),
      /Currency is not available for this merchant/,
    );
  });
});
