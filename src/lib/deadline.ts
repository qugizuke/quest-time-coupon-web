/**
 * @file クエスト登録締切ユーティリティ
 * @description 定時ボーナス締切（20:30）と登録受付締切（21:00）を判定する。
 * @limitation ブラウザのローカルタイムゾーンを使用する。
 */

/** @type {number} 定時ボーナス締切の時（+15分） */
export const QUEST_BONUS_DEADLINE_HOUR = 20;

/** @type {number} 定時ボーナス締切の分 */
export const QUEST_BONUS_DEADLINE_MINUTE = 30;

/** @type {number} 登録受付締切の時 */
export const QUEST_REGISTRATION_CUTOFF_HOUR = 21;

/** @type {number} 登録受付締切の分 */
export const QUEST_REGISTRATION_CUTOFF_MINUTE = 0;

/** @type {number} ボーナス締切カウントダウン表示開始の時 */
export const QUEST_COUNTDOWN_START_HOUR = 20;

/** @type {number} ボーナス締切カウントダウン表示開始の分 */
export const QUEST_COUNTDOWN_START_MINUTE = 0;

/**
 * 指定日の定時ボーナス締切（20:30）を返す
 * @param {string} date - YYYY-MM-DD
 * @returns {Date} その日 20:30:00.000
 */
export function getQuestBonusDeadline(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, QUEST_BONUS_DEADLINE_HOUR, QUEST_BONUS_DEADLINE_MINUTE, 0, 0);
}

/**
 * 指定日の登録受付締切（21:00）を返す
 * @param {string} date - YYYY-MM-DD
 * @returns {Date} その日 21:00:00.000
 */
export function getQuestRegistrationCutoff(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(
    y,
    m - 1,
    d,
    QUEST_REGISTRATION_CUTOFF_HOUR,
    QUEST_REGISTRATION_CUTOFF_MINUTE,
    0,
    0,
  );
}

/**
 * ボーナス締切カウントダウン表示開始時刻（20:00）を返す
 * @param {string} date - YYYY-MM-DD
 * @returns {Date} その日 20:00:00.000
 */
export function getQuestCountdownStart(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(
    y,
    m - 1,
    d,
    QUEST_COUNTDOWN_START_HOUR,
    QUEST_COUNTDOWN_START_MINUTE,
    0,
    0,
  );
}

/**
 * ボーナス締切カウントダウンを表示する時間帯か（20:00 以上かつ 20:30 未満）
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @returns {boolean} 表示対象なら true
 */
export function isQuestBonusCountdownVisible(
  date: string,
  now: Date = new Date(),
): boolean {
  const ms = now.getTime();
  return (
    ms >= getQuestCountdownStart(date).getTime() &&
    ms < getQuestBonusDeadline(date).getTime()
  );
}

/**
 * 登録受付締切カウントダウンを表示する時間帯か（20:30 以上かつ 21:00 未満）
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @returns {boolean} 表示対象なら true
 */
export function isQuestRegistrationCutoffCountdownVisible(
  date: string,
  now: Date = new Date(),
): boolean {
  const ms = now.getTime();
  return (
    ms >= getQuestBonusDeadline(date).getTime() &&
    ms < getQuestRegistrationCutoff(date).getTime()
  );
}

/**
 * 登録受付締切（21:00）までの残りミリ秒
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @returns {number} 残り ms（締切後は 0）
 */
export function getMsUntilQuestRegistrationCutoff(date: string, now: Date = new Date()): number {
  return Math.max(0, getQuestRegistrationCutoff(date).getTime() - now.getTime());
}

/**
 * 定時ボーナス締切までの残りミリ秒
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @returns {number} 残り ms（締切後は 0）
 */
export function getMsUntilQuestBonusDeadline(date: string, now: Date = new Date()): number {
  return Math.max(0, getQuestBonusDeadline(date).getTime() - now.getTime());
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
 * 定時ボーナス締切（20:30）を過ぎているか
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @returns {boolean} 20:30 超過なら true
 */
export function isPastQuestBonusDeadline(date: string, now: Date = new Date()): boolean {
  return now.getTime() > getQuestBonusDeadline(date).getTime();
}

/**
 * 登録受付締切（21:00）を過ぎているか
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @returns {boolean} 21:00 超過なら true
 */
export function isPastQuestRegistrationCutoff(date: string, now: Date = new Date()): boolean {
  return now.getTime() > getQuestRegistrationCutoff(date).getTime();
}

/**
 * 定時ボーナス締切の表示ラベル
 * @returns {string} 例: "20:30"
 */
export function formatQuestBonusDeadlineLabel(): string {
  const hour = String(QUEST_BONUS_DEADLINE_HOUR).padStart(2, "0");
  const minute = String(QUEST_BONUS_DEADLINE_MINUTE).padStart(2, "0");
  return `${hour}:${minute}`;
}

/**
 * 登録受付締切の表示ラベル
 * @returns {string} 例: "21:00"
 */
export function formatQuestRegistrationCutoffLabel(): string {
  const hour = String(QUEST_REGISTRATION_CUTOFF_HOUR).padStart(2, "0");
  const minute = String(QUEST_REGISTRATION_CUTOFF_MINUTE).padStart(2, "0");
  return `${hour}:${minute}`;
}
