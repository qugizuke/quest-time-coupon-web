/**
 * @file Session Storage ラッパー
 * @description クエスト下書き・タイマー状態の永続化。
 */
import type { BedtimeHour, QuestDraft } from "@/types/api";

/** タイマーフェーズ */
export type TimerPhase = "running" | "penalty";

/** タイマー Session 状態 */
export interface TimerState {
  sessionId: string;
  phase: TimerPhase;
  startedAt: number;
  initialBalanceMinutes: number;
  lastTickAt: number;
}

/**
 * JSON を Session Storage から読み込む
 * @param {string} key - キー
 * @returns {T | null} パース結果。失敗時 null
 */
function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`readJson: key=${key}`, error);
    return null;
  }
}

/**
 * JSON を Session Storage に書き込む
 * @param {string} key - キー
 * @param {unknown} value - 保存値
 */
function writeJson(key: string, value: unknown): void {
  sessionStorage.setItem(key, JSON.stringify(value));
}

/**
 * 下書きキーを生成する
 * @param {string} date - YYYY-MM-DD
 * @returns {string} ストレージキー
 */
export function draftKey(date: string): string {
  return `qtc:draft:${date}`;
}

/** @type {string} タイマーキー */
export const TIMER_KEY = "qtc:timer";

/**
 * 就寝時刻下書きキーを生成する
 * @param {string} date - YYYY-MM-DD
 * @returns {string} ストレージキー
 */
export function bedtimeHourKey(date: string): string {
  return `qtc:bedtimeHour:${date}`;
}

/**
 * 就寝時刻下書きを取得する
 * @param {string} date - 日付
 * @returns {BedtimeHour | null} 保存済みの就寝時刻。未保存は null
 */
export function getBedtimeHourDraft(date: string): BedtimeHour | null {
  try {
    const raw = sessionStorage.getItem(bedtimeHourKey(date));
    if (raw === "21" || raw === "22" || raw === "23") {
      return Number(raw) as BedtimeHour;
    }
    return null;
  } catch (error) {
    console.error(`getBedtimeHourDraft: date=${date}`, error);
    return null;
  }
}

/**
 * 就寝時刻下書きを保存する
 * @param {string} date - 日付
 * @param {BedtimeHour} hour - 就寝時刻（時）
 */
export function setBedtimeHourDraft(date: string, hour: BedtimeHour): void {
  sessionStorage.setItem(bedtimeHourKey(date), String(hour));
}

/**
 * 就寝時刻下書きを削除する
 * @param {string} date - 日付
 */
export function clearBedtimeHourDraft(date: string): void {
  sessionStorage.removeItem(bedtimeHourKey(date));
}

/**
 * クエスト下書きを取得する
 * @param {string} date - 日付
 * @returns {QuestDraft | null} 下書き
 */
export function getQuestDraft(date: string): QuestDraft | null {
  return readJson<QuestDraft>(draftKey(date));
}

/**
 * クエスト下書きを保存する
 * @param {string} date - 日付
 * @param {QuestDraft} draft - 下書き
 */
export function setQuestDraft(date: string, draft: QuestDraft): void {
  writeJson(draftKey(date), draft);
}

/**
 * クエスト下書きを削除する
 * @param {string} date - 日付
 */
export function clearQuestDraft(date: string): void {
  sessionStorage.removeItem(draftKey(date));
  clearQuestSession(date);
  clearBedtimeHourDraft(date);
}

/**
 * クエストセッション開始時刻キーを生成する
 * @param {string} date - YYYY-MM-DD
 * @returns {string} ストレージキー
 */
export function questSessionKey(date: string): string {
  return `qtc:questSession:${date}`;
}

/**
 * クエストセッション開始時刻（ms）を取得する
 * @param {string} date - 日付
 * @returns {number | null} 開始時刻。未記録は null
 */
export function getQuestSessionStartedAt(date: string): number | null {
  try {
    const raw = sessionStorage.getItem(questSessionKey(date));
    if (!raw) return null;
    const ms = Number(raw);
    return Number.isFinite(ms) ? ms : null;
  } catch (error) {
    console.error(`getQuestSessionStartedAt: date=${date}`, error);
    return null;
  }
}

/**
 * クエストセッション開始時刻を記録する（既に記録済みなら上書きしない）
 * @param {string} date - 日付
 */
export function ensureQuestSessionStarted(date: string): void {
  if (getQuestSessionStartedAt(date) != null) return;
  sessionStorage.setItem(questSessionKey(date), String(Date.now()));
}

/**
 * クエストセッション開始時刻を削除する
 * @param {string} date - 日付
 */
export function clearQuestSession(date: string): void {
  sessionStorage.removeItem(questSessionKey(date));
}

/**
 * タイマー状態を取得する
 * @returns {TimerState | null} 状態
 */
export function getTimerState(): TimerState | null {
  return readJson<TimerState>(TIMER_KEY);
}

/**
 * タイマー状態を保存する
 * @param {TimerState} state - 状態
 */
export function setTimerState(state: TimerState): void {
  writeJson(TIMER_KEY, state);
}

/**
 * タイマー状態を削除する
 */
export function clearTimerState(): void {
  sessionStorage.removeItem(TIMER_KEY);
}
