/**
 * @file 負債・ペナルティチケット計算のユニットテスト
 * @description 時間負債とポイント発行境界を検証する。
 */
import { describe, expect, it } from "vitest";
import {
  calcDebtMinutes,
  calcIssuableTicketCount,
  calcPointDebt,
  canIssuePenaltyTicket,
  previewBalancePointsAfterIssue,
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
  it("ポイント負債99ptは発行不可（0枚）", () => {
    expect(calcPointDebt(-99)).toBe(99);
    expect(calcIssuableTicketCount(-99)).toBe(0);
    expect(canIssuePenaltyTicket(-99)).toBe(false);
  });

  it("ポイント負債100ptは1枚発行可", () => {
    expect(calcIssuableTicketCount(-100)).toBe(1);
    expect(canIssuePenaltyTicket(-100)).toBe(true);
  });

  it("ポイント負債250ptは2枚発行可", () => {
    expect(calcIssuableTicketCount(-250)).toBe(2);
    expect(canIssuePenaltyTicket(-250)).toBe(true);
  });

  it("2枚発行後はポイント残高が200pt回復する", () => {
    expect(previewBalancePointsAfterIssue(-250, 2)).toBe(-50);
  });
});

describe("normalizeBalanceDebtFields", () => {
  it("欠落フィールドを補完する", () => {
    const fields = normalizeBalanceDebtFields({
      balancePoints: -250,
      switchMinutes: -30,
      penaltyMinutes: 40,
    });
    expect(fields.displayBalance).toBe(-30);
    expect(fields.debtMinutes).toBe(70);
    expect(fields.issuablePenaltyTicketCount).toBe(2);
  });
});

describe("resolveTimerStartBlockReason", () => {
  it("負債中はスタート不可理由を返す", () => {
    expect(
      resolveTimerStartBlockReason({ switchMinutes: 10, debtMinutes: 5 }),
    ).toMatch(/時間負債/);
  });

  it("残高0は従来メッセージ", () => {
    expect(
      resolveTimerStartBlockReason({ switchMinutes: 0, debtMinutes: 0 }),
    ).toBe("残高がないので スタートできません");
  });
});
