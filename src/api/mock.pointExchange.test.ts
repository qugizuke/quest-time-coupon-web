/**
 * @file モック API ポイント交換・報酬チケットの単体テスト（Issue #38 / #43）
 * @description 契約 §3.11 の T10a（申請＝pending 作成のみ）／T10b（承認／却下）を検証する。
 *   ADR-006 以降、balancePoints は負を許容するため申請時点・承認時点の残高不足では拒否しない。
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";
import { mockApi, resetMockStore, setMockBalanceDebt } from "./mock";
import type {
  PointExchangeCreateResult,
  PointExchangeDecisionResult,
  PointExchangeRequestsData,
} from "@/types/api";

/**
 * POST pointExchangeRequests を呼ぶ
 * @param {{ catalogItemId: string; quantity: number }[]} items - 申請内訳
 * @returns {Promise<PointExchangeCreateResult>} 作成結果
 */
function postRequest(
  items: { catalogItemId: string; quantity: number }[],
): Promise<PointExchangeCreateResult> {
  return mockApi<PointExchangeCreateResult>(
    "pointExchangeRequests",
    { method: "POST", body: JSON.stringify({ items }) },
    undefined,
  );
}

/**
 * GET pointExchangeRequests を呼ぶ
 * @param {string} month - YYYY-MM
 * @param {string} [status] - 状態フィルタ
 * @returns {Promise<PointExchangeRequestsData>} 一覧
 */
function getRequests(
  month: string,
  status?: string,
): Promise<PointExchangeRequestsData> {
  return mockApi<PointExchangeRequestsData>(
    "pointExchangeRequests",
    { method: "GET" },
    status ? { month, status } : { month },
  );
}

/**
 * POST pointExchangeDecision を呼ぶ
 * @param {{ id: string; decision: string; rejectReason?: string }} payload - 決定内容
 * @returns {Promise<PointExchangeDecisionResult>} 決定結果
 */
function postDecision(payload: {
  id: string;
  decision: string;
  rejectReason?: string;
}): Promise<PointExchangeDecisionResult> {
  return mockApi<PointExchangeDecisionResult>(
    "pointExchangeDecision",
    { method: "POST", body: JSON.stringify(payload) },
    undefined,
  );
}

describe("mockApi pointExchangeRequests POST（T10a）", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("残高十分なら pending を作成し、残高は変えない", async () => {
    setMockBalanceDebt({ balancePoints: 1000 });
    const result = await postRequest([{ catalogItemId: "cash-100", quantity: 5 }]);
    expect(result.status).toBe("pending");
    expect(result.totalPoints).toBe(500);
    expect(result.balancePoints).toBe(1000);

    const { items } = await getRequests(new Date().toISOString().slice(0, 7));
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("pending");
    expect(items[0].items).toEqual([
      { catalogItemId: "cash-100", label: "100円", quantity: 5, pointCost: 100, subtotalPoints: 500 },
    ]);
    expect(items[0].effects).toEqual({
      spentPoints: 500,
      issuedRewardVouchers: { "cash-100": 5 },
      consumedPenaltyTickets: 0,
    });
  });

  it("複数種類・複数枚を1申請に含められる", async () => {
    setMockBalanceDebt({ balancePoints: 1000 });
    const result = await postRequest([
      { catalogItemId: "cash-100", quantity: 5 },
      { catalogItemId: "switch-30", quantity: 1 },
    ]);
    expect(result.totalPoints).toBe(550);
  });

  it("items が空配列なら BAD_REQUEST", async () => {
    setMockBalanceDebt({ balancePoints: 1000 });
    await expect(postRequest([])).rejects.toThrow("BAD_REQUEST");
  });

  it("未知の catalogItemId は BAD_REQUEST", async () => {
    setMockBalanceDebt({ balancePoints: 1000 });
    await expect(
      postRequest([{ catalogItemId: "unknown-item", quantity: 1 }]),
    ).rejects.toThrow("BAD_REQUEST");
  });

  it("quantity が0以下は BAD_REQUEST", async () => {
    setMockBalanceDebt({ balancePoints: 1000 });
    await expect(
      postRequest([{ catalogItemId: "cash-100", quantity: 0 }]),
    ).rejects.toThrow("BAD_REQUEST");
  });

  it("ADR-006: 残高不足でも申請時点では拒否しない", async () => {
    setMockBalanceDebt({ balancePoints: 10 });
    const result = await postRequest([{ catalogItemId: "cash-100", quantity: 1 }]);
    expect(result.status).toBe("pending");
    expect(result.balancePoints).toBe(10);
  });
});

describe("mockApi pointExchangeRequests GET（月次履歴）", () => {
  beforeEach(() => {
    resetMockStore();
    setMockBalanceDebt({ balancePoints: 1000 });
  });

  it("month が無ければ BAD_REQUEST", async () => {
    await expect(
      mockApi("pointExchangeRequests", { method: "GET" }, undefined),
    ).rejects.toThrow("BAD_REQUEST");
  });

  it("status フィルタで pending のみ返す", async () => {
    await postRequest([{ catalogItemId: "snack-10", quantity: 1 }]);
    const month = new Date().toISOString().slice(0, 7);
    const all = await getRequests(month);
    const pendingOnly = await getRequests(month, "pending");
    expect(all.items).toHaveLength(1);
    expect(pendingOnly.items).toHaveLength(1);
    const approvedOnly = await getRequests(month, "approved");
    expect(approvedOnly.items).toHaveLength(0);
  });

  it("不正な status は BAD_REQUEST", async () => {
    const month = new Date().toISOString().slice(0, 7);
    await expect(getRequests(month, "unknown")).rejects.toThrow("BAD_REQUEST");
  });
});

describe("mockApi pointExchangeDecision（T10b・ADR-006）", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("approve で balancePoints を消費し、switchMinutes ではなく rewardVouchers へ発行する", async () => {
    setMockBalanceDebt({ balancePoints: 200, switchMinutes: 10 });
    const created = await postRequest([{ catalogItemId: "switch-30", quantity: 1 }]);
    const decided = await postDecision({ id: created.id, decision: "approve" });
    expect(decided.status).toBe("approved");
    expect(decided.spentPoints).toBe(50);
    expect(decided.balancePoints).toBe(150);
    expect(decided.rewardVouchers?.["switch-30"]).toBe(1);
  });

  it("approve で penalty-ticket-100 は penaltyTicketCount を消費する", async () => {
    setMockBalanceDebt({ balancePoints: 200, penaltyTicketCount: 2 });
    const created = await postRequest([
      { catalogItemId: "penalty-ticket-100", quantity: 1 },
    ]);
    const decided = await postDecision({ id: created.id, decision: "approve" });
    expect(decided.status).toBe("approved");
    expect(decided.penaltyTicketCount).toBe(1);
    expect(decided.balancePoints).toBe(100);
  });

  it("reject は残高を変えず rejectReason を保存する", async () => {
    setMockBalanceDebt({ balancePoints: 200 });
    const created = await postRequest([{ catalogItemId: "snack-10", quantity: 1 }]);
    const decided = await postDecision({
      id: created.id,
      decision: "reject",
      rejectReason: "今日はやめておこう",
    });
    expect(decided.status).toBe("rejected");
    expect(decided.balancePoints).toBe(200);

    const month = new Date().toISOString().slice(0, 7);
    const { items } = await getRequests(month);
    expect(items[0].status).toBe("rejected");
    expect(items[0].rejectReason).toBe("今日はやめておこう");
  });

  it("ADR-006: 承認時点で残高不足でもポイント不足だけでは拒否せず、承認後は負残高になる", async () => {
    setMockBalanceDebt({ balancePoints: 200 });
    const created = await postRequest([{ catalogItemId: "cash-100", quantity: 2 }]);
    // 別操作で残高が減ったことを模擬
    setMockBalanceDebt({ balancePoints: 50 });
    const decided = await postDecision({ id: created.id, decision: "approve" });
    expect(decided.status).toBe("approved");
    expect(decided.balancePoints).toBe(-150);
  });

  it("penaltyTicketCount 不足なら FORBIDDEN_STATE のまま pending を維持する", async () => {
    setMockBalanceDebt({ balancePoints: 200, penaltyTicketCount: 0 });
    const created = await postRequest([
      { catalogItemId: "penalty-ticket-100", quantity: 1 },
    ]);
    await expect(
      postDecision({ id: created.id, decision: "approve" }),
    ).rejects.toThrow("FORBIDDEN_STATE");
  });

  it("pending 以外への決定は FORBIDDEN_STATE", async () => {
    setMockBalanceDebt({ balancePoints: 200 });
    const created = await postRequest([{ catalogItemId: "snack-10", quantity: 1 }]);
    await postDecision({ id: created.id, decision: "reject" });
    await expect(
      postDecision({ id: created.id, decision: "reject" }),
    ).rejects.toThrow("FORBIDDEN_STATE");
  });

  it("未知の id は NOT_FOUND", async () => {
    await expect(
      postDecision({ id: "does-not-exist", decision: "approve" }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
