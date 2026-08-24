/**
 * @file 残高・負債フィールドの正規化
 * @description home / parentHome でサーバ未返却の負債系フィールドを UI 側で補完する。
 *   日付分岐・採点下限は Functions 正本（UI はサーバ値を表示する）。
 */
import {
  calcDebtMinutes,
  calcIssuableTicketCount,
} from "@/lib/debt";

/** 残高・負債まわりの共通フィールド（Functions 契約） */
export interface BalanceDebtFields {
  balanceMinutes: number;
  displayBalance: number;
  penaltyMinutes: number;
  debtMinutes: number;
  issuablePenaltyTicketCount: number;
}

/**
 * API 部分レスポンスから残高・負債フィールドを正規化する
 * @param {Partial<BalanceDebtFields>} raw - サーバ／モックの生データ
 * @returns {BalanceDebtFields} 欠落を補完したフィールド
 */
export function normalizeBalanceDebtFields(
  raw: Partial<BalanceDebtFields>,
): BalanceDebtFields {
  const penaltyMinutes = Math.max(0, raw.penaltyMinutes ?? 0);
  const balanceMinutes = raw.balanceMinutes ?? raw.displayBalance ?? 0;
  const displayBalance = raw.displayBalance ?? balanceMinutes;
  const debtMinutes =
    raw.debtMinutes ?? calcDebtMinutes(balanceMinutes, penaltyMinutes);
  const issuablePenaltyTicketCount =
    raw.issuablePenaltyTicketCount ?? calcIssuableTicketCount(debtMinutes);

  return {
    balanceMinutes,
    displayBalance,
    penaltyMinutes,
    debtMinutes,
    issuablePenaltyTicketCount,
  };
}
