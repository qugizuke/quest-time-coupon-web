/**
 * @file クエスト登録締切ユーティリティ
 * @description 毎日のクエスト登録締切（20:30）の判定を行う。
 * @limitation ブラウザのローカルタイムゾーンを使用する。
 */

/** @type {number} クエスト登録締切の時（24時間表記） */
export const QUEST_DEADLINE_HOUR = 20;

/** @type {number} クエスト登録締切の分 */
export const QUEST_DEADLINE_MINUTE = 30;

/** @type {number} 締切カウントダウン表示開始の時（24時間表記） */
export const QUEST_COUNTDOWN_START_HOUR = 20;

/** @type {number} 締切カウントダウン表示開始の分 */
export const QUEST_COUNTDOWN_START_MINUTE = 0;

/**
 * 指定日の登録締切時刻（ローカル）を返す
 * @param {string} date - YYYY-MM-DD
 * @returns {Date} 締切 Date（その日 20:30:00.000）
 */
export function getQuestDeadline(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, QUEST_DEADLINE_HOUR, QUEST_DEADLINE_MINUTE, 0, 0);
}

/**
 * カウントダウン表示開始時刻（ローカル）を返す
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
 * 締切カウントダウンを表示する時間帯か（20:00 以上かつ 20:30 未満）
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @returns {boolean} 表示対象なら true
 */
export function isQuestDeadlineCountdownVisible(
  date: string,
  now: Date = new Date(),
): boolean {
  const ms = now.getTime();
  return ms >= getQuestCountdownStart(date).getTime() && ms < getQuestDeadline(date).getTime();
}

/**
 * 登録締切までの残りミリ秒
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻
 * @returns {number} 残り ms（締切後は 0）
 */
export function getMsUntilQuestDeadline(date: string, now: Date = new Date()): number {
  return Math.max(0, getQuestDeadline(date).getTime() - now.getTime());
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
 * 指定日の登録締切を過ぎているか
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {Date} [now] - 判定基準時刻（省略時は現在）
 * @returns {boolean} 締切後なら true
 */
export function isPastQuestDeadline(date: string, now: Date = new Date()): boolean {
  return now.getTime() > getQuestDeadline(date).getTime();
}

/**
 * 画面表示用の締切ラベル
 * @returns {string} 例: "20:30"
 */
export function formatQuestDeadlineLabel(): string {
  const hour = String(QUEST_DEADLINE_HOUR).padStart(2, "0");
  const minute = String(QUEST_DEADLINE_MINUTE).padStart(2, "0");
  return `${hour}:${minute}`;
}
