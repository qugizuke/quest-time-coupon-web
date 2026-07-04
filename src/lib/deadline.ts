/**
 * @file クエスト登録締切ユーティリティ
 * @description 定時ボーナス締切と登録受付締切を判定する（v5: bedtime 対応）。
 * @limitation ブラウザのローカルタイムゾーンを使用する。
 */
import { isEveOfRestDay } from "@/lib/japaneseHolidays";
import type { BedtimeHour } from "@/types/api";

/** @type {number} 定時ボーナス締切の時（平日デフォルト） */
export const QUEST_BONUS_DEADLINE_HOUR = 20;

/** @type {number} 定時ボーナス締切の分（平日デフォルト） */
export const QUEST_BONUS_DEADLINE_MINUTE = 30;

/** @type {number} 登録受付締切の時（平日デフォルト） */
export const QUEST_REGISTRATION_CUTOFF_HOUR = 21;

/** @type {number} 登録受付締切の分 */
export const QUEST_REGISTRATION_CUTOFF_MINUTE = 0;

/** @type {number} 休日前夜の未選択デフォルト就寝時刻（時） */
export const WEEKEND_EVE_DEFAULT_BEDTIME_HOUR = 23;

/** @type {number} ボーナス締切カウントダウン表示開始の時（平日デフォルト） */
export const QUEST_COUNTDOWN_START_HOUR = 20;

/** @type {number} ボーナス締切カウントダウン表示開始の分 */
export const QUEST_COUNTDOWN_START_MINUTE = 0;

/**
 * 就寝時刻を正規化する
 * @param {number | undefined} bedtimeHour - 就寝時刻（時）
 * @returns {BedtimeHour} 21 / 22 / 23
 */
export function normalizeBedtimeHour(bedtimeHour?: number): BedtimeHour {
  if (bedtimeHour === 22 || bedtimeHour === 23) return bedtimeHour;
  return 21;
}

/**
 * 休日前日かどうか（翌日が土日または日本の祝日）
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} 就寝時刻選択可能日なら true
 */
export function isWeekendEve(date: string): boolean {
  return isEveOfRestDay(date);
}

/**
 * 締切計算用の就寝時刻を返す
 * @param {string} date - YYYY-MM-DD
 * @param {number | undefined} bedtimeHour - 明示指定の就寝時刻（時）
 * @returns {BedtimeHour} 締切計算に使う就寝時刻
 */
export function resolveQuestDeadlineBedtimeHour(
  date: string,
  bedtimeHour?: number,
): BedtimeHour {
  if (bedtimeHour !== undefined) {
    return normalizeBedtimeHour(bedtimeHour);
  }
  return isWeekendEve(date) ? WEEKEND_EVE_DEFAULT_BEDTIME_HOUR : 21;
}

/**
 * 指定日の定時ボーナス締切を返す（就寝30分前）
 * @param {string} date - YYYY-MM-DD
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {Date} ボーナス締切
 */
export function getQuestBonusDeadline(date: string, bedtimeHour?: number): Date {
  const hour = resolveQuestDeadlineBedtimeHour(date, bedtimeHour);
  const [y, m, d] = date.split("-").map(Number);
  const bedtime = new Date(y, m - 1, d, hour, 0, 0, 0);
  return new Date(bedtime.getTime() - 30 * 60 * 1000);
}

/**
 * 指定日の登録受付開始を返す（就寝1時間前）
 * @param {string} date - YYYY-MM-DD
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {Date} 受付開始
 */
export function getQuestRegistrationStart(date: string, bedtimeHour?: number): Date {
  const hour = resolveQuestDeadlineBedtimeHour(date, bedtimeHour);
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour - 1, 0, 0, 0);
}

/**
 * 指定日の登録受付締切を返す
 * @param {string} date - YYYY-MM-DD
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {Date} 登録締切
 */
export function getQuestRegistrationCutoff(date: string, bedtimeHour?: number): Date {
  const hour = resolveQuestDeadlineBedtimeHour(date, bedtimeHour);
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

/**
 * ボーナス締切カウントダウン表示開始時刻（ボーナス締切30分前）を返す
 * @param {string} date - YYYY-MM-DD
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {Date} カウントダウン開始
 */
export function getQuestCountdownStart(date: string, bedtimeHour?: number): Date {
  return getQuestRegistrationStart(date, bedtimeHour);
}

/**
 * ボーナス締切カウントダウンを表示する時間帯か
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {boolean} 表示対象なら true
 */
export function isQuestBonusCountdownVisible(
  date: string,
  now: Date = new Date(),
  bedtimeHour?: number,
): boolean {
  const ms = now.getTime();
  return (
    ms >= getQuestCountdownStart(date, bedtimeHour).getTime() &&
    ms < getQuestBonusDeadline(date, bedtimeHour).getTime()
  );
}

/**
 * 登録受付締切カウントダウンを表示する時間帯か
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {boolean} 表示対象なら true
 */
export function isQuestRegistrationCutoffCountdownVisible(
  date: string,
  now: Date = new Date(),
  bedtimeHour?: number,
): boolean {
  const ms = now.getTime();
  return (
    ms >= getQuestBonusDeadline(date, bedtimeHour).getTime() &&
    ms < getQuestRegistrationCutoff(date, bedtimeHour).getTime()
  );
}

/**
 * 登録受付締切までの残りミリ秒
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {number} 残り ms（締切後は 0）
 */
export function getMsUntilQuestRegistrationCutoff(
  date: string,
  now: Date = new Date(),
  bedtimeHour?: number,
): number {
  return Math.max(
    0,
    getQuestRegistrationCutoff(date, bedtimeHour).getTime() - now.getTime(),
  );
}

/**
 * 定時ボーナス締切までの残りミリ秒
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {number} 残り ms（締切後は 0）
 */
export function getMsUntilQuestBonusDeadline(
  date: string,
  now: Date = new Date(),
  bedtimeHour?: number,
): number {
  return Math.max(
    0,
    getQuestBonusDeadline(date, bedtimeHour).getTime() - now.getTime(),
  );
}

/**
 * 残り時間を MM:SS 形式で整形する
 * @param {number} ms - 残りミリ秒
 * @returns {string} 例: "12:34"
 */
export function formatDeadlineCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * 定時ボーナス締切を過ぎているか
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {boolean} 超過なら true
 */
export function isPastQuestBonusDeadline(
  date: string,
  now: Date = new Date(),
  bedtimeHour?: number,
): boolean {
  return now.getTime() > getQuestBonusDeadline(date, bedtimeHour).getTime();
}

/**
 * 登録受付締切を過ぎているか
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {boolean} 超過なら true
 */
export function isPastQuestRegistrationCutoff(
  date: string,
  now: Date = new Date(),
  bedtimeHour?: number,
): boolean {
  return now.getTime() > getQuestRegistrationCutoff(date, bedtimeHour).getTime();
}

/**
 * 登録受付開始前か
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {boolean} 受付開始前なら true
 */
export function isBeforeQuestRegistrationStart(
  date: string,
  now: Date = new Date(),
  bedtimeHour?: number,
): boolean {
  return now.getTime() < getQuestRegistrationStart(date, bedtimeHour).getTime();
}

/**
 * 登録受付中か（受付開始〜締切の間）
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {boolean} 受付中なら true
 */
export function isQuestRegistrationOpen(
  date: string,
  now: Date = new Date(),
  bedtimeHour?: number,
): boolean {
  return (
    !isBeforeQuestRegistrationStart(date, now, bedtimeHour) &&
    !isPastQuestRegistrationCutoff(date, now, bedtimeHour)
  );
}

/**
 * 定時ボーナス締切の表示ラベル
 * @param {string} date - 対象日
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {string} 例: "20:30"
 */
export function formatQuestBonusDeadlineLabel(
  date: string,
  bedtimeHour?: number,
): string {
  const d = getQuestBonusDeadline(date, bedtimeHour);
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

/**
 * 登録受付締切の表示ラベル
 * @param {string} date - 対象日
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {string} 例: "21:00"
 */
export function formatQuestRegistrationCutoffLabel(
  date: string,
  bedtimeHour?: number,
): string {
  const hour = String(resolveQuestDeadlineBedtimeHour(date, bedtimeHour)).padStart(2, "0");
  return `${hour}:00`;
}

/**
 * 登録受付開始の表示ラベル
 * @param {string} date - 対象日
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {string} 例: "20:00"
 */
export function formatQuestRegistrationStartLabel(
  date: string,
  bedtimeHour?: number,
): string {
  const hour = resolveQuestDeadlineBedtimeHour(date, bedtimeHour);
  return `${String(hour - 1).padStart(2, "0")}:00`;
}
