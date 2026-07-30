/**
 * @file gradeUi 単体テスト
 */
import { describe, expect, it } from "vitest";
import {
  isNegativeChildAnswer,
  isParentGradableAnswer,
  resolveActualDoneForSubmit,
} from "./gradeUi";

describe("gradeUi", () => {
  it("肯定のみ採点対象", () => {
    expect(isParentGradableAnswer(1)).toBe(true);
    expect(isParentGradableAnswer(0)).toBe(false);
    expect(isParentGradableAnswer(-1)).toBe(false);
  });

  it("否定を判定する", () => {
    expect(isNegativeChildAnswer(0)).toBe(true);
    expect(isNegativeChildAnswer(1)).toBe(false);
  });

  it("送信用 actualDone を決める（否定・わからないは送信スキップ）", () => {
    expect(resolveActualDoneForSubmit(-1, undefined)).toBeUndefined();
    expect(resolveActualDoneForSubmit(0, undefined)).toBeUndefined();
    expect(resolveActualDoneForSubmit(1, true)).toBe(true);
    expect(resolveActualDoneForSubmit(1, false)).toBe(false);
    expect(() => resolveActualDoneForSubmit(1, undefined)).toThrow(/未採点/);
  });
});
