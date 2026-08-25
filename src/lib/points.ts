/**
 * @file ポイント通貨化の切替日（ADR-005）
 * @description `ResultEntry.totalPoints` の表示単位を切り替える基準日。
 *   切替日前は「分（旧）」、切替日以降は「ポイント」として解釈する（JST 暦日）。
 */

/** ポイント通貨化の切替日（YYYY-MM-DD・JST 暦日） */
export const POINTS_CUTOVER_DATE = "2026-08-25";

/**
 * 対象日が切替日以降（ポイント表示）かを判定する
 * @param {string} date - 判定対象日（YYYY-MM-DD）
 * @returns {boolean} 切替日以降なら true
 */
export function isOnOrAfterPointsCutover(date: string): boolean {
  return date >= POINTS_CUTOVER_DATE;
}
