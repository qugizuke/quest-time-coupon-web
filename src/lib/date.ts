/**
 * @file 日付ユーティリティ
 * @description ブラウザローカル日付の取得と、画面向けの日本語表示。
 */

/** 曜日ラベル（日〜土） */
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

/**
 * 今日のローカル日付文字列
 * @returns {string} YYYY-MM-DD
 */
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 日付文字列を Date にパースする
 * @param {string} value - YYYY-MM-DD または Date 文字列
 * @returns {Date | null} パース結果（失敗時 null）
 */
export function parseDateString(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 画面表示用の日付（例: 2026年6月6日(土)）
 * @param {string} value - API / Sheet 由来の日付文字列
 * @returns {string} 表示用ラベル
 */
export function formatDateJa(value: string): string {
  const d = parseDateString(value);
  if (!d) {
    return value;
  }
  const weekday = WEEKDAY_JA[d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekday})`;
}
