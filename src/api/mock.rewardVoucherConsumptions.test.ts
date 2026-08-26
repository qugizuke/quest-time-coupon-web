import { beforeEach, describe, expect, it } from "vitest";
import { mockApi, resetMockStore, setMockBalanceDebt } from "./mock";
import type {
  RewardVoucherConsumptionResult,
  RewardVoucherConsumptionsData,
} from "@/types/api";

const operationId = "550e8400-e29b-41d4-a716-446655440000";

function post(operation = operationId, items = [
  { catalogItemId: "cash-100", quantity: 2 },
  { catalogItemId: "snack-10", quantity: 1 },
]) {
  return mockApi<RewardVoucherConsumptionResult>("rewardVoucherConsumptions", {
    method: "POST",
    body: JSON.stringify({ operationId: operation, items }),
  });
}

describe("mockApi rewardVoucherConsumptions", () => {
  beforeEach(() => {
    resetMockStore();
    setMockBalanceDebt({ rewardVouchers: { "snack-10": 3, "cash-100": 5 } });
  });

  it("複数物理券を固定順で即時減算し、同じpayloadの再送は冪等成功する", async () => {
    const first = await post();
    expect(first.idempotentReplay).toBe(false);
    expect(first.items).toEqual([
      { catalogItemId: "snack-10", label: "おやつ", quantity: 1, stockBefore: 3, stockAfter: 2 },
      { catalogItemId: "cash-100", label: "100円", quantity: 2, stockBefore: 5, stockAfter: 3 },
    ]);
    const replay = await post(operationId, [
      { catalogItemId: "snack-10", quantity: 1 },
      { catalogItemId: "cash-100", quantity: 2 },
    ]);
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.consumedAt).toBe(first.consumedAt);
    expect(replay.items).toEqual(first.items);
  });

  it("同じ operationId の異なる数量は IDEMPOTENCY_CONFLICT", async () => {
    await post();
    await expect(
      post(operationId, [{ catalogItemId: "cash-100", quantity: 1 }]),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it("在庫不足は全件を消費せず FORBIDDEN_STATE", async () => {
    await expect(
      post(operationId, [{ catalogItemId: "cash-100", quantity: 6 }]),
    ).rejects.toThrow("FORBIDDEN_STATE");
    const success = await post(operationId, [{ catalogItemId: "cash-100", quantity: 5 }]);
    expect(success.items[0].stockBefore).toBe(5);
  });

  it("月次履歴を返し、対象外filterと不正UUIDを拒否する", async () => {
    const created = await post();
    const month = new Date(new Date(created.consumedAt).getTime() + 9 * 3600000)
      .toISOString()
      .slice(0, 7);
    const history = await mockApi<RewardVoucherConsumptionsData>(
      "rewardVoucherConsumptions",
      { method: "GET" },
      { month, catalogItemId: "cash-100" },
    );
    expect(history.items).toHaveLength(1);
    await expect(
      mockApi("rewardVoucherConsumptions", { method: "GET" }, { month, catalogItemId: "switch-30" }),
    ).rejects.toThrow("BAD_REQUEST");
    await expect(post("NOT-A-UUID")).rejects.toThrow("BAD_REQUEST");
  });
});
