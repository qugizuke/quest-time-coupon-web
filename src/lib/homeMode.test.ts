/**
 * @file ホームモード出し分けの単体テスト
 * @description 4バリアント・就寝非表示（免除）・起床表示条件を検証する。
 */
import { describe, expect, it } from "vitest";
import {
  canChildSaveBedtime,
  evaluateParentBedtimeChange,
  getParentSelectableBedtimeHours,
  isLongVacationFinalDayBeforeWeekday,
  isParentBedtimeHourSelectable,
  isVacationTransitionPeriod,
  resolveBedtimeUiMode,
  resolveHomeVariant,
  resolveWakeUpOptions,
  shouldShowWakeUpSetting,
  TRANSITION_WAKE_UP_OPTIONS,
  WAKE_UP_OPTIONS,
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

  it("長期休み・18時前・未設定なら settable", () => {
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

  it("長期休み・18時以降・未設定なら locked21", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: false,
        isVacationMode: true,
        isWeekendEveDay: false,
        bedtimeHour: undefined,
        todayStatus: "unanswered",
        date: "2026-07-30",
        now: new Date(2026, 6, 30, 18, 0, 0),
      }),
    ).toBe("locked21");
  });

  it("休日前日・18時前・設定済みなら settable（再変更可）", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: false,
        isVacationMode: false,
        isWeekendEveDay: true,
        bedtimeHour: 22,
        todayStatus: "unanswered",
        date: "2026-07-03",
        now: new Date(2026, 6, 3, 17, 0, 0),
      }),
    ).toBe("settable");
  });

  it("休日前日・18時以降・設定済みなら display", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: false,
        isVacationMode: false,
        isWeekendEveDay: true,
        bedtimeHour: 22,
        todayStatus: "unanswered",
        date: "2026-07-03",
        now: new Date(2026, 6, 3, 18, 0, 0),
      }),
    ).toBe("display");
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
        now: new Date(2026, 6, 28, 10, 0, 0),
      }),
    ).toBe("hidden");
  });

  it("移行期間中は18時前・未設定でも locked21（就寝選択不可・Issue #36）", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: false,
        isVacationMode: true,
        isWeekendEveDay: false,
        bedtimeHour: undefined,
        todayStatus: "unanswered",
        date: "2026-08-25",
        now: new Date(2026, 7, 25, 10, 0, 0),
        isTransitionPeriod: true,
      }),
    ).toBe("locked21");
  });

  it("移行期間中は就寝設定済みでも locked21", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: false,
        isVacationMode: true,
        isWeekendEveDay: false,
        bedtimeHour: 21,
        todayStatus: "unanswered",
        date: "2026-08-25",
        now: new Date(2026, 7, 25, 10, 0, 0),
        isTransitionPeriod: true,
      }),
    ).toBe("locked21");
  });

  it("免除日は移行期間中でも hidden（仕様勝ち）", () => {
    expect(
      resolveBedtimeUiMode({
        isExemptDay: true,
        isVacationMode: true,
        isWeekendEveDay: false,
        bedtimeHour: undefined,
        todayStatus: "exempt",
        date: "2026-08-25",
        now: new Date(2026, 7, 25, 10, 0, 0),
        isTransitionPeriod: true,
      }),
    ).toBe("hidden");
  });
});

describe("isLongVacationFinalDayBeforeWeekday", () => {
  it("最終日かつ翌日が平日なら true", () => {
    // 2026-08-31 は月曜・期間最終日、翌日 9/1 は火曜平日
    expect(
      isLongVacationFinalDayBeforeWeekday("2026-08-31", {
        startDate: "2026-07-25",
        endDate: "2026-08-31",
      }),
    ).toBe(true);
  });

  it("最終日でも翌日が土曜なら false", () => {
    // 2026-07-31 は金曜、翌日 8/1 は土曜
    expect(
      isLongVacationFinalDayBeforeWeekday("2026-07-31", {
        startDate: "2026-07-25",
        endDate: "2026-07-31",
      }),
    ).toBe(false);
  });

  it("期間中日は false", () => {
    expect(
      isLongVacationFinalDayBeforeWeekday("2026-08-15", {
        startDate: "2026-07-25",
        endDate: "2026-08-31",
      }),
    ).toBe(false);
  });
});

describe("shouldShowWakeUpSetting", () => {
  const summer = { startDate: "2026-07-25", endDate: "2026-08-31" };

  it("長期休みの中日は true", () => {
    expect(shouldShowWakeUpSetting("2026-08-15", true, summer)).toBe(true);
  });

  it("長期休み最終日（翌日平日）は false", () => {
    expect(shouldShowWakeUpSetting("2026-08-31", true, summer)).toBe(false);
  });

  it("長期休み最終日でも翌日が休日なら true（休日前夜としても true）", () => {
    // 2026-07-31 金曜終了 → 翌日土曜。isWeekendEve でも true
    expect(
      shouldShowWakeUpSetting("2026-07-31", true, {
        startDate: "2026-07-25",
        endDate: "2026-07-31",
      }),
    ).toBe(true);
  });

  it("休日前夜（金曜）は true", () => {
    // 2026-07-03 は金曜
    expect(shouldShowWakeUpSetting("2026-07-03", false)).toBe(true);
  });

  it("通常の平日は false", () => {
    // 2026-07-28 は火曜
    expect(shouldShowWakeUpSetting("2026-07-28", false)).toBe(false);
  });

  it("WAKE_UP_OPTIONS に 07:15 を含めない", () => {
    expect(WAKE_UP_OPTIONS).not.toContain("07:15");
    expect(WAKE_UP_OPTIONS).toEqual([
      "07:00",
      "07:30",
      "08:00",
      "08:30",
      "09:00",
    ]);
  });
});

describe("isVacationTransitionPeriod", () => {
  const summer = { startDate: "2026-08-01", endDate: "2026-08-31" };

  it("endDate から6日前（両端含む7日間）は移行期間", () => {
    expect(isVacationTransitionPeriod("2026-08-25", summer)).toBe(true);
    expect(isVacationTransitionPeriod("2026-08-31", summer)).toBe(true);
  });

  it("移行期間の1日前は false", () => {
    expect(isVacationTransitionPeriod("2026-08-24", summer)).toBe(false);
  });

  it("長期休み期間外は false", () => {
    expect(isVacationTransitionPeriod("2026-09-01", summer)).toBe(false);
    expect(isVacationTransitionPeriod("2026-07-31", summer)).toBe(false);
  });

  it("長期休みが7日未満なら全日程が移行期間", () => {
    const shortPeriod = { startDate: "2026-08-10", endDate: "2026-08-13" };
    expect(isVacationTransitionPeriod("2026-08-10", shortPeriod)).toBe(true);
    expect(isVacationTransitionPeriod("2026-08-13", shortPeriod)).toBe(true);
  });

  it("期間未設定（null/undefined）は false", () => {
    expect(isVacationTransitionPeriod("2026-08-25", null)).toBe(false);
    expect(isVacationTransitionPeriod("2026-08-25", undefined)).toBe(false);
  });
});

describe("resolveWakeUpOptions", () => {
  it("通常期間は5値", () => {
    expect(resolveWakeUpOptions(false)).toEqual(WAKE_UP_OPTIONS);
  });

  it("移行期間中は3値（07:00/07:30/08:00）に縮小", () => {
    expect(resolveWakeUpOptions(true)).toEqual(TRANSITION_WAKE_UP_OPTIONS);
    expect(resolveWakeUpOptions(true)).not.toContain("08:30");
    expect(resolveWakeUpOptions(true)).not.toContain("09:00");
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

  it("長期休み・18時以降は保存不可", () => {
    expect(
      canChildSaveBedtime({
        isExemptDay: false,
        isVacationMode: true,
        isWeekendEveDay: false,
        date: "2026-07-30",
        now: new Date(2026, 6, 30, 18, 0, 0),
      }),
    ).toBe(false);
  });

  it("休日前日・18時前は保存可", () => {
    expect(
      canChildSaveBedtime({
        isExemptDay: false,
        isVacationMode: false,
        isWeekendEveDay: true,
        date: "2026-07-03",
        now: new Date(2026, 6, 3, 17, 59, 0),
      }),
    ).toBe(true);
  });

  it("移行期間中は18時前でも保存不可（Issue #36）", () => {
    expect(
      canChildSaveBedtime({
        isExemptDay: false,
        isVacationMode: true,
        isWeekendEveDay: false,
        date: "2026-08-25",
        now: new Date(2026, 7, 25, 10, 0, 0),
        isTransitionPeriod: true,
      }),
    ).toBe(false);
  });
});

describe("getParentSelectableBedtimeHours", () => {
  const date = "2026-07-03";

  it("20:55 では 21 時は選べず 22・23 時のみ", () => {
    const now = new Date(2026, 6, 3, 20, 55, 0);
    expect(isParentBedtimeHourSelectable(date, 21, now)).toBe(false);
    expect(isParentBedtimeHourSelectable(date, 22, now)).toBe(true);
    expect(isParentBedtimeHourSelectable(date, 23, now)).toBe(true);
    expect(getParentSelectableBedtimeHours(date, now)).toEqual([22, 23]);
  });

  it("20:00 ちょうどでは 21 時は選べない", () => {
    const now = new Date(2026, 6, 3, 20, 0, 0);
    expect(getParentSelectableBedtimeHours(date, now)).toEqual([22, 23]);
  });

  it("19:59 までは 21 時も選べる", () => {
    const now = new Date(2026, 6, 3, 19, 59, 0);
    expect(getParentSelectableBedtimeHours(date, now)).toEqual([21, 22, 23]);
  });
});

describe("evaluateParentBedtimeChange", () => {
  const base = {
    date: "2026-07-03",
    today: "2026-07-03",
    isExemptDay: false,
    isVacationMode: false,
    isWeekendEveDay: true,
    hasAnswers: false,
    hasResult: false,
    bedtimeHour: 22 as const,
    now: new Date(2026, 6, 3, 18, 0, 0),
  };

  it("休日前日・18時以降でも就寝1時間前までなら変更可", () => {
    expect(evaluateParentBedtimeChange(base).allowed).toBe(true);
  });

  it("免除日は不可", () => {
    expect(
      evaluateParentBedtimeChange({ ...base, isExemptDay: true }).reason,
    ).toBe("exempt");
  });

  it("回答提出後は不可", () => {
    expect(
      evaluateParentBedtimeChange({ ...base, hasAnswers: true }).reason,
    ).toBe("has_answers");
  });

  it("結果作成後は不可", () => {
    expect(
      evaluateParentBedtimeChange({ ...base, hasResult: true }).reason,
    ).toBe("has_result");
  });

  it("就寝1時間前以降は不可", () => {
    expect(
      evaluateParentBedtimeChange({
        ...base,
        now: new Date(2026, 6, 3, 21, 0, 0),
      }).reason,
    ).toBe("past_parent_deadline");
  });

  it("長期休みは子どもの18時以降でも parent 変更可", () => {
    expect(
      evaluateParentBedtimeChange({
        ...base,
        isWeekendEveDay: false,
        isVacationMode: true,
        now: new Date(2026, 6, 3, 19, 0, 0),
      }).allowed,
    ).toBe(true);
  });

  it("移行期間中は parent も変更不可（Issue #36）", () => {
    const result = evaluateParentBedtimeChange({
      ...base,
      isWeekendEveDay: false,
      isVacationMode: true,
      isTransitionPeriod: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("vacation_transition");
  });
});
