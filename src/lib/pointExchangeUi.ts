/**
 * @file ポイント交換・報酬チケット戻しの表示ヘルパー（Issue #38 / #43）
 * @description status ラベル・トーン・日時整形など、子ども `/rewards` と
 *   保護者 `/parent/rewards` の両画面で共用する表示ロジック。
 */
import type { StatusBadgeTone } from "@/components/ui/StatusBadge";
import { getJstClockParts } from "@/lib/date";
import { REWARD_VOUCHER_LABELS } from "@/lib/rewardVouchers";
import type {
  PointExchangeEffects,
  PointExchangeLineItem,
  PointExchangeStatus,
  RewardVoucherRefundLineItem,
  RewardVoucherRefundStatus,
} from "@/types/api";

/** status の表示ラベル（交換・戻しで共通） */
export const POINT_EXCHANGE_STATUS_LABEL: Record<
  PointExchangeStatus | RewardVoucherRefundStatus,
  string
> = {
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下",
};

/**
 * status の StatusBadge トーンを返す
 * @param {PointExchangeStatus | RewardVoucherRefundStatus} status - 申請状態
 * @returns {StatusBadgeTone} トーン
 */
export function pointExchangeStatusTone(
  status: PointExchangeStatus | RewardVoucherRefundStatus,
): StatusBadgeTone {
  if (status === "pending") return "warning";
  if (status === "approved") return "success";
  return "danger";
}

/**
 * 申請内訳1件の表示ラベルを返す
 * @param {PointExchangeLineItem} item - 内訳1件
 * @returns {string} 例: `100円 × 5（500pt）`
 */
export function formatLineItemLabel(item: PointExchangeLineItem): string {
  return `${item.label} × ${item.quantity}（${item.subtotalPoints}pt）`;
}

/**
 * 戻し申請内訳1件の表示ラベルを返す
 * @param {RewardVoucherRefundLineItem} item - 内訳1件
 * @returns {string} 例: `100円 × 2（200pt）`
 */
export function formatRefundLineItemLabel(
  item: RewardVoucherRefundLineItem,
): string {
  return `${item.label} × ${item.quantity}（${item.subtotalPoints}pt）`;
}

/**
 * 承認時（または承認予定）の副作用サマリーを返す
 * @param {PointExchangeEffects} effects - 副作用
 * @returns {string} 例: `-500pt / おやつ+1 / チケット-1枚`
 */
export function formatEffectsSummary(effects: PointExchangeEffects): string {
  const parts: string[] = [`-${effects.spentPoints}pt`];
  for (const [catalogItemId, quantity] of Object.entries(
    effects.issuedRewardVouchers,
  )) {
    if (!quantity) continue;
    const label =
      REWARD_VOUCHER_LABELS[catalogItemId as keyof typeof REWARD_VOUCHER_LABELS];
    parts.push(`${label}+${quantity}`);
  }
  if (effects.consumedPenaltyTickets > 0) {
    parts.push(`チケット-${effects.consumedPenaltyTickets}枚`);
  }
  return parts.join(" / ");
}

/**
 * ISO 日時を JST の「M月D日 H時MM分」表示に変換する
 * @param {string} iso - ISO 8601 日時（`Z` / `+09:00` いずれも可）
 * @returns {string} 表示ラベル。空文字・不正時は `—`
 */
export function formatDateTimeJstLabel(iso: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  const { dateYmd, hour, minute } = getJstClockParts(parsed);
  const month = Number(dateYmd.slice(5, 7));
  const day = Number(dateYmd.slice(8, 10));
  return `${month}月${day}日 ${hour}時${String(minute).padStart(2, "0")}分`;
}
