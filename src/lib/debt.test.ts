/**
 * @file 負債・ペナルティチケット計算のユニットテスト
 * @description debtMinutes 境界（59/60/120）と発行プレビューを検証する。
 */
import { describe, expect, it } from "vitest";
import {
  calcDebtMinutes,
  calcIssuableTicketCount,
  canIssuePenaltyTicket,
  previewDebtAfterIssue,
  resolveTimerStartBlockReason,
} from "@/lib/debt";
import { normalizeBalanceDebtFields } from "@/lib/balanceDebt";

describe("calcDebtMinutes", () => {
  it("負残高と超過を合算する", () => {
    expect(calcDebtMinutes(-30, 20)).toBe(50);
    expect(calcDebtMinutes(10, 15)).toBe(15);
    expect(calcDebtMinutes(-90, 60)).toBe(150);
  });

  it("正残高のみなら負債0", () => {
    expect(calcDebtMinutes(60, 0)).toBe(0);
  });
});

describe("calcIssuableTicketCount / canIssuePenaltyTicket", () => {
  it("負債59分は発行不可（0枚）", () => {
    expect(calcIssuableTicketCount(59)).toBe(0);
    expect(canIssuePenaltyTicket(59)).toBe(false);
  });

  it("負債60分は1枚発行可", () => {
    expect(calcIssuableTicketCount(60)).toBe(1);
    expect(canIssuePenaltyTicket(60)).toBe(true);
  });

  it("負債120分は2枚発行可", () => {
    expect(calcIssuableTicketCount(120)).toBe(2);
    expect(canIssuePenaltyTicket(120)).toBe(true);
  });

  it("負債150分は2枚（端数精算なし）", () => {
    expect(calcIssuableTicketCount(150)).toBe(2);
    expect(previewDebtAfterIssue(150, 2)).toBe(30);
  });
});

describe("normalizeBalanceDebtFields", () => {
  it("欠落フィールドを補完する", () => {
    const fields = normalizeBalanceDebtFields({
      balanceMinutes: -30,
      penaltyMinutes: 40,
    });
    expect(fields.displayBalance).toBe(-30);
    expect(fields.debtMinutes).toBe(70);
    expect(fields.issuablePenaltyTicketCount).toBe(1);
  });
});

describe("resolveTimerStartBlockReason", () => {
  it("負債中はスタート不可理由を返す", () => {
    expect(
      resolveTimerStartBlockReason({ balanceMinutes: 10, debtMinutes: 5 }),
    ).toMatch(/負債/);
  });

  it("残高0は従来メッセージ", () => {
    expect(
      resolveTimerStartBlockReason({ balanceMinutes: 0, debtMinutes: 0 }),
    ).toBe("残高がないので スタートできません");
  });
});
