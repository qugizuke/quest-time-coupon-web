/**
 * @file 子どもホームのモード出し分け
 * @description 通常／免除／長期休み／免除×長期休みの判定と、就寝・起床 UI の表示条件。
 * @limitation 本接続（Issue F）前は HomeData のモックフラグを正とする。
 */
import {
  isWeekendEve,
  resolveQuestDeadlineBedtimeHour,
} from "@/lib/deadline";
import type { BedtimeHour, TodayStatus, WakeUpTime } from "@/types/api";

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

/** 起床候補（7:00〜9:00・30分刻み） */
export const WAKE_UP_OPTIONS: WakeUpTime[] = [
  "07:00",
  "07:30",
  "08:00",
  "08:30",
  "09:00",
];

/** 起床の既定値 */
export const DEFAULT_WAKE_UP: WakeUpTime = "08:00";

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
 * 長期休みモード中に就寝設定できる正午締切を返す
 * @param {string} date - YYYY-MM-DD
 * @returns {Date} 当日 12:00
 */
export function getVacationBedtimeCutoff(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * 長期休みモード中・就寝設定可能か（当日 12:00 前）
 * @param {string} date - YYYY-MM-DD
 * @param {Date} [now] - 判定時刻
 * @returns {boolean} 設定可能なら true
 */
export function isBeforeVacationBedtimeCutoff(
  date: string,
  now: Date = new Date(),
): boolean {
  return now.getTime() < getVacationBedtimeCutoff(date).getTime();
}

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
  // 契約 §3.7: parent は正午期限の対象外（回答/result 無し・対象日・就寝1時間前まで）
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
 * confirm に起床 UI を出すか（金土夜＝休日前夜、または長期休み毎晩）
 * @param {string} date - YYYY-MM-DD
 * @param {boolean} isVacationMode - 長期休みモード中か
 * @returns {boolean} 表示するなら true
 */
export function shouldShowWakeUpSetting(
  date: string,
  isVacationMode: boolean,
): boolean {
  return isVacationMode || isWeekendEve(date);
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

  if (bedtimeHour !== undefined) {
    return "display";
  }

  if (isVacationMode) {
    if (!isBeforeVacationBedtimeCutoff(date, now)) {
      return "locked21";
    }
    if (todayStatus === "unanswered") {
      return "settable";
    }
    return "locked21";
  }

  // 休日前日: 未回答かつ登録前まで設定可（締切判定は呼び出し側でも行う）
  if (todayStatus === "unanswered") {
    return "settable";
  }
  return "hidden";
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
  if (opts.isVacationMode) {
    return isBeforeVacationBedtimeCutoff(opts.date, opts.now);
  }
  return opts.isWeekendEveDay;
}
