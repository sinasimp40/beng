import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { miraiCodes, providerDefaultPrice, providerProductName, providerStock, isMiraiProduct } from "./mirai";

describe("Mirai reseller helpers", () => {
  it("uses the plural redeem_codes list in full", () => {
    assert.deepEqual(miraiCodes({ redeem_code: "MR-1", redeem_codes: ["MR-1", "MR-2"] }), ["MR-1", "MR-2"]);
  });

  it("falls back to the singular code for legacy responses", () => {
    assert.deepEqual(miraiCodes({ redeem_code: "MR-1" }), ["MR-1"]);
  });

  it("derives stock from balance and wholesale price", () => {
    assert.equal(providerStock(100000, 25000), 4);
    assert.equal(providerStock(-1, 25000), 0);
    assert.equal(providerStock(100000, 0), 0);
  });

  it("uses the reseller cost for a safe imported default price", () => {
    assert.equal(providerDefaultPrice({ reseller_price_vnd: 72000, retail_price_vnd: 80000 } as any, 26000), 2.77);
    assert.equal(providerDefaultPrice({ reseller_price_vnd: 0 } as any, 26000), 0.01);
  });

  it("translates common imported Vietnamese package labels", () => {
    assert.equal(providerProductName({ name: "Trung Quốc 50M" }), "Chinese 50M");
  });

  it("only treats fully configured products as provider fulfilled", () => {
    assert.equal(isMiraiProduct({ fulfillmentProvider: "mirai", providerPackageCode: "FULL_100M" } as any), true);
    assert.equal(isMiraiProduct({ fulfillmentProvider: null, providerPackageCode: "FULL_100M" } as any), false);
  });
});
