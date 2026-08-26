/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import {
  REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY,
  clearPendingRewardVoucherConsumption,
  loadPendingRewardVoucherConsumption,
  savePendingRewardVoucherConsumption,
} from "./rewardVoucherConsumptionOperation";

const operation = {
  operationId: "550e8400-e29b-41d4-a716-446655440000",
  items: [{ catalogItemId: "cash-100" as const, quantity: 2 }],
};

describe("rewardVoucherConsumptionOperation", () => {
  beforeEach(() => localStorage.clear());

  it("未確定 operationId と payload をタブ再訪後も復元する", () => {
    savePendingRewardVoucherConsumption(operation);
    expect(loadPendingRewardVoucherConsumption()).toEqual(operation);
  });

  it("一致する operationId の terminal 応答だけで削除する", () => {
    savePendingRewardVoucherConsumption(operation);
    clearPendingRewardVoucherConsumption("00000000-0000-4000-8000-000000000000");
    expect(loadPendingRewardVoucherConsumption()).toEqual(operation);
    clearPendingRewardVoucherConsumption(operation.operationId);
    expect(loadPendingRewardVoucherConsumption()).toBeNull();
  });

  it("壊れた値や対象外券を回復操作として読まない", () => {
    localStorage.setItem(
      REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY,
      JSON.stringify({ ...operation, items: [{ catalogItemId: "switch-30", quantity: 1 }] }),
    );
    expect(loadPendingRewardVoucherConsumption()).toBeNull();
  });
});
