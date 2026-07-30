/**
 * @file 子どもホームのモード出し分け
 * @description 通常／免除／長期休み／免除×長期休みの判定と、就寝・起床 UI の表示条件。
 * @limitation 本接続（Issue F）前は HomeData のモックフラグを正とする。
 */
import { isWeekendEve } from "@/lib/deadline";
import type { BedtimeHour, TodayStatus, WakeUpTime } from "@/types/api";

/** ホーム UI バリアント（Figma kid-home*） */
export type HomeVariant =
  | "kid-home"
  | "kid-home-exempt"
  | "kid-home-vacation"
  | "kid-home-exempt-vacation";

/** 就寝 UI の表示モード */
export type BedtimeUiMode = "hidden" | "settable" | "display" | "locked21";

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
