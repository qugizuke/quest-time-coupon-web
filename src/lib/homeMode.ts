/**
 * @file 子どもホームのモード出し分け
 * @description 通常／免除／長期休み／免除×長期休みの判定と、就寝・起床 UI の表示条件。
 *   長期休み最終日（翌日が平日）は起床 UI を出さず、wakePromise も送らない
 *   （Functions が 07:15 を自動書き込みする）。
 * @limitation 最終日判定には長期休みの期間（start/end）が必要。期間不明時は従来どおり表示側に倒す。
 */
import {
  isWeekendEve,
  resolveQuestDeadlineBedtimeHour,
} from "@/lib/deadline";
import { addDays, isRestDay } from "@/lib/japaneseHolidays";
import type {
  BedtimeHour,
  SelectableWakeTime,
  TodayStatus,
} from "@/types/api";

/** ホーム UI バリアント（Figma kid-home*） */
export type HomeVariant =
  | "kid-home"
  | "kid-home-exempt"
  | "kid-home-vacation"
  | "kid-home-exempt-vacation";

/** 就寝 UI の表示モード */
export type BedtimeUiMode = "hidden" | "settable" | "display" | "locked21";

/** 保護者就寝変更が不可な理由 */
export type ParentBedtimeBlockReason =
  | "not_today"
  | "exempt"
  | "not_target_day"
  | "has_result"
  | "has_answers"
  | "before_child_deadline"
  | "past_parent_deadline";

/** 長期休み期間（両端含む YYYY-MM-DD） */
export interface LongVacationPeriod {
  /** @type {string} 開始日 */
  startDate: string;
  /** @type {string} 終了日 */
  endDate: string;
}

/** 起床候補（7:00〜9:00・30分刻み。保存専用 07:15 は含めない） */
export const WAKE_UP_OPTIONS: SelectableWakeTime[] = [
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
];

/** 起床の既定値（UI 省略時） */
export const DEFAULT_WAKE_UP: SelectableWakeTime = "08:00";

/** Functions が長期休み最終日（翌日平日）に自動書き込みする起床時刻 */
export const AUTO_WAKE_TIME_VACATION_LAST_DAY = "07:15" as const;

/** 子どもが就寝時刻を設定できる終端時刻（時）。この時刻以降は不可 */
export const CHILD_BEDTIME_SETTING_CUTOFF_HOUR = 18;

/**
 * ホーム 4 バリアントを返す
 * @param {boolean} isExemptDay - クエスト免除日か
 * @param {boolean} isVacationMode - 長期休みモード中か
 * @returns {HomeVariant} バリアント名
 */
export function resolveHomeVariant(
  isExemptDay: boolean,
  isVacationMode: boolean,
): HomeVariant {
  if (isVacationMode && isExemptDay) return "kid-home-exempt-vacation";
  if (isVacationMode) return "kid-home-vacation";
  if (isExemptDay) return "kid-home-exempt";
  return "kid-home";
}

/**
 * 子どもが就寝設定できる当日締切（18:00）を返す
 * @param {string} date - YYYY-MM-DD
 * @returns {Date} 当日 18:00
 */
export function getChildBedtimeSettingCutoff(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, CHILD_BEDTIME_SETTING_CUTOFF_HOUR, 0, 0, 0);
}

/**
 * @deprecated getChildBedtimeSettingCutoff を使う（正午制限は廃止・18時に統一）
 * @param {string} date - YYYY-MM-DD
 * @returns {Date} 子ども就寝設定締切
 */
export function getVacationBedtimeCutoff(date: string): Date {
  return getChildBedtimeSettingCutoff(date);
}

/**
 * 子どもが就寝設定可能か（当日 18:00 未満）
 * @param {string} date - YYYY-MM-DD
 * @param {Date} [now] - 判定時刻
 * @returns {boolean} 設定可能なら true
 */
export function isBeforeChildBedtimeSettingCutoff(
  date: string,
  now: Date = new Date(),
): boolean {
  return now.getTime() < getChildBedtimeSettingCutoff(date).getTime();
}

/**
 * @deprecated isBeforeChildBedtimeSettingCutoff を使う
 * @param {string} date - YYYY-MM-DD
 * @param {Date} [now] - 判定時刻
 * @returns {boolean} 設定可能なら true
 */
export function isBeforeVacationBedtimeCutoff(
  date: string,
  now: Date = new Date(),
): boolean {
  return isBeforeChildBedtimeSettingCutoff(date, now);
}

/** 保護者が選べる就寝候補（仕様正・22:30 不可） */
export const PARENT_BEDTIME_HOUR_OPTIONS: readonly BedtimeHour[] = [21, 22, 23];

/**
 * 保護者の就寝変更期限（就寝 1 時間前）を返す
 * @param {string} date - YYYY-MM-DD
 * @param {number} [bedtimeHour] - 設定中／変更先の就寝時刻
 * @returns {Date} 変更可能な終端（この時刻以降は不可）
 */
export function getParentBedtimeChangeDeadline(
  date: string,
  bedtimeHour?: number,
): Date {
  const hour = resolveQuestDeadlineBedtimeHour(date, bedtimeHour);
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour - 1, 0, 0, 0);
}

/**
 * 保護者が指定就寝時刻をまだ選べるか（変更先の 1 時間前まで）
 * @param {string} date - YYYY-MM-DD
 * @param {BedtimeHour} bedtimeHour - 変更先の就寝時刻（時）
 * @param {Date} [now] - 判定時刻
 * @returns {boolean} 選択・保存可なら true
 */
export function isParentBedtimeHourSelectable(
  date: string,
  bedtimeHour: BedtimeHour,
  now: Date = new Date(),
): boolean {
  const deadline = getParentBedtimeChangeDeadline(date, bedtimeHour);
  return now.getTime() < deadline.getTime();
}

/**
 * 保護者 UI に表示する就寝候補（期限切れを除く）
 * @param {string} date - YYYY-MM-DD
 * @param {Date} [now] - 判定時刻
 * @returns {BedtimeHour[]} 選択可能な就寝時刻一覧
 */
export function getParentSelectableBedtimeHours(
  date: string,
  now: Date = new Date(),
): BedtimeHour[] {
  return PARENT_BEDTIME_HOUR_OPTIONS.filter((hour) =>
    isParentBedtimeHourSelectable(date, hour, now),
  );
}

/**
 * 保護者が当日就寝を変更できるか（wireframes §4.4 / api-tobe-f-contract）
 * @param {object} opts - 判定材料
 * @returns {{ allowed: boolean; reason: ParentBedtimeBlockReason | null; message: string }} 判定結果
 */
export function evaluateParentBedtimeChange(opts: {
  date: string;
  today: string;
  isExemptDay: boolean;
  isVacationMode: boolean;
  isWeekendEveDay: boolean;
  hasAnswers: boolean;
  hasResult: boolean;
  bedtimeHour?: number;
  now?: Date;
}): {
  allowed: boolean;
  reason: ParentBedtimeBlockReason | null;
  message: string;
} {
  const now = opts.now ?? new Date();
  if (opts.date !== opts.today) {
    return {
      allowed: false,
      reason: "not_today",
      message: "当日以外の就寝時刻は変更できません",
    };
  }
  if (opts.isExemptDay) {
    return {
      allowed: false,
      reason: "exempt",
      message: "免除日は就寝時刻を変更できません",
    };
  }
  if (!opts.isVacationMode && !opts.isWeekendEveDay) {
    return {
      allowed: false,
      reason: "not_target_day",
      message: "休日前日または長期休みモード中のみ就寝時刻を変更できます",
    };
  }
  if (opts.hasResult) {
    return {
      allowed: false,
      reason: "has_result",
      message: "結果作成済みのため就寝時刻を変更できません",
    };
  }
  if (opts.hasAnswers) {
    return {
      allowed: false,
      reason: "has_answers",
      message: "回答提出後は就寝時刻を変更できません",
    };
  }
  // parent は子どもの 18:00 期限の対象外（回答/result 無し・対象日・就寝1時間前まで）
  const deadline = getParentBedtimeChangeDeadline(opts.date, opts.bedtimeHour);
  if (now.getTime() >= deadline.getTime()) {
    return {
      allowed: false,
      reason: "past_parent_deadline",
      message: "就寝1時間前を過ぎているため変更できません",
    };
  }
  return { allowed: true, reason: null, message: "" };
}

/**
 * 日付が長期休み期間（両端含む）に含まれるか
 * @param {string} date - YYYY-MM-DD
 * @param {LongVacationPeriod | null | undefined} period - 期間
 * @returns {boolean} 含まれるなら true
 */
export function isDateInLongVacation(
  date: string,
  period: LongVacationPeriod | null | undefined,
): boolean {
  if (!period?.startDate || !period?.endDate) return false;
  return date >= period.startDate && date <= period.endDate;
}

/**
 * 長期休み最終日かつ翌日が平日か（Functions の wakePromise 自動 07:15 条件と同値）
 * @description
 *   - 当日は長期休みに含まれる
 *   - 翌日は長期休みに含まれない
 *   - 翌日が平日（土日祝以外）
 * @param {string} date - YYYY-MM-DD
 * @param {LongVacationPeriod | null | undefined} period - 長期休み期間
 * @returns {boolean} 条件を満たすなら true
 */
export function isLongVacationFinalDayBeforeWeekday(
  date: string,
  period: LongVacationPeriod | null | undefined,
): boolean {
  if (!isDateInLongVacation(date, period)) return false;
  const tomorrow = addDays(date, 1);
  if (isDateInLongVacation(tomorrow, period)) return false;
  return !isRestDay(tomorrow);
}

/**
 * confirm に起床 UI を出すか
 * @description 休日前夜、または長期休み中（最終日かつ翌日平日を除く）。
 *   最終日（翌日平日）は UI 非表示・wakePromise 未送信（Functions が 07:15 を書く）。
 * @param {string} date - YYYY-MM-DD
 * @param {boolean} isVacationMode - 長期休みモード中か（home.isLongVacation）
 * @param {LongVacationPeriod | null | undefined} [vacationPeriod] - 長期休み期間（最終日判定用）
 * @returns {boolean} 表示するなら true
 */
export function shouldShowWakeUpSetting(
  date: string,
  isVacationMode: boolean,
  vacationPeriod?: LongVacationPeriod | null,
): boolean {
  if (isWeekendEve(date)) return true;
  if (!isVacationMode) return false;
  if (isLongVacationFinalDayBeforeWeekday(date, vacationPeriod)) {
    return false;
  }
  return true;
}

/**
 * ホームの就寝 UI モードを返す（免除日は常に非表示＝仕様勝ち）
 * @param {object} opts - 判定材料
 * @param {boolean} opts.isExemptDay - 免除日
 * @param {boolean} opts.isVacationMode - 長期休み
 * @param {boolean} opts.isWeekendEveDay - 休日前日
 * @param {BedtimeHour | undefined} opts.bedtimeHour - 設定済み就寝
 * @param {TodayStatus} opts.todayStatus - 今日の状態
 * @param {string} opts.date - YYYY-MM-DD
 * @param {Date} [opts.now] - 判定時刻
 * @returns {BedtimeUiMode} 表示モード
 */
export function resolveBedtimeUiMode(opts: {
  isExemptDay: boolean;
  isVacationMode: boolean;
  isWeekendEveDay: boolean;
  bedtimeHour: BedtimeHour | undefined;
  todayStatus: TodayStatus;
  date: string;
  now?: Date;
}): BedtimeUiMode {
  const {
    isExemptDay,
    isVacationMode,
    isWeekendEveDay,
    bedtimeHour,
    todayStatus,
    date,
    now = new Date(),
  } = opts;

  if (isExemptDay) {
    return "hidden";
  }

  if (!isVacationMode && !isWeekendEveDay) {
    return "hidden";
  }

  const beforeCutoff = isBeforeChildBedtimeSettingCutoff(date, now);
  const unanswered = todayStatus === "unanswered";

  if (bedtimeHour !== undefined) {
    if (beforeCutoff && unanswered) {
      return "settable";
    }
    return "display";
  }

  if (!beforeCutoff) {
    return "locked21";
  }

  if (unanswered) {
    return "settable";
  }

  return "locked21";
}

/**
 * 子どもが就寝時刻を API 保存できる場面か
 * @param {object} opts - 判定材料
 * @param {boolean} opts.isExemptDay - 免除日
 * @param {boolean} opts.isVacationMode - 長期休み
 * @param {boolean} opts.isWeekendEveDay - 休日前日
 * @param {string} opts.date - YYYY-MM-DD
 * @param {Date} [opts.now] - 判定時刻
 * @returns {boolean} 保存可なら true
 */
export function canChildSaveBedtime(opts: {
  isExemptDay: boolean;
  isVacationMode: boolean;
  isWeekendEveDay: boolean;
  date: string;
  now?: Date;
}): boolean {
  if (opts.isExemptDay) return false;
  if (!opts.isVacationMode && !opts.isWeekendEveDay) return false;
  return isBeforeChildBedtimeSettingCutoff(opts.date, opts.now);
}
