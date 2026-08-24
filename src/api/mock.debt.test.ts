/**
 * @file モック penaltyTicketIssue / 負債境界テスト
 * @description debtMinutes 59/60/120 と発行精算を検証する。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockApi, resetMockStore, setMockBalanceDebt } from "@/api/mock";
import type { HomeData, ParentHomeData, PenaltyTicketIssueResult } from "@/types/api";

/**
 * 保護者としてペナルティチケットを発行する
 * @param {number} count - 枚数
 * @returns {Promise<PenaltyTicketIssueResult>} 精算結果
 */
function issueAsParent(count: number): Promise<PenaltyTicketIssueResult> {
  return mockApi<PenaltyTicketIssueResult>("penaltyTicketIssue", {
    method: "POST",
    body: JSON.stringify({ actor: "parent", count }),
  });
}

describe("mockApi debt / penaltyTicketIssue", () => {
  beforeEach(() => {
    resetMockStore();
  });

  afterEach(() => {
    resetMockStore();
  });

  it("home は負残高を丸めず debtMinutes を返す", async () => {
    setMockBalanceDebt({ balanceMinutes: -30, penaltyMinutes: 20 });
    const home = await mockApi<HomeData>("home", { method: "GET" });
    expect(home.displayBalance).toBe(-30);
    expect(home.balanceMinutes).toBe(-30);
    expect(home.penaltyMinutes).toBe(20);
    expect(home.debtMinutes).toBe(50);
    expect(home.issuablePenaltyTicketCount).toBe(0);
    expect(home.canStartTimer).toBe(false);
  });

  it("actor が parent 以外は BAD_REQUEST", async () => {
    setMockBalanceDebt({ balanceMinutes: -60, penaltyMinutes: 0 });
    await expect(
      mockApi("penaltyTicketIssue", {
        method: "POST",
        body: JSON.stringify({ actor: "child", count: 1 }),
      }),
    ).rejects.toThrow(/actor/);
  });

  it("負債59分は発行拒否", async () => {
    setMockBalanceDebt({ balanceMinutes: -59, penaltyMinutes: 0 });
    await expect(issueAsParent(1)).rejects.toThrow(/60分未満/);
  });

  it("負債60分は1枚発行でき負債0になる", async () => {
    setMockBalanceDebt({ balanceMinutes: -60, penaltyMinutes: 0 });
    const result = await issueAsParent(1);
    expect(result.count).toBe(1);
    expect(result.settledMinutes).toBe(60);
    expect(result.debtBefore).toBe(60);
    expect(result.debtAfter).toBe(0);
    expect(result.balanceMinutes).toBe(0);
    expect(result.issuablePenaltyTicketCount).toBe(0);
    expect(result.ticketId).toBeTruthy();
  });

  it("負債120分は最大2枚、1枚で負債60分残る", async () => {
    setMockBalanceDebt({ balanceMinutes: 0, penaltyMinutes: 120 });
    const result = await issueAsParent(1);
    expect(result.debtAfter).toBe(60);
    expect(result.penaltyMinutes).toBe(60);
    expect(result.issuablePenaltyTicketCount).toBe(1);
  });

  it("負債150分を2枚発行すると残り30分", async () => {
    setMockBalanceDebt({ balanceMinutes: -90, penaltyMinutes: 60 });
    const result = await issueAsParent(2);
    expect(result.debtAfter).toBe(30);
    expect(result.balanceMinutes).toBe(-30);
    expect(result.penaltyMinutes).toBe(0);
  });

  it("発行可能枚数超過は拒否", async () => {
    setMockBalanceDebt({ balanceMinutes: -60, penaltyMinutes: 0 });
    await expect(issueAsParent(2)).rejects.toThrow(/発行可能数を超えて/);
  });

  it("parentHome にも負債フィールドが載る", async () => {
    setMockBalanceDebt({ balanceMinutes: -10, penaltyMinutes: 50 });
    const parent = await mockApi<ParentHomeData>("parentHome", {
      method: "GET",
    });
    expect(parent.debtMinutes).toBe(60);
    expect(parent.issuablePenaltyTicketCount).toBe(1);
  });
});
