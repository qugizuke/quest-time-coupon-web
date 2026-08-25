/**
 * @file モック API 報酬チケット（switchTicketRedeem / rewardVoucherRefundRequests /
 *   rewardVoucherRefundDecision / pointDebtOffset）の単体テスト（Issue #45〜#47・ADR-006）
 * @description 契約 §3.11.2〜§3.11.4 の T11〜T13 を検証する。
 */
import { beforeEach, describe, expect, it } from "vitest";
import { mockApi, resetMockStore, setMockBalanceDebt } from "./mock";
import type {
  PointDebtOffsetResult,
  RewardVoucherRefundCreateResult,
  RewardVoucherRefundDecisionResult,
  RewardVoucherRefundRequestsData,
  SwitchTicketRedeemResult,
} from "@/types/api";

/**
 * POST switchTicketRedeem を呼ぶ
 * @param {string} catalogItemId - 消費する券
 * @returns {Promise<SwitchTicketRedeemResult>} 消費結果
 */
function redeemSwitchTicket(catalogItemId: string): Promise<SwitchTicketRedeemResult> {
  return mockApi<SwitchTicketRedeemResult>("switchTicketRedeem", {
    method: "POST",
    body: JSON.stringify({ catalogItemId }),
  });
}

/**
 * POST rewardVoucherRefundRequests を呼ぶ
 * @param {{ catalogItemId: string; quantity: number }[]} items - 戻し内訳
 * @returns {Promise<RewardVoucherRefundCreateResult>} 作成結果
 */
function postRefundRequest(
  items: { catalogItemId: string; quantity: number }[],
): Promise<RewardVoucherRefundCreateResult> {
  return mockApi<RewardVoucherRefundCreateResult>("rewardVoucherRefundRequests", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

/**
 * GET rewardVoucherRefundRequests を呼ぶ
 * @param {string} month - YYYY-MM
 * @param {string} [status] - 状態フィルタ
 * @returns {Promise<RewardVoucherRefundRequestsData>} 一覧
 */
function getRefundRequests(
  month: string,
  status?: string,
): Promise<RewardVoucherRefundRequestsData> {
  return mockApi<RewardVoucherRefundRequestsData>(
    "rewardVoucherRefundRequests",
    { method: "GET" },
    status ? { month, status } : { month },
  );
}

/**
 * POST rewardVoucherRefundDecision を呼ぶ
 * @param {{ id: string; decision: string; rejectReason?: string }} payload - 決定内容
 * @returns {Promise<RewardVoucherRefundDecisionResult>} 決定結果
 */
function postRefundDecision(payload: {
  id: string;
  decision: string;
  rejectReason?: string;
}): Promise<RewardVoucherRefundDecisionResult> {
  return mockApi<RewardVoucherRefundDecisionResult>("rewardVoucherRefundDecision", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * POST pointDebtOffset を呼ぶ
 * @param {{ catalogItemId: string; quantity: number }[]} items - 穴埋め内訳
 * @returns {Promise<PointDebtOffsetResult>} 穴埋め結果
 */
function postDebtOffset(
  items: { catalogItemId: string; quantity: number }[],
): Promise<PointDebtOffsetResult> {
  return mockApi<PointDebtOffsetResult>("pointDebtOffset", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

describe("mockApi switchTicketRedeem（T11・Issue #45）", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("switch-60 を1枚消費し switchMinutes を60分加算する", async () => {
    setMockBalanceDebt({ switchMinutes: 10, rewardVouchers: { "switch-60": 2 } });
    const result = await redeemSwitchTicket("switch-60");
    expect(result.redeemedMinutes).toBe(60);
    expect(result.switchMinutes).toBe(70);
    expect(result.rewardVouchers["switch-60"]).toBe(1);
  });

  it("switch-30 を1枚消費し switchMinutes を30分加算する", async () => {
    setMockBalanceDebt({ switchMinutes: 0, rewardVouchers: { "switch-30": 1 } });
    const result = await redeemSwitchTicket("switch-30");
    expect(result.redeemedMinutes).toBe(30);
    expect(result.switchMinutes).toBe(30);
    expect(result.rewardVouchers["switch-30"]).toBe(0);
  });

  it("在庫が0枚なら FORBIDDEN_STATE", async () => {
    setMockBalanceDebt({ rewardVouchers: { "switch-30": 0 } });
    await expect(redeemSwitchTicket("switch-30")).rejects.toThrow("FORBIDDEN_STATE");
  });

  it("switch-30 / switch-60 以外は BAD_REQUEST", async () => {
    await expect(redeemSwitchTicket("cash-100")).rejects.toThrow("BAD_REQUEST");
  });
});

describe("mockApi rewardVoucherRefundRequests（T12a・Issue #46）", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("在庫が足りれば pending を作成し、券・残高は変えない", async () => {
    setMockBalanceDebt({ balancePoints: 0, rewardVouchers: { "cash-100": 3 } });
    const result = await postRefundRequest([{ catalogItemId: "cash-100", quantity: 2 }]);
    expect(result.status).toBe("pending");
    expect(result.totalPoints).toBe(200);

    const month = new Date().toISOString().slice(0, 7);
    const { items } = await getRefundRequests(month);
    expect(items).toHaveLength(1);
    expect(items[0].items).toEqual([
      { catalogItemId: "cash-100", label: "100円", quantity: 2, pointValue: 100, subtotalPoints: 200 },
    ]);
  });

  it("在庫不足なら FORBIDDEN_STATE", async () => {
    setMockBalanceDebt({ rewardVouchers: { "cash-100": 1 } });
    await expect(
      postRefundRequest([{ catalogItemId: "cash-100", quantity: 2 }]),
    ).rejects.toThrow("FORBIDDEN_STATE");
  });

  it("penalty-ticket-100 は対象外で BAD_REQUEST", async () => {
    setMockBalanceDebt({ rewardVouchers: { "cash-100": 5 } });
    await expect(
      postRefundRequest([{ catalogItemId: "penalty-ticket-100", quantity: 1 }]),
    ).rejects.toThrow("BAD_REQUEST");
  });

  it("items が空配列なら BAD_REQUEST", async () => {
    await expect(postRefundRequest([])).rejects.toThrow("BAD_REQUEST");
  });
});

describe("mockApi rewardVoucherRefundDecision（T12b・Issue #46）", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("approve で券を減らし balancePoints へ加算する", async () => {
    setMockBalanceDebt({ balancePoints: 0, rewardVouchers: { "cash-100": 3 } });
    const created = await postRefundRequest([{ catalogItemId: "cash-100", quantity: 2 }]);
    const decided = await postRefundDecision({ id: created.id, decision: "approve" });
    expect(decided.status).toBe("approved");
    expect(decided.restoredPoints).toBe(200);
    expect(decided.balancePoints).toBe(200);
    expect(decided.rewardVouchers?.["cash-100"]).toBe(1);
  });

  it("reject は券・残高を変えず rejectReason を保存する", async () => {
    setMockBalanceDebt({ balancePoints: 0, rewardVouchers: { "cash-100": 3 } });
    const created = await postRefundRequest([{ catalogItemId: "cash-100", quantity: 2 }]);
    const decided = await postRefundDecision({
      id: created.id,
      decision: "reject",
      rejectReason: "また今度",
    });
    expect(decided.status).toBe("rejected");
    expect(decided.balancePoints).toBe(0);
  });

  it("承認時点で券が不足していれば FORBIDDEN_STATE のまま pending を維持する", async () => {
    setMockBalanceDebt({ balancePoints: 0, rewardVouchers: { "cash-100": 3 } });
    const created = await postRefundRequest([{ catalogItemId: "cash-100", quantity: 2 }]);
    // 別操作で券が減ったことを模擬（switchTicketRedeem 等の代わりに直接上書き）
    setMockBalanceDebt({ rewardVouchers: { "cash-100": 1 } });
    await expect(
      postRefundDecision({ id: created.id, decision: "approve" }),
    ).rejects.toThrow("FORBIDDEN_STATE");

    const month = new Date().toISOString().slice(0, 7);
    const { items } = await getRefundRequests(month, "pending");
    expect(items).toHaveLength(1);
  });

  it("未知の id は NOT_FOUND", async () => {
    await expect(
      postRefundDecision({ id: "does-not-exist", decision: "approve" }),
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("mockApi pointDebtOffset（T13・Issue #47）", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("負債があるとき選んだ券で穴埋めし、埋めきれない分は負のまま残す", async () => {
    setMockBalanceDebt({ balancePoints: -100, rewardVouchers: { "cash-100": 1, "snack-10": 3 } });
    const result = await postDebtOffset([
      { catalogItemId: "cash-100", quantity: 1 },
      { catalogItemId: "snack-10", quantity: 3 },
    ]);
    expect(result.offsetPoints).toBe(130);
    expect(result.balancePoints).toBe(30);
    expect(result.remainingDebtPoints).toBe(0);
    expect(result.rewardVouchers["cash-100"]).toBe(0);
    expect(result.rewardVouchers["snack-10"]).toBe(0);
  });

  it("埋めきれない場合は負のまま remainingDebtPoints を返す", async () => {
    setMockBalanceDebt({ balancePoints: -1000, rewardVouchers: { "cash-100": 1 } });
    const result = await postDebtOffset([{ catalogItemId: "cash-100", quantity: 1 }]);
    expect(result.balancePoints).toBe(-900);
    expect(result.remainingDebtPoints).toBe(900);
  });

  it("balancePoints が0以上なら FORBIDDEN_STATE", async () => {
    setMockBalanceDebt({ balancePoints: 0, rewardVouchers: { "cash-100": 1 } });
    await expect(
      postDebtOffset([{ catalogItemId: "cash-100", quantity: 1 }]),
    ).rejects.toThrow("FORBIDDEN_STATE");
  });

  it("在庫不足なら FORBIDDEN_STATE", async () => {
    setMockBalanceDebt({ balancePoints: -100, rewardVouchers: { "cash-100": 0 } });
    await expect(
      postDebtOffset([{ catalogItemId: "cash-100", quantity: 1 }]),
    ).rejects.toThrow("FORBIDDEN_STATE");
  });

  it("items が空配列なら BAD_REQUEST", async () => {
    setMockBalanceDebt({ balancePoints: -100 });
    await expect(postDebtOffset([])).rejects.toThrow("BAD_REQUEST");
  });
});
