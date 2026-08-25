/**
 * @file 月ユーティリティ
 * @description ポイント交換の月次履歴（`YYYY-MM`）ページング用（子ども `/rewards`・保護者 `/parent/rewards` 共用）。
 * @limitation ブラウザのローカルタイムゾーンを使用する。
 */
import { todayLocal } from "@/lib/date";

/**
 * YYYY-MM-DD から YYYY-MM を切り出す
 * @param {string} date - YYYY-MM-DD
 * @returns {string} YYYY-MM
 */
export function toMonth(date: string): string {
  return date.slice(0, 7);
}

/**
 * 今月（ローカル日付基準）
 * @returns {string} YYYY-MM
 */
export function currentMonth(): string {
  return toMonth(todayLocal());
}

/**
 * 月を相対移動する
 * @param {string} month - YYYY-MM
 * @param {number} offset - 移動月数（負=過去）
 * @returns {string} 移動後の YYYY-MM
 */
export function shiftMonth(month: string, offset: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * 月ラベル（例: 2026年8月）を返す
 * @param {string} month - YYYY-MM
 * @returns {string} 表示ラベル
 */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return `${y}年${m}月`;
}
