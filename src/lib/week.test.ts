/**
 * @file week ユーティリティの単体テスト
 */
import { describe, expect, it } from "vitest";
import {
  formatWeekLabel,
  getMondayOfWeek,
  getMondayWithOffset,
  getWeekDates,
  getWeekOffsetBetween,
} from "./week";

describe("week", () => {
  it("月曜始まりの週を返す", () => {
    // 2026-07-30 は木曜日
    expect(getMondayOfWeek("2026-07-30")).toBe("2026-07-27");
    expect(getWeekDates("2026-07-27")).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("日曜は前週月曜に属する", () => {
    expect(getMondayOfWeek("2026-08-02")).toBe("2026-07-27");
  });

  it("週オフセットで前後に移動する", () => {
    expect(getMondayWithOffset("2026-07-30", 0)).toBe("2026-07-27");
    expect(getMondayWithOffset("2026-07-30", -1)).toBe("2026-07-20");
    expect(getMondayWithOffset("2026-07-30", 1)).toBe("2026-08-03");
  });

  it("週ラベルを返す", () => {
    expect(formatWeekLabel("2026-07-27")).toBe("7月27日の週");
  });

  it("基準日と対象日の週オフセットを返す", () => {
    expect(getWeekOffsetBetween("2026-07-30", "2026-07-28")).toBe(0);
    expect(getWeekOffsetBetween("2026-07-30", "2026-07-20")).toBe(-1);
    expect(getWeekOffsetBetween("2026-07-30", "2026-08-05")).toBe(1);
  });
});
