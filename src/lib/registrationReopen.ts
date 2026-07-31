/**
 * @file 登録再開 endsAt 組み立て
 * @description 契約 §2.3/§3.8 の Web 書込形式 `YYYY-MM-DDTHH:mm:ss+09:00` で
 *   当日・30分刻み・23:30 以下の候補を生成する。
 *   時刻判定はブラウザローカルではなく JST（Asia/Tokyo）を正とする。
 */
import { getJstClockParts } from "@/lib/date";

/**
 * JST オフセット付き ISO 文字列を組み立てる
 * @param {string} dateYmd - 対象日 YYYY-MM-DD
 * @param {number} hour - 時（0–23）
 * @param {number} minute - 分（0 または 30）
 * @returns {string} `YYYY-MM-DDTHH:mm:ss+09:00`
 */
export function formatEndsAtJst(
  dateYmd: string,
  hour: number,
  minute: number,
): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${dateYmd}T${hh}:${mm}:00+09:00`;
}

/**
 * JST 時刻の次の 30 分スロット（現在より後）を返す
 * @param {import("@/lib/date").JstClockParts} now - JST の現在時刻
 * @returns {{ hour: number; minute: number }} 次スロット
 */
function nextJstSlotAfter(now: {
  hour: number;
  minute: number;
}): { hour: number; minute: number } {
  let hour = now.hour;
  let minute = now.minute;
  const nextSlot =
    minute === 0 || minute === 30 ? minute : minute < 30 ? 30 : 60;

  if (nextSlot === 60) {
    hour += 1;
    minute = 0;
  } else {
    minute = nextSlot;
  }

  if (hour < now.hour || (hour === now.hour && minute <= now.minute)) {
    minute += 30;
    if (minute >= 60) {
      hour += 1;
      minute -= 60;
    }
  }

  return { hour, minute };
}

/**
 * 再開終了候補（現在以降・30分刻み・〜23:30）を返す
 * @param {object} [opts] - オプション
 * @param {Date} [opts.now] - 現在時刻（絶対時刻。JST へ変換して判定）
 * @param {string} [opts.dateYmd] - 対象日 YYYY-MM-DD（省略時は JST 当日）
 * @returns {Array<{ value: string; label: string }>} 候補（value は +09:00）
 */
export function buildReopenUntilOptions(opts?: {
  now?: Date;
  dateYmd?: string;
}): Array<{ value: string; label: string }> {
  const now = opts?.now ?? new Date();
  const jstNow = getJstClockParts(now);
  const dateYmd = opts?.dateYmd ?? jstNow.dateYmd;
  const options: Array<{ value: string; label: string }> = [];

  // 契約: 当日のみ。JST 上で対象日と現在日が一致しない場合は候補なし。
  if (dateYmd !== jstNow.dateYmd) {
    return options;
  }

  let { hour, minute } = nextJstSlotAfter(jstNow);

  while (hour < 23 || (hour === 23 && minute <= 30)) {
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    options.push({
      value: formatEndsAtJst(dateYmd, hour, minute),
      label: `${hh}:${mm}`,
    });
    minute += 30;
    if (minute >= 60) {
      hour += 1;
      minute -= 60;
    }
  }

  return options;
}
