/**
 * @file 登録再開 endsAt 組み立て
 * @description 契約 §2.3/§3.8 の Web 書込形式 `YYYY-MM-DDTHH:mm:ss+09:00` で
 *   当日・30分刻み・23:30 以下の候補を生成する。
 */

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
 * Date からローカル日付 YYYY-MM-DD を返す
 * @param {Date} date - 日時
 * @returns {string} YYYY-MM-DD
 */
function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 再開終了候補（現在以降・30分刻み・〜23:30）を返す
 * @param {object} [opts] - オプション
 * @param {Date} [opts.now] - 現在時刻（ローカル＝JST 想定）
 * @param {string} [opts.dateYmd] - 対象日 YYYY-MM-DD（省略時は now のローカル日付）
 * @returns {Array<{ value: string; label: string }>} 候補（value は +09:00）
 */
export function buildReopenUntilOptions(opts?: {
  now?: Date;
  dateYmd?: string;
}): Array<{ value: string; label: string }> {
  const now = opts?.now ?? new Date();
  const dateYmd = opts?.dateYmd ?? toLocalYmd(now);
  const options: Array<{ value: string; label: string }> = [];

  const cursor = new Date(now);
  cursor.setSeconds(0, 0);
  const minute = cursor.getMinutes();
  const nextSlot =
    minute === 0 || minute === 30 ? minute : minute < 30 ? 30 : 60;
  if (nextSlot === 60) {
    cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
  } else {
    cursor.setMinutes(nextSlot, 0, 0);
  }
  if (cursor.getTime() <= now.getTime()) {
    cursor.setMinutes(cursor.getMinutes() + 30);
  }

  const end = new Date(now);
  end.setHours(23, 30, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    // 日付がずれた場合は当日候補のみ（契約: 当日）
    if (toLocalYmd(cursor) !== dateYmd) {
      break;
    }
    const hour = cursor.getHours();
    const min = cursor.getMinutes();
    const hh = String(hour).padStart(2, "0");
    const mm = String(min).padStart(2, "0");
    options.push({
      value: formatEndsAtJst(dateYmd, hour, min),
      label: `${hh}:${mm}`,
    });
    cursor.setMinutes(cursor.getMinutes() + 30);
  }

  return options;
}
