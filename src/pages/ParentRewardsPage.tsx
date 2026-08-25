/**
 * @file ParentRewardsPage
 * @description 保護者向けポイント交換承認（Issue #38）。pending の承認／却下と月次履歴。
 *   承認は承認時点の balancePoints / penaltyTicketCount で再検証される（契約 T10b）。
 *   正本: docs `screen-design.md` §7.5 / `api-tobe-f-contract.md` §3.11.1。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { postPointExchangeDecision } from "@/api/client";
import { pointExchangeRequestsQuery, queryKeys } from "@/api/queries";
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
  pointExchangeStatusTone,
} from "@/lib/pointExchangeUi";
import type { PointExchangeRequest } from "@/types/api";

/**
 * @typedef {object} PointExchangeRequestCardProps
 * @property {PointExchangeRequest} request - 申請1件
 */
interface PointExchangeRequestCardProps {
  /** @type {PointExchangeRequest} 申請1件 */
  request: PointExchangeRequest;
}

/**
 * 申請1件のカード（pending は承認／却下操作を持つ）
 * @param {PointExchangeRequestCardProps} props - props
 * @returns {JSX.Element} カード
 */
function PointExchangeRequestCard({ request }: PointExchangeRequestCardProps) {
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
              disabled={decisionMutation.isPending}
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
 * ポイント交換承認画面（保護者）
 * @returns {JSX.Element} ページ
 */
export function ParentRewardsPage() {
  const [month, setMonth] = useState(currentMonth());
  const { data, isLoading, error } = useQuery(pointExchangeRequestsQuery(month));

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

  return (
    <ParentPageFrame>
      <div className="mb-6">
        <p className="text-sm text-muted">保護者モード</p>
        <h1 className="text-app-lg font-bold text-ink">ポイント交換承認</h1>
      </div>

      <Card className="mb-4" data-testid="parent-rewards-pending-card">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">承認待ち</h2>
          <StatusBadge tone={pendingItems.length > 0 ? "warning" : "muted"}>
            {pendingItems.length}件
          </StatusBadge>
        </div>
        {pendingItems.length === 0 ? (
          <p className="text-sm text-muted">承認待ちの申請はありません</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pendingItems.map((request) => (
              <PointExchangeRequestCard key={request.id} request={request} />
            ))}
          </ul>
        )}
      </Card>

      <Card data-testid="parent-rewards-history-card">
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

        {decidedItems.length === 0 ? (
          <p className="text-sm text-muted" data-testid="parent-rewards-history-empty">
            この月に承認／却下済みの申請はありません
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {decidedItems.map((request) => (
              <PointExchangeRequestCard key={request.id} request={request} />
            ))}
          </ul>
        )}
      </Card>
    </ParentPageFrame>
  );
}
