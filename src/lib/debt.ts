/**
 * @file ご褒美時間の負債・ペナルティチケット計算
 * @description debtMinutes = max(0, -balanceMinutes) + penaltyMinutes（超過）。
 *   1枚 = 60分精算のみ。適用日 2026-08-24〜の API 正本は Functions 側。
 *   UI は表示・発行可否判定に本ヘルパーを使う（過去残高の再計算はしない）。
 */

/** ペナルティチケット1枚あたりの精算分 */
export const PENALTY_TICKET_MINUTES = 60;

/**
 * 合算負債（分）を算出する
 * @param {number} balanceMinutes - ご褒美残高（負可）
 * @param {number} penaltyMinutes - タイマー超過分（0以上想定）
 * @returns {number} debtMinutes（0以上）
 */
export function calcDebtMinutes(
  balanceMinutes: number,
  penaltyMinutes: number,
): number {
  const negativeBalance = Math.max(0, -balanceMinutes);
  const overrun = Math.max(0, penaltyMinutes);
  return negativeBalance + overrun;
}

/**
 * 発行可能なペナルティチケット枚数を算出する
 * @param {number} debtMinutes - 合算負債（分）
 * @returns {number} floor(debtMinutes / 60)
 */
export function calcIssuableTicketCount(debtMinutes: number): number {
  return Math.floor(Math.max(0, debtMinutes) / PENALTY_TICKET_MINUTES);
}

/**
 * 負債がチケット発行可能な最低分（60分）以上か
 * @param {number} debtMinutes - 合算負債（分）
 * @returns {boolean} 60分未満なら false
 */
export function canIssuePenaltyTicket(debtMinutes: number): boolean {
  return calcIssuableTicketCount(debtMinutes) >= 1;
}

/**
 * 発行後の残り負債（分）をプレビューする
 * @param {number} debtMinutes - 現在の合算負債
 * @param {number} count - 発行枚数
 * @returns {number} 残り負債（負にしない）
 */
export function previewDebtAfterIssue(
  debtMinutes: number,
  count: number,
): number {
  const safeCount = Math.max(0, Math.floor(count));
  return Math.max(0, debtMinutes - safeCount * PENALTY_TICKET_MINUTES);
}

/**
 * タイマー開始可否（負債・残高）の理由を返す
 * @param {{ balanceMinutes: number; debtMinutes: number; blockedByUnacked?: boolean }} opts - 判定材料
 * @returns {string | null} 不可理由。開始可なら null
 */
export function resolveTimerStartBlockReason(opts: {
  balanceMinutes: number;
  debtMinutes: number;
  blockedByUnacked?: boolean;
}): string | null {
  if (opts.blockedByUnacked) {
    return null;
  }
  if (opts.debtMinutes > 0) {
    return "負債があるのでスタートできません（保護者にペナルティチケットで精算してもらってね）";
  }
  if (opts.balanceMinutes <= 0) {
    return "残高がないので スタートできません";
  }
  return null;
}
