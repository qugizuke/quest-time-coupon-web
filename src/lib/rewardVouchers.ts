/**
 * @file 報酬チケット在庫（rewardVouchers）の共通ヘルパー（Issue #43・ADR-006）
 * @description 正本: docs `api-tobe-f-contract.md` §3.3 / §3.11.2〜§3.11.4、`adr/006-reward-vouchers.md`。
 *   `snack-10` / `cash-100` / `dining-1000` / `switch-30` / `switch-60` の5キーのみを対象にする。
 *   `penalty-ticket-100` は在庫化・戻し・負債穴埋めの対象外。
 */
import type {
  RewardVoucherCatalogItemId,
  RewardVoucherRefundLineItem,
  RewardVouchers,
} from "@/types/api";
import { findCatalogItem } from "@/lib/pointExchangeCatalog";

/** 表示順を含む対象5キー（契約の JSON 例の順序に一致） */
export const REWARD_VOUCHER_KEYS: readonly RewardVoucherCatalogItemId[] = [
  "snack-10",
  "cash-100",
  "dining-1000",
  "switch-30",
  "switch-60",
];

/** カタログ ID → 表示ラベル */
export const REWARD_VOUCHER_LABELS: Record<RewardVoucherCatalogItemId, string> = {
  "snack-10": "おやつ",
  "cash-100": "100円",
  "dining-1000": "外食",
  "switch-30": "Switch 30分券",
  "switch-60": "Switch 60分券",
};

/** 全キー0の在庫（初期値・欠落補完のベース） */
export function zeroRewardVouchers(): RewardVouchers {
  return {
    "snack-10": 0,
    "cash-100": 0,
    "dining-1000": 0,
    "switch-30": 0,
    "switch-60": 0,
  };
}

/**
 * 部分的・欠落のある在庫データを5キー・0未満なしに正規化する（契約 §3.3）
 * @param {Partial<Record<string, number>>} [raw] - サーバ／モックの生データ
 * @returns {RewardVouchers} 正規化済み在庫
 */
export function normalizeRewardVouchers(
  raw?: Partial<Record<string, number>> | null,
): RewardVouchers {
  const normalized = zeroRewardVouchers();
  for (const key of REWARD_VOUCHER_KEYS) {
    const value = raw?.[key];
    normalized[key] =
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? value
        : 0;
  }
  return normalized;
}

/**
 * カタログ ID から1枚あたりの戻しポイント（＝交換単価）を返す
 * @param {RewardVoucherCatalogItemId} catalogItemId - カタログ ID
 * @returns {number} 単価（pt）
 * @throws {Error} 未知の catalogItemId の場合
 */
export function rewardVoucherPointValue(
  catalogItemId: RewardVoucherCatalogItemId,
): number {
  const item = findCatalogItem(catalogItemId);
  if (!item) {
    throw new Error(
      `rewardVoucherPointValue: 未知の catalogItemId です catalogItemId=${catalogItemId}`,
    );
  }
  return item.pointCost;
}

/** calcRewardVoucherTotals の算出結果 */
export interface RewardVoucherTotals {
  lineItems: RewardVoucherRefundLineItem[];
  totalPoints: number;
}

/**
 * 戻し申請・負債穴埋めの内訳（catalogItemId・quantity の組）から合計を算出する
 * @description quantity が0の項目は結果へ含めない。
 * @param {{ catalogItemId: string; quantity: number }[]} items - 選択内訳
 * @returns {RewardVoucherTotals} 内訳・合計ポイント
 * @throws {Error} 対象外の catalogItemId、または quantity が1以上の整数でない場合
 */
export function calcRewardVoucherTotals(
  items: { catalogItemId: string; quantity: number }[],
): RewardVoucherTotals {
  const lineItems: RewardVoucherRefundLineItem[] = [];
  let totalPoints = 0;

  for (const { catalogItemId, quantity } of items) {
    if (quantity === 0) continue;
    if (!isRewardVoucherCatalogItemId(catalogItemId)) {
      throw new Error(
        `calcRewardVoucherTotals: 対象外の catalogItemId です catalogItemId=${catalogItemId}`,
      );
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(
        `calcRewardVoucherTotals: quantity は1以上の整数が必要です catalogItemId=${catalogItemId}, quantity=${String(quantity)}`,
      );
    }
    const pointValue = rewardVoucherPointValue(catalogItemId);
    const subtotalPoints = pointValue * quantity;
    totalPoints += subtotalPoints;
    lineItems.push({
      catalogItemId,
      label: REWARD_VOUCHER_LABELS[catalogItemId],
      quantity,
      pointValue,
      subtotalPoints,
    });
  }

  return { lineItems, totalPoints };
}

/**
 * 文字列が報酬チケット対象カタログ ID か判定する
 * @param {string} value - 判定対象
 * @returns {boolean} 対象5キーのいずれかなら true
 */
export function isRewardVoucherCatalogItemId(
  value: string,
): value is RewardVoucherCatalogItemId {
  return (REWARD_VOUCHER_KEYS as readonly string[]).includes(value);
}

/**
 * 在庫が選択内訳をすべて満たすか判定する
 * @param {RewardVouchers} vouchers - 現在庫
 * @param {{ catalogItemId: RewardVoucherCatalogItemId; quantity: number }[]} items - 選択内訳
 * @returns {boolean} すべて満たすなら true
 */
export function hasEnoughRewardVouchers(
  vouchers: RewardVouchers,
  items: { catalogItemId: RewardVoucherCatalogItemId; quantity: number }[],
): boolean {
  return items.every((item) => vouchers[item.catalogItemId] >= item.quantity);
}

/** Switch券1枚あたりの加算分数（契約 §3.11.2） */
export const SWITCH_TICKET_MINUTES: Record<"switch-30" | "switch-60", number> = {
  "switch-30": 30,
  "switch-60": 60,
};
