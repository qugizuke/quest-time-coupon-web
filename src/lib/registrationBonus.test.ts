/**
 * @file 定時登録ボーナス判定テスト
 */
import { describe, expect, it } from "vitest";
import {
  BEDTIME_PREP_FALSE_CLAIM_PENALTY,
  calcBedtimePrepFalseClaimPenalty,
  canApplyBedtimePrepRegistrationBonus,
  isBedtimePrepBlockingRegistrationBonus,
} from "@/lib/registrationBonus";

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

describe("canApplyBedtimePrepRegistrationBonus", () => {
  it("子ども・保護者ともにできた場合だけ true", () => {
    expect(canApplyBedtimePrepRegistrationBonus({
      childAnswer: 1,
      actualDone: true,
    })).toBe(true);
    expect(canApplyBedtimePrepRegistrationBonus({
      childAnswer: 0,
      actualDone: true,
    })).toBe(false);
    expect(canApplyBedtimePrepRegistrationBonus({
      childAnswer: 1,
      actualDone: false,
    })).toBe(false);
  });
});

describe("calcBedtimePrepFalseClaimPenalty", () => {
  it("できた申告が保護者NGなら -30", () => {
    expect(calcBedtimePrepFalseClaimPenalty({
      childAnswer: 1,
      actualDone: false,
    })).toBe(BEDTIME_PREP_FALSE_CLAIM_PENALTY);
  });

  it("正直申告や保護者OKなら 0", () => {
    expect(calcBedtimePrepFalseClaimPenalty({
      childAnswer: 1,
      actualDone: true,
    })).toBe(0);
    expect(calcBedtimePrepFalseClaimPenalty({
      childAnswer: 0,
      actualDone: false,
    })).toBe(0);
  });
});
