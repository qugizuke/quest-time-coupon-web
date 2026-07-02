/**
 * @file クエスト登録締切ユーティリティ
 * @description 定時ボーナス締切と登録受付締切を判定する（v5: bedtime 対応）。
 * @limitation ブラウザのローカルタイムゾーンを使用する。
 */
import type { BedtimeHour } from "@/types/api";

/** @type {number} 定時ボーナス締切の時（平日デフォルト） */
export const QUEST_BONUS_DEADLINE_HOUR = 20;

/** @type {number} 定時ボーナス締切の分（平日デフォルト） */
export const QUEST_BONUS_DEADLINE_MINUTE = 30;

/** @type {number} 登録受付締切の時（平日デフォルト） */
export const QUEST_REGISTRATION_CUTOFF_HOUR = 21;

/** @type {number} 登録受付締切の分 */
export const QUEST_REGISTRATION_CUTOFF_MINUTE = 0;

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
 * 金曜・土曜（休日前日）かどうか
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} 金・土なら true
 */
export function isWeekendEve(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 5 || day === 6;
}

/**
 * 指定日の定時ボーナス締切を返す（就寝30分前）
 * @param {string} date - YYYY-MM-DD
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {Date} ボーナス締切
 */
export function getQuestBonusDeadline(date: string, bedtimeHour?: number): Date {
  const hour = normalizeBedtimeHour(bedtimeHour);
  const [y, m, d] = date.split("-").map(Number);
  const bonusMinute = hour === 21 ? 30 : 0;
  const bonusHour = hour === 21 ? 20 : hour - 1;
  return new Date(y, m - 1, d, bonusHour, bonusMinute, 0, 0);
}

/**
 * 指定日の登録受付締切を返す
 * @param {string} date - YYYY-MM-DD
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {Date} 登録締切
 */
export function getQuestRegistrationCutoff(date: string, bedtimeHour?: number): Date {
  const hour = normalizeBedtimeHour(bedtimeHour);
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
  const bonus = getQuestBonusDeadline(date, bedtimeHour);
  return new Date(bonus.getTime() - 30 * 60 * 1000);
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
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {string} 例: "21:00"
 */
export function formatQuestRegistrationCutoffLabel(bedtimeHour?: number): string {
  const hour = String(normalizeBedtimeHour(bedtimeHour)).padStart(2, "0");
  return `${hour}:00`;
}
