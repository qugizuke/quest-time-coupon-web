/**
 * @file モック penaltyTicketIssue / penaltyTicketConsume / 負債境界テスト
 * @description debtMinutes 59/60/120 と発行精算・在庫消費を検証する（Issue #35）。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockApi, resetMockStore, setMockBalanceDebt } from "@/api/mock";
import type {
  HomeData,
  ParentHomeData,
  PenaltyTicketConsumeResult,
  PenaltyTicketIssueResult,
} from "@/types/api";

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

/**
 * 保護者としてペナルティチケットを1枚消費する
 * @param {string} [actor] - actor（既定は parent）
 * @returns {Promise<PenaltyTicketConsumeResult>} 消費結果
 */
function consumeAsParent(actor = "parent"): Promise<PenaltyTicketConsumeResult> {
  return mockApi<PenaltyTicketConsumeResult>("penaltyTicketConsume", {
    method: "POST",
    body: JSON.stringify({ actor }),
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
    setMockBalanceDebt({ switchMinutes: -30, penaltyMinutes: 20 });
    const home = await mockApi<HomeData>("home", { method: "GET" });
    expect(home.displayBalance).toBe(-30);
    expect(home.switchMinutes).toBe(-30);
    expect(home.penaltyMinutes).toBe(20);
    expect(home.debtMinutes).toBe(50);
    expect(home.issuablePenaltyTicketCount).toBe(0);
    expect(home.canStartTimer).toBe(false);
    expect(home.penaltyTicketCount).toBe(0);
  });

  it("actor が parent 以外は BAD_REQUEST", async () => {
    setMockBalanceDebt({ switchMinutes: -60, penaltyMinutes: 0 });
    await expect(
      mockApi("penaltyTicketIssue", {
        method: "POST",
        body: JSON.stringify({ actor: "child", count: 1 }),
      }),
    ).rejects.toThrow(/actor/);
  });

  it("負債59分は発行拒否", async () => {
    setMockBalanceDebt({ switchMinutes: -59, penaltyMinutes: 0 });
    await expect(issueAsParent(1)).rejects.toThrow(/60分未満/);
  });

  it("負債60分は1枚発行でき負債0になる", async () => {
    setMockBalanceDebt({ switchMinutes: -60, penaltyMinutes: 0 });
    const result = await issueAsParent(1);
    expect(result.count).toBe(1);
    expect(result.settledMinutes).toBe(60);
    expect(result.debtBefore).toBe(60);
    expect(result.debtAfter).toBe(0);
    expect(result.switchMinutes).toBe(0);
    expect(result.issuablePenaltyTicketCount).toBe(0);
    expect(result.ticketId).toBeTruthy();
    expect(result.penaltyTicketCount).toBe(1);
  });

  it("負債120分は最大2枚、1枚で負債60分残る", async () => {
    setMockBalanceDebt({ switchMinutes: 0, penaltyMinutes: 120 });
    const result = await issueAsParent(1);
    expect(result.debtAfter).toBe(60);
    expect(result.penaltyMinutes).toBe(60);
    expect(result.issuablePenaltyTicketCount).toBe(1);
    expect(result.penaltyTicketCount).toBe(1);
  });

  it("負債150分を2枚発行すると残り30分・在庫2枚になる", async () => {
    setMockBalanceDebt({ switchMinutes: -90, penaltyMinutes: 60 });
    const result = await issueAsParent(2);
    expect(result.debtAfter).toBe(30);
    expect(result.switchMinutes).toBe(-30);
    expect(result.penaltyMinutes).toBe(0);
    expect(result.penaltyTicketCount).toBe(2);
  });

  it("発行を重ねると在庫が積み上がる", async () => {
    setMockBalanceDebt({ switchMinutes: -120, penaltyMinutes: 0 });
    const first = await issueAsParent(1);
    expect(first.penaltyTicketCount).toBe(1);
    const second = await issueAsParent(1);
    expect(second.penaltyTicketCount).toBe(2);
  });

  it("発行可能枚数超過は拒否", async () => {
    setMockBalanceDebt({ switchMinutes: -60, penaltyMinutes: 0 });
    await expect(issueAsParent(2)).rejects.toThrow(/発行可能数を超えて/);
  });

  it("parentHome にも負債フィールドが載る", async () => {
    setMockBalanceDebt({ switchMinutes: -10, penaltyMinutes: 50 });
    const parent = await mockApi<ParentHomeData>("parentHome", {
      method: "GET",
    });
    expect(parent.debtMinutes).toBe(60);
    expect(parent.issuablePenaltyTicketCount).toBe(1);
    expect(parent.penaltyTicketCount).toBe(0);
  });

  it("parentHome / home に penaltyTicketCount が載る", async () => {
    setMockBalanceDebt({ penaltyTicketCount: 3 });
    const parent = await mockApi<ParentHomeData>("parentHome", {
      method: "GET",
    });
    const home = await mockApi<HomeData>("home", { method: "GET" });
    expect(parent.penaltyTicketCount).toBe(3);
    expect(home.penaltyTicketCount).toBe(3);
  });

  it("actor が parent 以外は BAD_REQUEST（consume）", async () => {
    setMockBalanceDebt({ penaltyTicketCount: 2 });
    await expect(consumeAsParent("child")).rejects.toThrow(/actor/);
  });

  it("在庫0枚の消費は FORBIDDEN_STATE", async () => {
    setMockBalanceDebt({ penaltyTicketCount: 0 });
    await expect(consumeAsParent()).rejects.toThrow(/在庫チケットがない/);
  });

  it("在庫1枚以上は1枚消費でき残高・負債は変わらない", async () => {
    setMockBalanceDebt({
      switchMinutes: -10,
      penaltyMinutes: 50,
      penaltyTicketCount: 2,
    });
    const result = await consumeAsParent();
    expect(result.penaltyTicketCount).toBe(1);
    expect(result.ticketId).toBeTruthy();

    const parent = await mockApi<ParentHomeData>("parentHome", {
      method: "GET",
    });
    expect(parent.penaltyTicketCount).toBe(1);
    expect(parent.switchMinutes).toBe(-10);
    expect(parent.penaltyMinutes).toBe(50);
    expect(parent.debtMinutes).toBe(60);
  });

  it("消費を重ねると在庫が減っていく", async () => {
    setMockBalanceDebt({ penaltyTicketCount: 2 });
    const first = await consumeAsParent();
    expect(first.penaltyTicketCount).toBe(1);
    const second = await consumeAsParent();
    expect(second.penaltyTicketCount).toBe(0);
    await expect(consumeAsParent()).rejects.toThrow(/在庫チケットがない/);
  });
});
