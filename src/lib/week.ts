/**
 * @file 週ユーティリティ
 * @description 月曜始まりの週ページング（保護者 grades 一覧用）。
 * @limitation ブラウザのローカルタイムゾーンを使用する。
 */

/**
 * 日付を YYYY-MM-DD にフォーマットする
 * @param {Date} date - 日付
 * @returns {string} YYYY-MM-DD
 */
export function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * YYYY-MM-DD をローカル Date に変換する
 * @param {string} value - YYYY-MM-DD
 * @returns {Date} ローカル日付（0:00）
 * @throws {Error} 形式が不正な場合
 */
export function parseIsoDateLocal(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`parseIsoDateLocal: 日付形式が不正です value=${value}`);
  }
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * 指定日を含む週の月曜日を返す
 * @param {string} date - YYYY-MM-DD
 * @returns {string} 月曜日の YYYY-MM-DD
 */
export function getMondayOfWeek(date: string): string {
  const d = parseIsoDateLocal(date);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return formatDateIso(d);
}

/**
 * 週オフセットから月曜日を返す（0=基準週）
 * @param {string} baseDate - 基準日 YYYY-MM-DD
 * @param {number} weekOffset - 週の相対オフセット（負=過去）
 * @returns {string} 当該週月曜日
 */
export function getMondayWithOffset(baseDate: string, weekOffset: number): string {
  const monday = parseIsoDateLocal(getMondayOfWeek(baseDate));
  monday.setDate(monday.getDate() + weekOffset * 7);
  return formatDateIso(monday);
}

/**
 * 月曜日から日曜までの7日を返す
 * @param {string} monday - 月曜日 YYYY-MM-DD
 * @returns {string[]} 月〜日の YYYY-MM-DD
 */
export function getWeekDates(monday: string): string[] {
  const start = parseIsoDateLocal(monday);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatDateIso(d);
  });
}

/**
 * 週ラベル（例: 7月28日の週）を返す
 * @param {string} monday - 月曜日 YYYY-MM-DD
 * @returns {string} 表示ラベル
 */
export function formatWeekLabel(monday: string): string {
  const d = parseIsoDateLocal(monday);
  return `${d.getMonth() + 1}月${d.getDate()}日の週`;
}

/**
 * 基準日から対象日までの週オフセットを返す（対象側の月曜 − 基準側の月曜）
 * @param {string} baseDate - 基準日 YYYY-MM-DD（通常は今日）
 * @param {string} targetDate - 対象日 YYYY-MM-DD
 * @returns {number} 週オフセット（負=過去、0=同週）
 */
export function getWeekOffsetBetween(baseDate: string, targetDate: string): number {
  const baseMonday = parseIsoDateLocal(getMondayOfWeek(baseDate));
  const targetMonday = parseIsoDateLocal(getMondayOfWeek(targetDate));
  const diffMs = targetMonday.getTime() - baseMonday.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}
