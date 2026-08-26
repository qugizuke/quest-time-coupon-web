import { describe, expect, it } from "vitest";
import { normalizeRewardVouchers, zeroRewardVouchers } from "./rewardVouchers";

describe("normalizeRewardVouchers", () => {
  it("欠落キーを0で補完し、非負の安全な整数だけを受理する", () => {
    expect(
      normalizeRewardVouchers({
        "snack-10": 2,
        "cash-100": -1,
        "dining-1000": 1.5,
        "switch-30": Number.POSITIVE_INFINITY,
        "switch-60": Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toEqual({ ...zeroRewardVouchers(), "snack-10": 2 });
  });
});
