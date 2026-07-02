/**
 * @file 定時登録ボーナス判定テスト
 */
import { describe, expect, it } from "vitest";
import { isBedtimePrepBlockingRegistrationBonus } from "@/lib/registrationBonus";

describe("isBedtimePrepBlockingRegistrationBonus", () => {
  it("できなかったはブロック", () => {
    expect(
      isBedtimePrepBlockingRegistrationBonus([
        { questId: "bedtime-prep", childAnswer: 0 },
      ]),
    ).toBe(true);
  });

  it("できたはブロックしない", () => {
    expect(
      isBedtimePrepBlockingRegistrationBonus([
        { questId: "bedtime-prep", childAnswer: 1 },
      ]),
    ).toBe(false);
  });
});
