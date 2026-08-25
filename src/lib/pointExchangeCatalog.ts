/**
 * @file ポイント交換の固定カタログ（Issue #38 / #43）
 * @description 正本: docs `api-tobe-f-contract.md` §3.11.1 / `firestore-data-model.md` §14。
 *   固定6種のみ（任意カタログ・YouTube 単品交換は非対応）。Web と mock API の両方から参照する。
 *   ADR-006 以降、`snack-10` / `cash-100` / `dining-1000` / `switch-30` / `switch-60` は
 *   承認時に `switchMinutes` へ直接加算せず、`rewardVouchers` の在庫として発行する。
 */
import type {
  PointExchangeCatalogItemId,
  PointExchangeLineItem,
  RewardVoucherCatalogItemId,
} from "@/types/api";

/** カタログ1件あたりの承認時副作用（単価） */
export interface PointExchangeCatalogEffects {
  /** 承認時に発行される rewardVouchers のキー（対象外は undefined） */
  issuedVoucherId?: RewardVoucherCatalogItemId;
  /** 承認時に消費される penaltyTicketCount（1個あたり） */
  consumedPenaltyTickets: number;
}

/** 固定カタログ1件 */
export interface PointExchangeCatalogItem {
  catalogItemId: PointExchangeCatalogItemId;
  label: string;
  pointCost: number;
  effects: PointExchangeCatalogEffects;
}

/** 固定カタログ（契約 §3.11.1 の表と一致・順序も表示順） */
export const POINT_EXCHANGE_CATALOG: readonly PointExchangeCatalogItem[] = [
  {
    catalogItemId: "snack-10",
    label: "おやつ",
    pointCost: 10,
    effects: { issuedVoucherId: "snack-10", consumedPenaltyTickets: 0 },
  },
  {
    catalogItemId: "switch-30",
    label: "Switch 30分",
    pointCost: 50,
    effects: { issuedVoucherId: "switch-30", consumedPenaltyTickets: 0 },
  },
  {
    catalogItemId: "switch-60",
    label: "Switch 60分",
    pointCost: 100,
    effects: { issuedVoucherId: "switch-60", consumedPenaltyTickets: 0 },
  },
  {
    catalogItemId: "cash-100",
    label: "100円",
    pointCost: 100,
    effects: { issuedVoucherId: "cash-100", consumedPenaltyTickets: 0 },
  },
  {
    catalogItemId: "dining-1000",
    label: "外食",
    pointCost: 1000,
    effects: { issuedVoucherId: "dining-1000", consumedPenaltyTickets: 0 },
  },
  {
    catalogItemId: "penalty-ticket-100",
    label: "ペナルティチケット1枚消費",
    pointCost: 100,
    effects: { consumedPenaltyTickets: 1 },
  },
] as const;

/**
 * カタログ ID から定義を探す
 * @param {string} catalogItemId - カタログ ID
 * @returns {PointExchangeCatalogItem | undefined} 見つからなければ undefined
 */
export function findCatalogItem(
  catalogItemId: string,
): PointExchangeCatalogItem | undefined {
  return POINT_EXCHANGE_CATALOG.find(
    (item) => item.catalogItemId === catalogItemId,
  );
}

/** calcExchangeTotals の算出結果 */
export interface PointExchangeTotals {
  lineItems: PointExchangeLineItem[];
  totalPoints: number;
  /** カタログ ID → 承認時に発行される数量（`penalty-ticket-100` は含まない） */
  issuedRewardVouchers: Partial<Record<RewardVoucherCatalogItemId, number>>;
  consumedPenaltyTickets: number;
}

/**
 * 申請内訳（catalogItemId・quantity の組）から合計を算出する
 * @description quantity が 0 の項目は結果へ含めない（申請対象外）。
 * @param {{ catalogItemId: string; quantity: number }[]} items - 申請内訳
 * @returns {PointExchangeTotals} 合計ポイント・承認時副作用の合計
 * @throws {Error} 未知の catalogItemId、または quantity が1以上の整数でない場合
 */
export function calcExchangeTotals(
  items: { catalogItemId: string; quantity: number }[],
): PointExchangeTotals {
  const lineItems: PointExchangeLineItem[] = [];
  let totalPoints = 0;
  const issuedRewardVouchers: Partial<Record<RewardVoucherCatalogItemId, number>> = {};
  let consumedPenaltyTickets = 0;

  for (const { catalogItemId, quantity } of items) {
    if (quantity === 0) continue;
    const catalogItem = findCatalogItem(catalogItemId);
    if (!catalogItem) {
      throw new Error(
        `calcExchangeTotals: 未知の catalogItemId です catalogItemId=${catalogItemId}`,
      );
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(
        `calcExchangeTotals: quantity は1以上の整数が必要です catalogItemId=${catalogItemId}, quantity=${String(quantity)}`,
      );
    }
    const subtotalPoints = catalogItem.pointCost * quantity;
    totalPoints += subtotalPoints;
    const { issuedVoucherId, consumedPenaltyTickets: unitConsumed } =
      catalogItem.effects;
    if (issuedVoucherId) {
      issuedRewardVouchers[issuedVoucherId] =
        (issuedRewardVouchers[issuedVoucherId] ?? 0) + quantity;
    }
    consumedPenaltyTickets += unitConsumed * quantity;
    lineItems.push({
      catalogItemId: catalogItem.catalogItemId,
      label: catalogItem.label,
      quantity,
      pointCost: catalogItem.pointCost,
      subtotalPoints,
    });
  }

  return { lineItems, totalPoints, issuedRewardVouchers, consumedPenaltyTickets };
}
