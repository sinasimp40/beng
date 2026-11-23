import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { miraiCodes, providerStock, isMiraiProduct } from "./mirai";

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

  it("only treats fully configured products as provider fulfilled", () => {
    assert.equal(isMiraiProduct({ fulfillmentProvider: "mirai", providerPackageCode: "FULL_100M" } as any), true);
    assert.equal(isMiraiProduct({ fulfillmentProvider: null, providerPackageCode: "FULL_100M" } as any), false);
  });
});
