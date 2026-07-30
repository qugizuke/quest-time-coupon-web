/**
 * @file ホームモード出し分けの単体テスト
 * @description 4バリアント・就寝非表示（免除）・起床表示条件を検証する。
 */
import { describe, expect, it } from "vitest";
import {
  canChildSaveBedtime,
  resolveBedtimeUiMode,
  resolveHomeVariant,
  shouldShowWakeUpSetting,
} from "./homeMode";

describe("resolveHomeVariant", () => {
  it("通常／免除／vacation／exempt-vacation を返す", () => {
    expect(resolveHomeVariant(false, false)).toBe("kid-home");
    expect(resolveHomeVariant(true, false)).toBe("kid-home-exempt");
    expect(resolveHomeVariant(false, true)).toBe("kid-home-vacation");
    expect(resolveHomeVariant(true, true)).toBe("kid-home-exempt-vacation");
  });
});

describe("resolveBedtimeUiMode", () => {
  it("免除日は就寝 UI を隠す（長期休み併用でも仕様勝ち）", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: true,
        isVacationMode: true,
        isWeekendEveDay: true,
        bedtimeHour: undefined,
        todayStatus: "unanswered",
        date: "2026-07-30",
        now: new Date(2026, 6, 30, 10, 0, 0),
      }),
    ).toBe("hidden");
  });

  it("長期休み・正午前提で未設定なら settable", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: false,
        isVacationMode: true,
        isWeekendEveDay: false,
        bedtimeHour: undefined,
        todayStatus: "unanswered",
        date: "2026-07-30",
        now: new Date(2026, 6, 30, 10, 0, 0),
      }),
    ).toBe("settable");
  });

  it("長期休み・正午超過で未設定なら locked21", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: false,
        isVacationMode: true,
        isWeekendEveDay: false,
        bedtimeHour: undefined,
        todayStatus: "unanswered",
        date: "2026-07-30",
        now: new Date(2026, 6, 30, 12, 0, 0),
      }),
    ).toBe("locked21");
  });

  it("平日通常は就寝 UI なし", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: false,
        isVacationMode: false,
        isWeekendEveDay: false,
        bedtimeHour: undefined,
        todayStatus: "unanswered",
        date: "2026-07-28",
        now: new Date(2026, 6, 28, 20, 0, 0),
      }),
    ).toBe("hidden");
  });
});

describe("shouldShowWakeUpSetting", () => {
  it("長期休みなら毎晩 true", () => {
    expect(shouldShowWakeUpSetting("2026-07-28", true)).toBe(true);
  });

  it("休日前夜（金曜）は true", () => {
    // 2026-07-03 は金曜
    expect(shouldShowWakeUpSetting("2026-07-03", false)).toBe(true);
  });

  it("通常の平日は false", () => {
    // 2026-07-28 は火曜
    expect(shouldShowWakeUpSetting("2026-07-28", false)).toBe(false);
  });
});

describe("canChildSaveBedtime", () => {
  it("免除日は保存不可", () => {
    expect(
      canChildSaveBedtime({
        isExemptDay: true,
        isVacationMode: true,
        isWeekendEveDay: true,
        date: "2026-07-30",
        now: new Date(2026, 6, 30, 10, 0, 0),
      }),
    ).toBe(false);
  });

  it("長期休み・正午後は保存不可", () => {
    expect(
      canChildSaveBedtime({
        isExemptDay: false,
        isVacationMode: true,
        isWeekendEveDay: false,
        date: "2026-07-30",
        now: new Date(2026, 6, 30, 13, 0, 0),
      }),
    ).toBe(false);
  });
});
