import assert from "node:assert/strict";
import test from "node:test";
import { eligibleCurrencies, meetsCryptoMinimum, minimumRejectionKey } from "./crypto-availability";

test("minimum filtering requires a finite positive estimate and includes the exact boundary", () => {
  assert.equal(meetsCryptoMinimum(0.1, { minimumUsd: 0.1 }), true);
  assert.equal(meetsCryptoMinimum(0.09, { minimumUsd: 0.1 }), false);
  assert.equal(meetsCryptoMinimum(0.29 * 3, { minimumUsd: 0.87 }), true);
  assert.equal(meetsCryptoMinimum(2, null), false);
  assert.equal(meetsCryptoMinimum(2, undefined), false);
  assert.equal(meetsCryptoMinimum(2, { minimumUsd: Number.NaN }), false);
  assert.equal(meetsCryptoMinimum(2, { minimumUsd: Number.POSITIVE_INFINITY }), false);
  assert.equal(meetsCryptoMinimum(2, { minimumUsd: 0 }), false);
  assert.equal(meetsCryptoMinimum(Number.NaN, { minimumUsd: 1 }), false);
});

test("USDT is available only when at least one explicitly supported network meets its estimate", () => {
  const networks = ["usdtbsc", "usdterc20", "usdttrc20"] as const;
  const estimates = { usdtbsc: null, usdterc20: { minimumUsd: 0.1 }, usdttrc20: undefined };
  assert.deepEqual(eligibleCurrencies(networks, 0.1, estimates), ["usdterc20"]);
  assert.deepEqual(eligibleCurrencies(networks, 0.1, {}), []);
});

test("provider minimum rejection is scoped to that currency and exact entered amount", () => {
  const rejected = new Set([minimumRejectionKey(5, "btc")]);
  const currencies = ["btc", "ltc"] as const;
  const estimates = { btc: { minimumUsd: 1 }, ltc: { minimumUsd: 1 } };
  const rejectedAtFive = eligibleCurrencies(currencies, 5, estimates, rejected, c => minimumRejectionKey(5, c));
  assert.deepEqual(rejectedAtFive, ["ltc"]);
  const differentAmount = eligibleCurrencies(currencies, 5.01, estimates, rejected, c => minimumRejectionKey(5.01, c));
  assert.deepEqual(differentAmount, ["btc", "ltc"]);
});
