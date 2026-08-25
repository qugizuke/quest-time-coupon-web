/**
 * @file RewardsPage
 * @description 子ども向けポイント交換（Issue #38）。固定カタログから複数枚を選んで申請し、
 *   自分の申請状況・月次履歴を確認する。申請時点では残高を変えない（承認時のみ反映）。
 *   正本: docs `screen-design.md` §6.7 / `api-tobe-f-contract.md` §3.11.1。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { homeQuery, pointExchangeRequestsQuery, queryKeys } from "@/api/queries";
import { postPointExchangeRequest } from "@/api/client";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { currentMonth, formatMonthLabel, shiftMonth } from "@/lib/month";
import { calcExchangeTotals, POINT_EXCHANGE_CATALOG } from "@/lib/pointExchangeCatalog";
import {
  POINT_EXCHANGE_STATUS_LABEL,
  formatDateTimeJstLabel,
  formatEffectsSummary,
  formatLineItemLabel,
  pointExchangeStatusTone,
} from "@/lib/pointExchangeUi";
import type { PointExchangeCatalogItemId } from "@/types/api";

/** カタログ ID → 選択数量 */
type QuantityState = Record<PointExchangeCatalogItemId, number>;

/**
 * 全カタログを数量0で初期化する
 * @returns {QuantityState} 初期数量
 */
function initialQuantities(): QuantityState {
  const state = {} as QuantityState;
  for (const item of POINT_EXCHANGE_CATALOG) {
    state[item.catalogItemId] = 0;
  }
  return state;
}

/**
 * ポイント交換画面（子ども）
 * @returns {JSX.Element} ページ
 */
export function RewardsPage() {
  const queryClient = useQueryClient();
  const { data: home, isLoading: homeLoading } = useQuery(homeQuery);
  const [quantities, setQuantities] = useState<QuantityState>(initialQuantities);
  const [month, setMonth] = useState(currentMonth());

  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
  } = useQuery(pointExchangeRequestsQuery(month));

  const totals = useMemo(() => {
    const items = POINT_EXCHANGE_CATALOG.map((item) => ({
      catalogItemId: item.catalogItemId,
      quantity: quantities[item.catalogItemId],
    })).filter((item) => item.quantity > 0);
    return calcExchangeTotals(items);
  }, [quantities]);

  const balancePoints = home?.balancePoints ?? 0;
  const canSubmit = totals.totalPoints > 0 && totals.totalPoints <= balancePoints;

  const submitMutation = useMutation({
    mutationFn: () =>
      postPointExchangeRequest({
        items: POINT_EXCHANGE_CATALOG.map((item) => ({
          catalogItemId: item.catalogItemId,
          quantity: quantities[item.catalogItemId],
        })).filter((item) => item.quantity > 0),
      }),
    onSuccess: () => {
      setQuantities(initialQuantities());
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({
        queryKey: ["pointExchangeRequests"],
      });
    },
  });

  /**
   * 指定カタログの数量を変更する
   * @param {PointExchangeCatalogItemId} catalogItemId - カタログ ID
   * @param {number} delta - 変化量（±1）
   * @returns {void}
   */
  function changeQuantity(catalogItemId: PointExchangeCatalogItemId, delta: number) {
    setQuantities((current) => ({
      ...current,
      [catalogItemId]: Math.max(0, current[catalogItemId] + delta),
    }));
  }

  if (homeLoading) {
    return <LoadingScreen />;
  }

  return (
    <ChildPageFrame>
      <div className="mb-6">
        <p className="text-sm text-muted">🎁 ポイント交換</p>
        <h1 className="text-app-lg font-bold text-ink">ポイントを交換する</h1>
      </div>

      <Card className="mb-4 flex flex-col gap-1" data-testid="rewards-balance-card">
        <p className="text-sm text-muted">いまのポイント</p>
        <p className="font-display text-app-xl leading-none text-ink" data-testid="rewards-balance-points">
          {balancePoints}pt
        </p>
        <p className="mt-2 text-sm text-muted">
          使える時間: {home?.switchMinutes ?? 0}分
        </p>
      </Card>

      <Card className="mb-4 flex flex-col gap-4" data-testid="rewards-catalog-card">
        <h2 className="font-bold text-ink">交換カタログ</h2>
        <ul className="flex flex-col gap-3">
          {POINT_EXCHANGE_CATALOG.map((item) => {
            const quantity = quantities[item.catalogItemId];
            return (
              <li
                key={item.catalogItemId}
                className="flex items-center justify-between gap-3 rounded-default border-[3px] border-border-soft bg-surface-soft px-4 py-3"
                data-testid={`catalog-item-${item.catalogItemId}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{item.label}</p>
                  <p className="text-sm text-muted">{item.pointCost}pt</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-default border-[3px] border-border bg-surface text-lg font-bold text-ink disabled:opacity-40"
                    onClick={() => changeQuantity(item.catalogItemId, -1)}
                    disabled={quantity <= 0 || submitMutation.isPending}
                    aria-label={`${item.label}を1個減らす`}
                  >
                    −
                  </button>
                  <span
                    className="w-8 text-center text-lg font-bold text-ink"
                    data-testid={`catalog-quantity-${item.catalogItemId}`}
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-default border-[3px] border-border bg-surface text-lg font-bold text-ink disabled:opacity-40"
                    onClick={() => changeQuantity(item.catalogItemId, 1)}
                    disabled={submitMutation.isPending}
                    aria-label={`${item.label}を1個増やす`}
                  >
                    ＋
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between rounded-default border-[3px] border-border bg-surface-warm px-4 py-3">
          <span className="text-sm text-muted">合計</span>
          <span className="font-display text-2xl text-ink" data-testid="rewards-total-points">
            {totals.totalPoints}pt
          </span>
        </div>

        {totals.totalPoints > balancePoints && (
          <p className="text-sm text-danger" data-testid="rewards-insufficient-balance">
            残高が足りません（いまのポイント: {balancePoints}pt）
          </p>
        )}

        {submitMutation.error && (
          <p className="text-sm text-danger" role="alert">
            {submitMutation.error instanceof Error
              ? submitMutation.error.message
              : "申請に失敗しました"}
          </p>
        )}

        <Button
          fullWidth
          disabled={!canSubmit || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
          data-testid="rewards-submit"
        >
          {submitMutation.isPending ? "申請中…" : "交換を申請する"}
        </Button>
      </Card>

      <Card data-testid="rewards-history-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            className="px-3 text-base"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            data-testid="rewards-prev-month"
          >
            ← 前月
          </Button>
          <p className="text-center text-sm font-medium text-ink" data-testid="rewards-month-label">
            {formatMonthLabel(month)}
          </p>
          <Button
            variant="secondary"
            className="px-3 text-base"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            data-testid="rewards-next-month"
          >
            翌月 →
          </Button>
        </div>

        {historyLoading && <p className="text-muted">読み込み中…</p>}
        {historyError && (
          <p className="text-danger">
            {historyError instanceof Error ? historyError.message : "エラー"}
          </p>
        )}

        {!historyLoading && (history?.items ?? []).length === 0 && (
          <p className="text-sm text-muted" data-testid="rewards-history-empty">
            この月の申請はありません
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {(history?.items ?? []).map((request) => (
            <li
              key={request.id}
              className="rounded-default border-[3px] border-border-soft bg-surface px-4 py-3"
              data-testid={`rewards-history-item-${request.id}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm text-muted">
                  {formatDateTimeJstLabel(request.requestedAt)}
                </span>
                <StatusBadge tone={pointExchangeStatusTone(request.status)}>
                  {POINT_EXCHANGE_STATUS_LABEL[request.status]}
                </StatusBadge>
              </div>
              <ul className="mb-1 flex flex-col gap-0.5 text-sm text-ink">
                {request.items.map((line) => (
                  <li key={line.catalogItemId}>{formatLineItemLabel(line)}</li>
                ))}
              </ul>
              <p className="text-sm font-bold text-ink">合計 {request.totalPoints}pt</p>
              {request.status === "approved" && (
                <p className="text-sm text-success">
                  反映: {formatEffectsSummary(request.effects)}
                </p>
              )}
              {request.status === "rejected" && request.rejectReason && (
                <p className="text-sm text-muted">理由: {request.rejectReason}</p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </ChildPageFrame>
  );
}
