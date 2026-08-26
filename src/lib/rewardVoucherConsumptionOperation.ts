/**
 * @file 物理報酬券使用の未確定操作を Local Storage に保持する。
 * @description 通信結果不明時も同じ operationId / payload だけを再送するための専用境界。
 */
import type { RewardVoucherConsumptionItemInput } from "@/types/api";

export const REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY =
  "qtc:reward-voucher-consumption:pending:v1";

export interface PendingRewardVoucherConsumptionOperation {
  operationId: string;
  items: RewardVoucherConsumptionItemInput[];
}

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PHYSICAL_IDS = ["snack-10", "cash-100", "dining-1000"] as const;

/** 保存値を安全に検証する。壊れた値は回復対象にしない。 */
export function isPendingRewardVoucherConsumptionOperation(
  value: unknown,
): value is PendingRewardVoucherConsumptionOperation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PendingRewardVoucherConsumptionOperation>;
  if (
    typeof candidate.operationId !== "string" ||
    !UUID_V4_PATTERN.test(candidate.operationId) ||
    !Array.isArray(candidate.items) ||
    candidate.items.length < 1 ||
    candidate.items.length > PHYSICAL_IDS.length
  ) {
    return false;
  }
  const seen = new Set<string>();
  return candidate.items.every((item) => {
    if (!item || typeof item !== "object") return false;
    const id = item.catalogItemId;
    if (!(PHYSICAL_IDS as readonly string[]).includes(id) || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return Number.isSafeInteger(item.quantity) && item.quantity >= 1;
  });
}

/** 未確定操作を読む。Storage 利用不可・破損時は null。 */
export function loadPendingRewardVoucherConsumption(): PendingRewardVoucherConsumptionOperation | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPendingRewardVoucherConsumptionOperation(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** mutation 開始前に未確定操作を保存する。 */
export function savePendingRewardVoucherConsumption(
  operation: PendingRewardVoucherConsumptionOperation,
): void {
  localStorage.setItem(
    REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY,
    JSON.stringify(operation),
  );
}

/** terminal 応答を確認した操作だけを削除する。 */
export function clearPendingRewardVoucherConsumption(operationId: string): void {
  const current = loadPendingRewardVoucherConsumption();
  if (current?.operationId === operationId) {
    localStorage.removeItem(REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY);
  }
}
