/**
 * @file 登録再開 endsAt 組み立て
 * @description 契約 §2.3/§3.8 の Web 書込形式 `YYYY-MM-DDTHH:mm:ss+09:00` で
 *   「いまから N 分」のタイマー候補から endsAt を組み立てる。
 *   時刻判定はブラウザローカルではなく JST（Asia/Tokyo）を正とする。
 * @limitation 日付またぎ（翌日の endsAt）を許容する。
 */
import { formatJstClockJa, getJstClockParts } from "@/lib/date";
import type {
  HomeRegistrationReopen,
  ParentRegistrationReopen,
} from "@/types/api";

/** 再開タイマー候補（分） */
export type ReopenDurationMinutes = 30 | 60 | 90 | 120;

/**
 * 再開タイマー候補定義
 * @property {ReopenDurationMinutes} minutes - いまからの分数
 * @property {string} label - セレクト表示ラベル
 */
export interface ReopenDurationOption {
  /** @type {ReopenDurationMinutes} いまからの分数 */
  minutes: ReopenDurationMinutes;
  /** @type {string} セレクト表示ラベル */
  label: string;
}

/**
 * UI 用のタイマー候補（30分刻み・最大2時間）
 * @type {ReopenDurationOption[]}
 */
export const REOPEN_DURATION_OPTIONS: ReopenDurationOption[] = [
  { minutes: 30, label: "30分" },
  { minutes: 60, label: "1時間" },
  { minutes: 90, label: "1時間30分" },
  { minutes: 120, label: "2時間" },
];

/** @type {ReopenDurationMinutes} 初期選択（仕様: 1時間） */
export const DEFAULT_REOPEN_DURATION_MINUTES: ReopenDurationMinutes = 60;

/**
 * JST オフセット付き ISO 文字列を組み立てる
 * @param {string} dateYmd - 対象日 YYYY-MM-DD
 * @param {number} hour - 時（0–23）
 * @param {number} minute - 分（0–59）
 * @param {number} [second=0] - 秒（0–59）
 * @returns {string} `YYYY-MM-DDTHH:mm:ss+09:00`
 */
export function formatEndsAtJst(
  dateYmd: string,
  hour: number,
  minute: number,
  second: number = 0,
): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");
  return `${dateYmd}T${hh}:${mm}:${ss}+09:00`;
}

/**
 * Date を JST の endsAt 文字列へ変換する
 * @param {Date} date - 絶対時刻
 * @returns {string} `YYYY-MM-DDTHH:mm:ss+09:00`
 */
export function toEndsAtJst(date: Date): string {
  const parts = getJstClockParts(date);
  return formatEndsAtJst(
    parts.dateYmd,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/**
 * いまから指定分数後の endsAt を返す
 * @param {ReopenDurationMinutes} minutes - いまからの分数
 * @param {Date} [now] - 現在時刻（絶対時刻）
 * @returns {string} `YYYY-MM-DDTHH:mm:ss+09:00`（日付またぎ可）
 */
export function buildEndsAtFromDuration(
  minutes: ReopenDurationMinutes,
  now: Date = new Date(),
): string {
  if (![30, 60, 90, 120].includes(minutes)) {
    throw new Error(
      `buildEndsAtFromDuration: 不正な分数です minutes=${String(minutes)}`,
    );
  }
  return toEndsAtJst(new Date(now.getTime() + minutes * 60 * 1000));
}

/**
 * 再開タイマー候補を返す（セレクト用）
 * @description value は分数文字列（例: "60"）。送信時に endsAt へ変換する。
 * @returns {Array<{ value: string; label: string; minutes: ReopenDurationMinutes }>} 候補
 */
export function buildReopenDurationOptions(): Array<{
  value: string;
  label: string;
  minutes: ReopenDurationMinutes;
}> {
  return REOPEN_DURATION_OPTIONS.map((option) => ({
    value: String(option.minutes),
    label: option.label,
    minutes: option.minutes,
  }));
}

/**
 * セレクト value（分数文字列）を型付き分数へ正規化する
 * @param {string} value - セレクト value
 * @returns {ReopenDurationMinutes | null} 有効なら分数、不正なら null
 */
export function parseReopenDurationMinutes(
  value: string,
): ReopenDurationMinutes | null {
  const minutes = Number(value);
  if (minutes === 30 || minutes === 60 || minutes === 90 || minutes === 120) {
    return minutes;
  }
  return null;
}

/**
 * 登録受付再開枠が有効か
 * @param {HomeRegistrationReopen | ParentRegistrationReopen | null | undefined} registrationReopen - API の再開参照
 * @returns {boolean} 再開枠内なら true
 */
export function isRegistrationReopenActive(
  registrationReopen:
    | HomeRegistrationReopen
    | ParentRegistrationReopen
    | null
    | undefined,
): boolean {
  return registrationReopen?.isOpen === true;
}

/**
 * 再開終了時刻の画面表示ラベル（JST）
 * @param {string} endsAt - `YYYY-MM-DDTHH:mm:ss+09:00`
 * @param {string} [referenceDateYmd] - 対象日 YYYY-MM-DD（日付またぎ時に月日を付ける）
 * @returns {string} 例: `22時02分` / `8月9日 0時30分`。不正時は `—`
 */
export function formatRegistrationReopenEndsAtLabel(
  endsAt: string,
  referenceDateYmd?: string,
): string {
  const parsed = new Date(endsAt);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  const parts = getJstClockParts(parsed);
  const clock = formatJstClockJa(endsAt);
  if (
    referenceDateYmd !== undefined &&
    referenceDateYmd !== "" &&
    parts.dateYmd !== referenceDateYmd
  ) {
    const month = Number(parts.dateYmd.slice(5, 7));
    const day = Number(parts.dateYmd.slice(8, 10));
    return `${month}月${day}日 ${clock}`;
  }
  return clock;
}
