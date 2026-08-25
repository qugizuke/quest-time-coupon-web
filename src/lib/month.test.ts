/**
 * @file month ユーティリティの単体テスト
 */
import { describe, expect, it } from "vitest";
import { formatMonthLabel, shiftMonth, toMonth } from "./month";

describe("toMonth", () => {
  it("YYYY-MM-DD から YYYY-MM を切り出す", () => {
    expect(toMonth("2026-08-25")).toBe("2026-08");
  });
});

describe("shiftMonth", () => {
  it("翌月へ進む", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
  });

  it("前月へ戻る", () => {
    expect(shiftMonth("2026-08", -1)).toBe("2026-07");
  });

  it("年をまたぐ", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("formatMonthLabel", () => {
  it("日本語表示に変換する", () => {
    expect(formatMonthLabel("2026-08")).toBe("2026年8月");
  });
});
