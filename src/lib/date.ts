/**
 * @file 日付ユーティリティ
 * @description ブラウザローカル日付の取得と、画面向けの日本語表示。
 *   API 契約の日付境界は JST（Asia/Tokyo）を正とする。
 */

/** @type {string} 契約上の業務タイムゾーン（JST） */
export const JST_TIME_ZONE = "Asia/Tokyo";

/** 曜日ラベル（日〜土） */
const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** JST の時刻分解結果 */
export interface JstClockParts {
  /** @type {string} YYYY-MM-DD（JST） */
  dateYmd: string;
  /** @type {number} 時（0–23） */
  hour: number;
  /** @type {number} 分（0–59） */
  minute: number;
  /** @type {number} 秒（0–59） */
  second: number;
}

/**
 * 指定日時を JST で YYYY-MM-DD に整形する
 * @param {Date} date - 判定対象
 * @returns {string} JST の YYYY-MM-DD
 */
export function formatYmdJst(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: JST_TIME_ZONE });
}

/**
 * 今日の JST 日付文字列
 * @returns {string} YYYY-MM-DD
 */
export function todayJst(): string {
  return formatYmdJst(new Date());
}

/**
 * 指定日時を JST の日付・時刻に分解する
 * @param {Date} [date] - 判定対象（省略時は現在）
 * @returns {JstClockParts} JST の日付と時刻
 */
export function getJstClockParts(date: Date = new Date()): JstClockParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return {
    dateYmd: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    hour: read("hour") % 24,
    minute: read("minute"),
    second: read("second"),
  };
}

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
 * ISO 日時を JST の「○時○分」表示に変換する
 * @param {string | null | undefined} iso - ISO 8601 日時（UTC / オフセット付き）
 * @returns {string} 例: `20時30分`。欠落・不正時は `—`
 */
export function formatJstClockJa(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === "") {
    return "—";
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  const { hour, minute } = getJstClockParts(parsed);
  return `${hour}時${String(minute).padStart(2, "0")}分`;
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

/**
 * 日付を Figma の日本語表記（全角括弧）へ整形する。
 * @param {string} value - YYYY-MM-DD
 * @returns {string} 例: 2026年8月26日（水）
 */
export function formatDateJaFullWidth(value: string): string {
  return formatDateJa(value).replace("(", "（").replace(")", "）");
}

/**
 * 日付の「日」だけを返す（週カード用）
 * @param {string} value - YYYY-MM-DD
 * @returns {string} 例: 28
 */
export function formatDayNumber(value: string): string {
  const d = parseDateString(value);
  if (!d) return value;
  return String(d.getDate());
}

/**
 * 日付の曜日ラベルを返す（週カード用）
 * @param {string} value - YYYY-MM-DD
 * @returns {string} 例: 火
 */
export function formatWeekdayJa(value: string): string {
  const d = parseDateString(value);
  if (!d) return "";
  return WEEKDAY_JA[d.getDay()];
}
