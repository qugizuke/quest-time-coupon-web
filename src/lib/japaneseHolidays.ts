/**
 * @file 日本の祝日判定
 * @description @holiday-jp/holiday_jp を用いて祝日・休日前日を判定する。
 * @limitation 祝日データはライブラリの収録範囲に依存する。
 */
import holiday_jp from "@holiday-jp/holiday_jp";

/**
 * 日付に日数を加算する
 * @param {string} date - YYYY-MM-DD
 * @param {number} days - 加算日数
 * @returns {string} 加算後の YYYY-MM-DD
 */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, "0");
  const nd = String(dt.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

/**
 * 指定日が日本の祝日かどうか
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} 祝日なら true
 */
export function isJapaneseHoliday(date: string): boolean {
  return holiday_jp.isHoliday(date);
}

/**
 * 指定日が土日または祝日かどうか
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} 休日なら true
 */
export function isRestDay(date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  if (day === 0 || day === 6) return true;
  return isJapaneseHoliday(date);
}

/**
 * 翌日が休日（土日または祝日）かどうか
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} 休日前日なら true
 */
export function isEveOfRestDay(date: string): boolean {
  return isRestDay(addDays(date, 1));
}
