/**
 * @file 祝日・休日前日判定テスト
 */
import { describe, expect, it } from "vitest";
import { isWeekendEve } from "@/lib/deadline";
import { isEveOfRestDay, isJapaneseHoliday, isRestDay } from "@/lib/japaneseHolidays";

describe("isJapaneseHoliday", () => {
  it("文化の日は祝日", () => {
    expect(isJapaneseHoliday("2026-11-03")).toBe(true);
  });

  it("平日は祝日ではない", () => {
    expect(isJapaneseHoliday("2026-11-02")).toBe(false);
  });
});

describe("isRestDay", () => {
  it("土日は休日", () => {
    expect(isRestDay("2026-07-04")).toBe(true);
    expect(isRestDay("2026-07-05")).toBe(true);
  });

  it("平日の祝日は休日", () => {
    expect(isRestDay("2026-11-03")).toBe(true);
  });
});

describe("isEveOfRestDay / isWeekendEve", () => {
  it("金曜は休日前日（翌日が土曜）", () => {
    expect(isEveOfRestDay("2026-07-03")).toBe(true);
    expect(isWeekendEve("2026-07-03")).toBe(true);
  });

  it("土曜は休日前日（翌日が日曜）", () => {
    expect(isEveOfRestDay("2026-07-04")).toBe(true);
    expect(isWeekendEve("2026-07-04")).toBe(true);
  });

  it("文化の日前日（火曜）は休日前日", () => {
    expect(isEveOfRestDay("2026-11-02")).toBe(true);
    expect(isWeekendEve("2026-11-02")).toBe(true);
  });

  it("平日の前日が平日なら休日前日ではない", () => {
    expect(isEveOfRestDay("2026-07-01")).toBe(false);
    expect(isWeekendEve("2026-07-01")).toBe(false);
  });

  it("日曜で翌日が平日祝日なら休日前日", () => {
    expect(isEveOfRestDay("2026-11-02")).toBe(true);
  });
});
