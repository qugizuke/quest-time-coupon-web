/**
 * @file 残高・負債フィールドの正規化
 * @description home / parentHome でサーバ未返却の負債系フィールドを UI 側で補完する。
 *   日付分岐・採点下限は Functions 正本（UI はサーバ値を表示する）。
 */
import {
  calcDebtMinutes,
  calcIssuableTicketCount,
} from "@/lib/debt";

/** 残高・負債まわりの共通フィールド（Functions 契約・ADR-005 二財布） */
export interface BalanceDebtFields {
  /** クエスト結果で増減するポイント残高（pt）。0未満にはならない */
  balancePoints: number;
  switchMinutes: number;
  displayBalance: number;
  penaltyMinutes: number;
  debtMinutes: number;
  issuablePenaltyTicketCount: number;
  /** 未消費のペナルティチケット枚数（≥ 0） */
  penaltyTicketCount: number;
}

/**
 * API 部分レスポンスから残高・負債フィールドを正規化する
 * @param {Partial<BalanceDebtFields>} raw - サーバ／モックの生データ
 * @returns {BalanceDebtFields} 欠落を補完したフィールド
 */
export function normalizeBalanceDebtFields(
  raw: Partial<BalanceDebtFields>,
): BalanceDebtFields {
  const balancePoints = Math.max(0, raw.balancePoints ?? 0);
  const penaltyMinutes = Math.max(0, raw.penaltyMinutes ?? 0);
  const switchMinutes = raw.switchMinutes ?? raw.displayBalance ?? 0;
  const displayBalance = raw.displayBalance ?? switchMinutes;
  const debtMinutes =
    raw.debtMinutes ?? calcDebtMinutes(switchMinutes, penaltyMinutes);
  const issuablePenaltyTicketCount =
    raw.issuablePenaltyTicketCount ?? calcIssuableTicketCount(debtMinutes);
  const penaltyTicketCount = Math.max(0, raw.penaltyTicketCount ?? 0);

  return {
    balancePoints,
    switchMinutes,
    displayBalance,
    penaltyMinutes,
    debtMinutes,
    issuablePenaltyTicketCount,
    penaltyTicketCount,
  };
}
