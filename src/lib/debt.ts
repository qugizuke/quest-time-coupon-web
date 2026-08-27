/**
 * @file ご褒美時間の負債・ペナルティチケット計算
 * @description 時間負債とポイント負債を別々に扱う。
 *   ペナルティチケットは負ポイントを1枚100ptで精算する。
 */

/** ペナルティチケット1枚あたりの精算ポイント */
export const PENALTY_TICKET_POINTS = 100;

/**
 * 合算負債（分）を算出する
 * @param {number} switchMinutes - ご褒美残高（負可）
 * @param {number} penaltyMinutes - タイマー超過分（0以上想定）
 * @returns {number} debtMinutes（0以上）
 */
export function calcDebtMinutes(
  switchMinutes: number,
  penaltyMinutes: number,
): number {
  const negativeBalance = Math.max(0, -switchMinutes);
  const overrun = Math.max(0, penaltyMinutes);
  return negativeBalance + overrun;
}

/**
 * 発行可能なペナルティチケット枚数を算出する
 * @param {number} balancePoints - ポイント残高（負を許容）
 * @returns {number} floor(max(0, -balancePoints) / 100)
 */
export function calcIssuableTicketCount(balancePoints: number): number {
  return Math.floor(calcPointDebt(balancePoints) / PENALTY_TICKET_POINTS);
}

/** 負ポイントの絶対値を返す。残高が0以上なら0 */
export function calcPointDebt(balancePoints: number): number {
  return Math.max(0, -balancePoints);
}

/**
 * ポイント負債がチケット発行可能な100pt以上か
 * @param {number} balancePoints - ポイント残高
 * @returns {boolean} ポイント負債100pt未満なら false
 */
export function canIssuePenaltyTicket(balancePoints: number): boolean {
  return calcIssuableTicketCount(balancePoints) >= 1;
}

/**
 * 在庫チケットを消費できるか（1枚以上か）
 * @param {number} penaltyTicketCount - 未消費のペナルティチケット枚数
 * @returns {boolean} 1枚以上なら true
 */
export function canConsumePenaltyTicket(penaltyTicketCount: number): boolean {
  return penaltyTicketCount >= 1;
}

/**
 * 発行後のポイント残高をプレビューする
 * @param {number} balancePoints - 現在のポイント残高
 * @param {number} count - 発行枚数
 * @returns {number} 発行後ポイント残高
 */
export function previewBalancePointsAfterIssue(
  balancePoints: number,
  count: number,
): number {
  const safeCount = Math.max(0, Math.floor(count));
  return balancePoints + safeCount * PENALTY_TICKET_POINTS;
}

/**
 * タイマー開始可否（負債・残高）の理由を返す
 * @param {{ switchMinutes: number; debtMinutes: number; blockedByUnacked?: boolean }} opts - 判定材料
 * @returns {string | null} 不可理由。開始可なら null
 */
export function resolveTimerStartBlockReason(opts: {
  switchMinutes: number;
  debtMinutes: number;
  blockedByUnacked?: boolean;
}): string | null {
  if (opts.blockedByUnacked) {
    return null;
  }
  if (opts.debtMinutes > 0) {
    return "時間負債が残っているのでスタートできません";
  }
  if (opts.switchMinutes <= 0) {
    return "残高がないので スタートできません";
  }
  return null;
}
