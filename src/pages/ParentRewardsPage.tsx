/**
 * @file ParentRewardsPage
 * @description 保護者向けポイント交換承認（Issue #38）。pending の承認／却下と月次履歴。
 *   承認は承認時点の balancePoints / penaltyTicketCount で再検証される（契約 T10b）。
 *   正本: docs `screen-design.md` §7.5 / `api-tobe-f-contract.md` §3.11.1。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  postPointExchangeDecision,
  postRewardVoucherRefundDecision,
} from "@/api/client";
import {
  pointExchangeRequestsQuery,
  parentHomeQuery,
  queryKeys,
  rewardVoucherConsumptionsQuery,
  rewardVoucherRefundRequestsQuery,
} from "@/api/queries";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { currentMonth, formatMonthLabel, shiftMonth } from "@/lib/month";
import {
  POINT_EXCHANGE_STATUS_LABEL,
  formatDateTimeJstLabel,
  formatEffectsSummary,
  formatLineItemLabel,
  formatRefundLineItemLabel,
  pointExchangeStatusTone,
} from "@/lib/pointExchangeUi";
import type {
  PointExchangeRequest,
  PointExchangeStatus,
  RewardVoucherConsumption,
  RewardVoucherRefundRequest,
  RewardVouchers,
} from "@/types/api";

/** 交換・戻し申請の表示状態。all は API の状態値ではない UI 専用値。 */
type RequestStatusFilter = "all" | PointExchangeStatus;

const REQUEST_STATUS_FILTER_LABEL: Record<RequestStatusFilter, string> = {
  all: "すべて",
  pending: "承認待ち",
  approved: "承認済み",
  rejected: "却下済み",
};

/**
 * 物理券使用ログ1件（読取専用）
 * @param {{ consumption: RewardVoucherConsumption }} props - 使用ログ
 * @returns {JSX.Element} カード
 */
function RewardVoucherConsumptionCard({
  consumption,
}: {
  consumption: RewardVoucherConsumption;
}) {
  return (
    <li
      className="rounded-default border-[3px] border-border-soft bg-surface px-4 py-3"
      data-testid={`parent-consumption-item-${consumption.operationId}`}
    >
      <p className="mb-1 text-sm text-muted">
        {formatDateTimeJstLabel(consumption.consumedAt)}
      </p>
      <ul className="flex flex-col gap-1">
        {consumption.items.map((item) => (
          <li
            key={item.catalogItemId}
            className="flex items-center justify-between gap-3 text-sm text-ink"
          >
            <span>{item.label} × {item.quantity}</span>
            <span className="whitespace-nowrap font-bold">
              {item.stockBefore}枚 → {item.stockAfter}枚
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * @typedef {object} PointExchangeRequestCardProps
 * @property {PointExchangeRequest} request - 申請1件
 */
interface PointExchangeRequestCardProps {
  /** @type {PointExchangeRequest} 申請1件 */
  request: PointExchangeRequest;
  currentBalancePoints: number | null;
  currentRewardVouchers: RewardVouchers | null;
  currentPenaltyTicketCount: number | null;
}

/**
 * 申請1件のカード（pending は承認／却下操作を持つ）
 * @param {PointExchangeRequestCardProps} props - props
 * @returns {JSX.Element} カード
 */
function PointExchangeRequestCard({
  request,
  currentBalancePoints,
  currentRewardVouchers,
  currentPenaltyTicketCount,
}: PointExchangeRequestCardProps) {
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<"idle" | "approve" | "reject">("idle");
  const [rejectReason, setRejectReason] = useState("");

  /**
   * 承認／却下を完了した後の後処理（キャッシュ再取得）
   * @returns {void}
   */
  function invalidateAfterDecision(): void {
    setPanel("idle");
    setRejectReason("");
    void queryClient.invalidateQueries({ queryKey: ["pointExchangeRequests"] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parentHome });
    void queryClient.invalidateQueries({ queryKey: queryKeys.home });
  }

  const decisionMutation = useMutation({
    mutationFn: (payload: { decision: "approve" | "reject"; rejectReason?: string }) =>
      postPointExchangeDecision({ id: request.id, ...payload }),
    onSuccess: invalidateAfterDecision,
  });

  const isPending = request.status === "pending";
  const consumedPenaltyTickets = request.effects.consumedPenaltyTickets;
  const penaltyTicketShortage =
    currentPenaltyTicketCount !== null &&
    consumedPenaltyTickets > currentPenaltyTicketCount;

  return (
    <li
      className="rounded-default border-[3px] border-border-soft bg-surface px-4 py-3"
      data-testid={`parent-rewards-item-${request.id}`}
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
      {isPending && currentBalancePoints !== null && currentRewardVouchers && (
        <div className="mt-2 grid gap-1 rounded-default bg-surface-warm px-3 py-2 text-sm text-ink sm:grid-cols-2">
          <p className="sm:col-span-2 text-xs text-muted">現在値からの目安（確定は承認時）</p>
          <p>
            承認後残高: <strong>{currentBalancePoints - request.effects.spentPoints}pt</strong>
          </p>
          <div>
            {Object.entries(request.effects.issuedRewardVouchers).map(
              ([catalogItemId, count]) => (
                <p key={catalogItemId}>
                  承認後 {request.items.find((item) => item.catalogItemId === catalogItemId)?.label ?? catalogItemId}: {currentRewardVouchers[catalogItemId as keyof RewardVouchers] + count}枚
                </p>
              ),
            )}
          </div>
          {consumedPenaltyTickets > 0 && currentPenaltyTicketCount !== null && (
            <p className="sm:col-span-2">
              承認後 ペナルティチケット: {currentPenaltyTicketCount - consumedPenaltyTickets}枚
              （現在 {currentPenaltyTicketCount}枚）
            </p>
          )}
          {penaltyTicketShortage && (
            <p className="sm:col-span-2 font-bold text-danger" role="alert">
              ペナルティチケットが{consumedPenaltyTickets - currentPenaltyTicketCount}枚不足しているため承認できません。
            </p>
          )}
        </div>
      )}
      <p className="text-sm text-muted">
        {isPending ? "承認時の反映予定" : "反映"}: {formatEffectsSummary(request.effects)}
      </p>
      {request.status === "rejected" && request.rejectReason && (
        <p className="text-sm text-muted">理由: {request.rejectReason}</p>
      )}

      {isPending && panel === "idle" && (
        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1"
            disabled={penaltyTicketShortage}
            onClick={() => setPanel("approve")}
            data-testid={`parent-rewards-approve-open-${request.id}`}
          >
            承認する
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            onClick={() => setPanel("reject")}
            data-testid={`parent-rewards-reject-open-${request.id}`}
          >
            却下する
          </Button>
        </div>
      )}

      {isPending && panel === "approve" && (
        <div className="mt-3 flex flex-col gap-2" data-testid={`parent-rewards-approve-panel-${request.id}`}>
          <p className="text-sm text-ink">
            {request.totalPoints}pt を消費して承認します。よろしいですか？
          </p>
          {decisionMutation.error && (
            <p className="text-sm text-danger" role="alert">
              {decisionMutation.error instanceof Error
                ? decisionMutation.error.message
                : "承認に失敗しました"}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={decisionMutation.isPending || penaltyTicketShortage}
              onClick={() => decisionMutation.mutate({ decision: "approve" })}
              data-testid={`parent-rewards-approve-submit-${request.id}`}
            >
              {decisionMutation.isPending ? "承認中…" : "確認して承認"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={decisionMutation.isPending}
              onClick={() => setPanel("idle")}
            >
              キャンセル
            </Button>
          </div>
        </div>
      )}

      {isPending && panel === "reject" && (
        <div className="mt-3 flex flex-col gap-2" data-testid={`parent-rewards-reject-panel-${request.id}`}>
          <label className="flex flex-col gap-1 text-sm">
            <span>却下理由（任意）</span>
            <input
              type="text"
              className="rounded-default border-[3px] border-border bg-surface px-3 py-2 text-ink"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              data-testid={`parent-rewards-reject-reason-${request.id}`}
            />
          </label>
          {decisionMutation.error && (
            <p className="text-sm text-danger" role="alert">
              {decisionMutation.error instanceof Error
                ? decisionMutation.error.message
                : "却下に失敗しました"}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant="danger"
              disabled={decisionMutation.isPending}
              onClick={() => decisionMutation.mutate({ decision: "reject", rejectReason })}
              data-testid={`parent-rewards-reject-submit-${request.id}`}
            >
              {decisionMutation.isPending ? "処理中…" : "却下する"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={decisionMutation.isPending}
              onClick={() => setPanel("idle")}
            >
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * @typedef {object} RewardVoucherRefundRequestCardProps
 * @property {RewardVoucherRefundRequest} request - 申請1件
 */
interface RewardVoucherRefundRequestCardProps {
  /** @type {RewardVoucherRefundRequest} 申請1件 */
  request: RewardVoucherRefundRequest;
  currentBalancePoints: number | null;
  currentRewardVouchers: RewardVouchers | null;
}

/**
 * 戻し申請1件のカード（pending は承認／却下操作を持つ）
 * @param {RewardVoucherRefundRequestCardProps} props - props
 * @returns {JSX.Element} カード
 */
function RewardVoucherRefundRequestCard({
  request,
  currentBalancePoints,
  currentRewardVouchers,
}: RewardVoucherRefundRequestCardProps) {
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<"idle" | "approve" | "reject">("idle");
  const [rejectReason, setRejectReason] = useState("");

  /**
   * 承認／却下を完了した後の後処理（キャッシュ再取得）
   * @returns {void}
   */
  function invalidateAfterDecision(): void {
    setPanel("idle");
    setRejectReason("");
    void queryClient.invalidateQueries({
      queryKey: ["rewardVoucherRefundRequests"],
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parentHome });
    void queryClient.invalidateQueries({ queryKey: queryKeys.home });
  }

  const decisionMutation = useMutation({
    mutationFn: (payload: { decision: "approve" | "reject"; rejectReason?: string }) =>
      postRewardVoucherRefundDecision({ id: request.id, ...payload }),
    onSuccess: invalidateAfterDecision,
  });

  const isPending = request.status === "pending";
  const voucherShortages = currentRewardVouchers
    ? request.items.filter(
        (item) => currentRewardVouchers[item.catalogItemId] < item.quantity,
      )
    : [];
  const hasVoucherShortage = voucherShortages.length > 0;

  return (
    <li
      className="rounded-default border-[3px] border-border-soft bg-surface px-4 py-3"
      data-testid={`parent-refund-item-${request.id}`}
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
          <li key={line.catalogItemId}>{formatRefundLineItemLabel(line)}</li>
        ))}
      </ul>
      <p className="text-sm font-bold text-ink">戻る合計 {request.totalPoints}pt</p>
      {isPending && currentBalancePoints !== null && currentRewardVouchers && (
        <div className="mt-2 grid gap-1 rounded-default bg-surface-warm px-3 py-2 text-sm text-ink sm:grid-cols-2">
          <p className="sm:col-span-2 text-xs text-muted">現在値からの目安（確定は承認時）</p>
          <p>
            承認後残高: <strong>{currentBalancePoints + request.totalPoints}pt</strong>
          </p>
          <div>
            {request.items.map((item) => (
              <p key={item.catalogItemId}>
                承認後 {item.label}: {currentRewardVouchers[item.catalogItemId] - item.quantity}枚
              </p>
            ))}
          </div>
          {hasVoucherShortage && (
            <p className="sm:col-span-2 font-bold text-danger" role="alert">
              {voucherShortages
                .map(
                  (item) =>
                    `${item.label}が${item.quantity - currentRewardVouchers[item.catalogItemId]}枚不足`,
                )
                .join("、")}しているため承認できません。
            </p>
          )}
        </div>
      )}
      {request.status === "rejected" && request.rejectReason && (
        <p className="text-sm text-muted">理由: {request.rejectReason}</p>
      )}

      {isPending && panel === "idle" && (
        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1"
            disabled={hasVoucherShortage}
            onClick={() => setPanel("approve")}
            data-testid={`parent-refund-approve-open-${request.id}`}
          >
            承認する
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            onClick={() => setPanel("reject")}
            data-testid={`parent-refund-reject-open-${request.id}`}
          >
            却下する
          </Button>
        </div>
      )}

      {isPending && panel === "approve" && (
        <div className="mt-3 flex flex-col gap-2" data-testid={`parent-refund-approve-panel-${request.id}`}>
          <p className="text-sm text-ink">
            券を減らして {request.totalPoints}pt を戻します。よろしいですか？
          </p>
          {decisionMutation.error && (
            <p className="text-sm text-danger" role="alert">
              {decisionMutation.error instanceof Error
                ? decisionMutation.error.message
                : "承認に失敗しました"}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={decisionMutation.isPending || hasVoucherShortage}
              onClick={() => decisionMutation.mutate({ decision: "approve" })}
              data-testid={`parent-refund-approve-submit-${request.id}`}
            >
              {decisionMutation.isPending ? "承認中…" : "確認して承認"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={decisionMutation.isPending}
              onClick={() => setPanel("idle")}
            >
              キャンセル
            </Button>
          </div>
        </div>
      )}

      {isPending && panel === "reject" && (
        <div className="mt-3 flex flex-col gap-2" data-testid={`parent-refund-reject-panel-${request.id}`}>
          <label className="flex flex-col gap-1 text-sm">
            <span>却下理由（任意）</span>
            <input
              type="text"
              className="rounded-default border-[3px] border-border bg-surface px-3 py-2 text-ink"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              data-testid={`parent-refund-reject-reason-${request.id}`}
            />
          </label>
          {decisionMutation.error && (
            <p className="text-sm text-danger" role="alert">
              {decisionMutation.error instanceof Error
                ? decisionMutation.error.message
                : "却下に失敗しました"}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant="danger"
              disabled={decisionMutation.isPending}
              onClick={() => decisionMutation.mutate({ decision: "reject", rejectReason })}
              data-testid={`parent-refund-reject-submit-${request.id}`}
            >
              {decisionMutation.isPending ? "処理中…" : "却下する"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={decisionMutation.isPending}
              onClick={() => setPanel("idle")}
            >
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * ポイント交換承認画面（保護者）
 * @returns {JSX.Element} ページ
 */
export function ParentRewardsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [statusFilter, setStatusFilter] =
    useState<RequestStatusFilter>("all");
  const { data: parentHome } = useQuery(parentHomeQuery);
  const { data, isLoading, error } = useQuery(pointExchangeRequestsQuery(month));
  const {
    data: refundData,
    isLoading: refundLoading,
    error: refundError,
  } = useQuery(rewardVoucherRefundRequestsQuery(month));
  const {
    data: consumptionData,
    isLoading: consumptionLoading,
    error: consumptionError,
  } = useQuery(rewardVoucherConsumptionsQuery(month));

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <ParentPageFrame>
        <p className="text-danger">
          {error instanceof Error ? error.message : "読み込みに失敗しました"}
        </p>
      </ParentPageFrame>
    );
  }

  const items = data?.items ?? [];
  const pendingItems = items.filter((item) => item.status === "pending");
  const decidedItems = items.filter((item) => item.status !== "pending");

  const refundItems = refundData?.items ?? [];
  const refundPendingItems = refundItems.filter((item) => item.status === "pending");
  const refundDecidedItems = refundItems.filter((item) => item.status !== "pending");
  const visiblePendingItems = pendingItems.filter(
    (item) => statusFilter === "all" || item.status === statusFilter,
  );
  const visibleDecidedItems = decidedItems.filter(
    (item) => statusFilter === "all" || item.status === statusFilter,
  );
  const visibleRefundPendingItems = refundPendingItems.filter(
    (item) => statusFilter === "all" || item.status === statusFilter,
  );
  const visibleRefundDecidedItems = refundDecidedItems.filter(
    (item) => statusFilter === "all" || item.status === statusFilter,
  );
  const consumptions = [...(consumptionData?.items ?? [])].sort((a, b) => {
    const timeOrder = Date.parse(b.consumedAt) - Date.parse(a.consumedAt);
    return timeOrder || a.operationId.localeCompare(b.operationId);
  });
  const currentBalancePoints = parentHome?.balancePoints ?? null;
  const currentRewardVouchers = parentHome?.rewardVouchers ?? null;
  const currentPenaltyTicketCount = parentHome?.penaltyTicketCount ?? null;

  return (
    <ParentPageFrame>
      <div className="mb-6">
        <p className="text-sm text-muted">保護者モード</p>
        <h1 className="text-app-lg font-bold text-ink">ポイント交換承認</h1>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="parent-rewards-pending-summary">
        <StatusBadge tone={pendingItems.length + refundPendingItems.length > 0 ? "warning" : "muted"}>
          承認待ち {pendingItems.length + refundPendingItems.length}件
        </StatusBadge>
        <span className="text-sm text-muted">交換 {pendingItems.length}件・戻し {refundPendingItems.length}件</span>
      </div>

      <Card className="mb-4" data-testid="parent-rewards-pending-card">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">承認待ち</h2>
          <StatusBadge tone={visiblePendingItems.length > 0 ? "warning" : "muted"}>
            {visiblePendingItems.length}件
          </StatusBadge>
        </div>
        {visiblePendingItems.length === 0 ? (
          <p className="text-sm text-muted">承認待ちの申請はありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visiblePendingItems.map((request) => (
              <PointExchangeRequestCard
                key={request.id}
                request={request}
                currentBalancePoints={currentBalancePoints}
                currentRewardVouchers={currentRewardVouchers}
                currentPenaltyTicketCount={currentPenaltyTicketCount}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4" data-testid="parent-refund-pending-card">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">戻し申請の承認待ち</h2>
          <StatusBadge tone={visibleRefundPendingItems.length > 0 ? "warning" : "muted"}>
            {visibleRefundPendingItems.length}件
          </StatusBadge>
        </div>
        {refundLoading && <p className="text-sm text-muted">読み込み中…</p>}
        {refundError && (
          <p className="text-sm text-danger">
            {refundError instanceof Error ? refundError.message : "読み込みに失敗しました"}
          </p>
        )}
        {!refundLoading && visibleRefundPendingItems.length === 0 ? (
          <p className="text-sm text-muted">戻し申請の承認待ちはありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleRefundPendingItems.map((request) => (
              <RewardVoucherRefundRequestCard
                key={request.id}
                request={request}
                currentBalancePoints={currentBalancePoints}
                currentRewardVouchers={currentRewardVouchers}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4" data-testid="parent-rewards-history-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            className="px-3 text-base"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            data-testid="parent-rewards-prev-month"
          >
            ← 前月
          </Button>
          <p className="text-center text-sm font-medium text-ink" data-testid="parent-rewards-month-label">
            {formatMonthLabel(month)}
          </p>
          <Button
            variant="secondary"
            className="px-3 text-base"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            data-testid="parent-rewards-next-month"
          >
            翌月 →
          </Button>
        </div>

        <label className="mb-3 flex items-center justify-end gap-2 text-sm text-ink">
          <span>状態</span>
          <select
            className="rounded-default border-[3px] border-border bg-surface px-3 py-2 text-ink"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as RequestStatusFilter)
            }
            data-testid="parent-rewards-status-filter"
          >
            {(
              Object.entries(REQUEST_STATUS_FILTER_LABEL) as Array<
                [RequestStatusFilter, string]
              >
            ).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <h3 className="mb-2 text-sm font-bold text-ink">交換の履歴</h3>
        {visibleDecidedItems.length === 0 ? (
          <p className="text-sm text-muted" data-testid="parent-rewards-history-empty">
            この月に承認／却下済みの申請はありません
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleDecidedItems.map((request) => (
              <PointExchangeRequestCard
                key={request.id}
                request={request}
                currentBalancePoints={currentBalancePoints}
                currentRewardVouchers={currentRewardVouchers}
                currentPenaltyTicketCount={currentPenaltyTicketCount}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4" data-testid="parent-refund-history-card">
        <h3 className="mb-2 text-sm font-bold text-ink">戻し申請の履歴</h3>
        {visibleRefundDecidedItems.length === 0 ? (
          <p className="text-sm text-muted" data-testid="parent-refund-history-empty">
            この月に承認／却下済みの戻し申請はありません
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleRefundDecidedItems.map((request) => (
              <RewardVoucherRefundRequestCard
                key={request.id}
                request={request}
                currentBalancePoints={currentBalancePoints}
                currentRewardVouchers={currentRewardVouchers}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card data-testid="parent-consumption-history-card">
        <h3 className="mb-2 text-sm font-bold text-ink">物理券の使用履歴</h3>
        {consumptionLoading && <p className="text-sm text-muted">読み込み中…</p>}
        {consumptionError && (
          <p className="text-sm text-danger" role="alert">
            {consumptionError instanceof Error
              ? consumptionError.message
              : "使用履歴の読み込みに失敗しました"}
          </p>
        )}
        {!consumptionLoading && !consumptionError && consumptions.length === 0 && (
          <p className="text-sm text-muted" data-testid="parent-consumption-history-empty">
            この月の使用履歴はありません
          </p>
        )}
        {consumptions.length > 0 && (
          <ul className="flex flex-col gap-2">
            {consumptions.map((consumption) => (
              <RewardVoucherConsumptionCard
                key={consumption.operationId}
                consumption={consumption}
              />
            ))}
          </ul>
        )}
      </Card>
    </ParentPageFrame>
  );
}
