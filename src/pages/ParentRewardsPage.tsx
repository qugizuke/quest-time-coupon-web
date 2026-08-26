/**
 * @file ParentRewardsPage
 * @description 保護者向けポイント交換承認（Issue #38 / Figma #78）。
 *   pending の承認／却下と月次履歴。承認は承認時点の balancePoints / penaltyTicketCount で再検証（T10b）。
 *   正本: docs `screen-design.md` §7.5 / Figma `65:150` / `240:1352`。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getJstClockParts } from "@/lib/date";
import { currentMonth, formatMonthLabel, shiftMonth } from "@/lib/month";
import {
  POINT_EXCHANGE_STATUS_LABEL,
  formatDateTimeJstLabel,
  formatLineItemLabel,
  formatRefundLineItemLabel,
  pointExchangeStatusTone,
} from "@/lib/pointExchangeUi";
import type {
  PointExchangeRequest,
  RewardVoucherConsumption,
  RewardVoucherRefundRequest,
  RewardVouchers,
} from "@/types/api";

/** 履歴タブ（Figma filter-tabs: すべて / 交換 / 戻し） */
type HistoryCategoryFilter = "all" | "exchange" | "refund";

const HISTORY_FILTER_TABS: Array<[HistoryCategoryFilter, string]> = [
  ["all", "すべて"],
  ["exchange", "交換"],
  ["refund", "戻し"],
];

type DecisionFeedback =
  | {
      kind: "success-approve" | "success-reject" | "error";
      summary: string;
      detail: string;
    }
  | null;

/**
 * ISO 日時を JST の短い表示 `M/D H:MM` に変換する
 * @param {string} iso - ISO 8601 日時
 * @returns {string} 表示ラベル
 */
function formatShortRequestDateTime(iso: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  const { dateYmd, hour, minute } = getJstClockParts(parsed);
  const month = Number(dateYmd.slice(5, 7));
  const day = Number(dateYmd.slice(8, 10));
  return `${month}/${day} ${hour}:${String(minute).padStart(2, "0")}`;
}

/**
 * 交換履歴1行のラベルを返す（Figma history-item）
 * @param {PointExchangeRequest} request - 申請
 * @returns {string} 例: `8/18 承認 Switch 30分 × 1（50pt）`
 */
function formatExchangeHistoryRow(request: PointExchangeRequest): string {
  const datePrefix = formatShortRequestDateTime(
    request.decidedAt || request.requestedAt,
  ).replace(/ \d+:\d+$/, "");
  const action = request.status === "approved" ? "承認" : "却下";
  const items = request.items
    .map((line) => `${line.label} × ${line.quantity}`)
    .join("、");
  return `${datePrefix} ${action} ${items}（${request.totalPoints}pt）`;
}

/**
 * 戻し履歴1行のラベルを返す
 * @param {RewardVoucherRefundRequest} request - 戻し申請
 * @returns {string} 表示ラベル
 */
function formatRefundHistoryRow(request: RewardVoucherRefundRequest): string {
  const datePrefix = formatShortRequestDateTime(
    request.decidedAt || request.requestedAt,
  ).replace(/ \d+:\d+$/, "");
  const action = request.status === "approved" ? "承認" : "却下";
  const items = request.items
    .map((line) => `${line.label} × ${line.quantity}`)
    .join("、");
  return `${datePrefix} ${action} ${items}（${request.totalPoints}pt）`;
}

/**
 * 月ナビ（Figma month-nav）
 * @param {object} props - props
 * @returns {JSX.Element} 月ナビ
 */
function MonthNavBar({
  month,
  onPrev,
  onNext,
  testIdPrefix,
  variant = "plain",
}: {
  month: string;
  onPrev: () => void;
  onNext: () => void;
  testIdPrefix: string;
  variant?: "plain" | "boxed";
}) {
  const nav = (
    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        className="text-muted hover:text-ink"
        onClick={onPrev}
        data-testid={`${testIdPrefix}-prev-month`}
      >
        ◀ 前月
      </button>
      <p
        className={variant === "boxed" ? "text-lg font-medium text-ink" : "font-medium text-ink"}
        data-testid={`${testIdPrefix}-month-label`}
      >
        {formatMonthLabel(month)}
      </p>
      <button
        type="button"
        className="text-muted hover:text-ink"
        onClick={onNext}
        data-testid={`${testIdPrefix}-next-month`}
      >
        翌月 ▶
      </button>
    </div>
  );

  if (variant === "boxed") {
    return (
      <div className="rounded-default bg-muted-soft px-4 py-2.5">{nav}</div>
    );
  }
  return nav;
}

/**
 * 履歴カテゴリタブ（Figma filter-tabs）
 * @param {object} props - props
 * @returns {JSX.Element} タブ
 */
function HistoryFilterTabs({
  value,
  onChange,
}: {
  value: HistoryCategoryFilter;
  onChange: (next: HistoryCategoryFilter) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-sm"
      role="tablist"
      aria-label="履歴の種類"
      data-testid="parent-rewards-history-filter"
    >
      {HISTORY_FILTER_TABS.map(([tab, label], index) => {
        const isActive = value === tab;
        const isFirst = index === 0;
        const isLast = index === HISTORY_FILTER_TABS.length - 1;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`parent-rewards-history-tab-${tab}`}
            className={[
              "h-9 px-5 text-[13px] font-medium transition-colors",
              isActive ? "bg-primary text-white" : "bg-chip text-muted",
              isFirst ? "rounded-l-sm" : "",
              isLast ? "rounded-r-sm" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(tab)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 却下確認ダイアログ（Figma parent-rewards-reject-dialog）
 * @param {object} props - props
 * @returns {JSX.Element | null} ダイアログ
 */
function RejectDecisionDialog({
  open,
  summary,
  rejectReason,
  errorMessage,
  isPending,
  onRejectReasonChange,
  onCancel,
  onConfirm,
  reasonTestId,
  submitTestId = "parent-rewards-reject-submit",
}: {
  open: boolean;
  summary: string;
  rejectReason: string;
  errorMessage: string | null;
  isPending: boolean;
  onRejectReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  reasonTestId: string;
  submitTestId?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
        aria-label="ダイアログを閉じる"
        disabled={isPending}
        onClick={() => {
          if (!isPending) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-rewards-reject-title"
        className="relative z-10 flex w-full max-w-md flex-col gap-6 rounded-default bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
        data-testid="parent-rewards-reject-dialog"
      >
        <div className="flex flex-col gap-2">
          <p className="text-[28px]" aria-hidden="true">
            ⚠️
          </p>
          <h2 id="parent-rewards-reject-title" className="text-lg text-ink">
            この申請を却下しますか？
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink">{summary}</p>
          <div className="text-[13px] text-muted">
            <p>却下すると、お子さまに通知されます。</p>
            <p>ポイント残高とチケット枚数は変わりません。</p>
          </div>
          <label className="flex flex-col gap-1">
            <span className="sr-only">却下理由（任意）</span>
            <input
              type="text"
              placeholder="却下理由を入力（任意）"
              className="rounded-sm border border-border-soft bg-muted-soft px-3 py-2 text-sm text-ink placeholder:text-muted-strong"
              value={rejectReason}
              onChange={(event) => onRejectReasonChange(event.target.value)}
              data-testid={reasonTestId}
            />
          </label>
          {errorMessage && (
            <p className="text-sm text-danger" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            className="flex-1"
            variant="secondary"
            disabled={isPending}
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            disabled={isPending}
            onClick={onConfirm}
            data-testid={submitTestId}
          >
            {isPending ? "処理中…" : "却下する"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * キー値行（Figma details 行）
 * @param {object} props - props
 * @returns {JSX.Element} 行
 */
function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

/**
 * 承認処理中カード（Figma parent-rewards-processing）
 * @param {object} props - props
 * @returns {JSX.Element} 処理中表示
 */
function ProcessingCard({ summary }: { summary: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-default border border-border-soft bg-surface-warm p-8 text-center"
      aria-live="polite"
      data-testid="parent-rewards-processing"
    >
      <p className="text-[32px] text-primary" aria-hidden="true">
        ⏳
      </p>
      <p className="text-base text-ink">承認処理中...</p>
      <p className="text-[13px] text-muted">{summary}を処理しています</p>
    </div>
  );
}

/**
 * 操作結果フィードバック（Figma parent-rewards-feedback）
 * @param {object} props - props
 * @returns {JSX.Element | null} フィードバック
 */
function DecisionFeedbackBanner({ feedback }: { feedback: DecisionFeedback }) {
  if (!feedback) return null;

  const styles =
    feedback.kind === "success-approve"
      ? "border-border-soft bg-success-soft text-success"
      : feedback.kind === "success-reject"
        ? "border-border-soft bg-muted-soft text-muted"
        : "border-border-soft bg-danger-soft text-danger";

  const icon =
    feedback.kind === "success-approve"
      ? "✅"
      : feedback.kind === "success-reject"
        ? "🚫"
        : "❌";
  const title =
    feedback.kind === "success-approve"
      ? "承認しました"
      : feedback.kind === "success-reject"
        ? "却下しました"
        : "処理に失敗しました";

  return (
    <div
      className={`mb-4 flex flex-col gap-3 rounded-default border p-5 ${styles}`}
      role="status"
      data-testid="parent-rewards-feedback"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        <p className="font-medium">{title}</p>
      </div>
      <p className="text-sm text-ink">{feedback.summary}</p>
      <p className="text-[13px] text-muted">{feedback.detail}</p>
    </div>
  );
}

interface PendingCardBaseProps {
  requestedAt: string;
  badge: ReactNode;
  title: string;
  details: ReactNode;
  shortageAlert?: ReactNode;
  processingSummary?: string | null;
  isProcessing: boolean;
  approveOpen: boolean;
  approveDisabled: boolean;
  approveSubmitDisabled: boolean;
  approveConfirmMessage: string;
  approveErrorMessage: string | null;
  onApproveOpen: () => void;
  onApproveCancel: () => void;
  onApproveConfirm: () => void;
  onRejectOpen: () => void;
  approveOpenTestId: string;
  approveSubmitTestId: string;
  approvePanelTestId: string;
  rejectOpenTestId: string;
  cardClassName: string;
  itemTestId: string;
}

/**
 * pending 申請カード共通枠（交換・戻し）
 * @param {PendingCardBaseProps} props - props
 * @returns {JSX.Element} カード
 */
function PendingRequestCard({
  requestedAt,
  badge,
  title,
  details,
  shortageAlert,
  processingSummary,
  isProcessing,
  approveOpen,
  approveDisabled,
  approveSubmitDisabled,
  approveConfirmMessage,
  approveErrorMessage,
  onApproveOpen,
  onApproveCancel,
  onApproveConfirm,
  onRejectOpen,
  approveOpenTestId,
  approveSubmitTestId,
  approvePanelTestId,
  rejectOpenTestId,
  cardClassName,
  itemTestId,
}: PendingCardBaseProps) {
  if (isProcessing && processingSummary) {
    return (
      <li data-testid={itemTestId}>
        <ProcessingCard summary={processingSummary} />
      </li>
    );
  }

  return (
    <li
      className={`flex flex-col gap-3 rounded-card border-[3px] border-border-parent-soft p-4 shadow-[var(--shadow-card)] ${cardClassName}`}
      data-testid={itemTestId}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted">
          {formatShortRequestDateTime(requestedAt)}
        </span>
        {badge}
      </div>
      <p className="text-base text-ink">{title}</p>
      <div className="flex flex-col gap-1">{details}</div>
      {shortageAlert}
      {!approveOpen ? (
        <div className="flex justify-end gap-2">
          <Button
            className="min-w-[144px]"
            disabled={approveDisabled}
            onClick={onApproveOpen}
            data-testid={approveOpenTestId}
          >
            ✓ 承認する
          </Button>
          <button
            type="button"
            className="inline-flex min-h-touch min-w-[144px] items-center justify-center rounded-default border-[3px] border-border-parent-soft bg-surface px-6 py-3 text-lg font-semibold text-danger transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onRejectOpen}
            data-testid={rejectOpenTestId}
          >
            ✕ 却下
          </button>
        </div>
      ) : (
        <div
          className="flex flex-col gap-3 rounded-default border border-border-soft bg-surface-warm p-4"
          data-testid={approvePanelTestId}
        >
          <p className="text-sm text-ink">{approveConfirmMessage}</p>
          {approveErrorMessage && (
            <p className="text-sm text-danger" role="alert">
              {approveErrorMessage}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              className="min-w-[144px]"
              disabled={approveSubmitDisabled}
              onClick={onApproveConfirm}
              data-testid={approveSubmitTestId}
            >
              確認して承認
            </Button>
            <Button
              className="min-w-[144px]"
              variant="secondary"
              disabled={isProcessing}
              onClick={onApproveCancel}
            >
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

interface PointExchangeRequestCardProps {
  request: PointExchangeRequest;
  currentBalancePoints: number | null;
  currentRewardVouchers: RewardVouchers | null;
  currentPenaltyTicketCount: number | null;
  onFeedback: (feedback: DecisionFeedback) => void;
}

/**
 * 交換申請カード
 * @param {PointExchangeRequestCardProps} props - props
 * @returns {JSX.Element} カード
 */
function PointExchangeRequestCard({
  request,
  currentBalancePoints,
  currentRewardVouchers,
  currentPenaltyTicketCount,
  onFeedback,
}: PointExchangeRequestCardProps) {
  const queryClient = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function invalidateAfterDecision(): void {
    setApproveOpen(false);
    setRejectOpen(false);
    setRejectReason("");
    void queryClient.invalidateQueries({
      queryKey: queryKeys.pointExchangeRequestsRoot,
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parentHome });
    void queryClient.invalidateQueries({ queryKey: queryKeys.home });
  }

  const decisionMutation = useMutation({
    mutationFn: (payload: { decision: "approve" | "reject"; rejectReason?: string }) =>
      postPointExchangeDecision({ id: request.id, ...payload }),
    onSuccess: (_data, variables) => {
      const summary = request.items
        .map((line) => formatLineItemLabel(line))
        .join("、");
      if (variables.decision === "approve") {
        onFeedback({
          kind: "success-approve",
          summary,
          detail: "ポイントが差し引かれ、ごほうびチケットが発行されました",
        });
      } else {
        onFeedback({
          kind: "success-reject",
          summary,
          detail:
            "お子さまに却下が通知されました。ポイント残高とチケット枚数は変わりません。",
        });
      }
      invalidateAfterDecision();
    },
    onError: (error) => {
      onFeedback({
        kind: "error",
        summary: request.items.map((line) => formatLineItemLabel(line)).join("、"),
        detail:
          error instanceof Error
            ? error.message
            : "通信エラーが発生しました。しばらく待ってからもう一度お試しください。",
      });
    },
  });

  const isPending = request.status === "pending";
  if (!isPending) {
    return (
      <li
        className="flex flex-col gap-1 rounded-default bg-surface px-3 py-3"
        data-testid={`parent-rewards-item-${request.id}`}
      >
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm text-ink">{formatExchangeHistoryRow(request)}</p>
          <StatusBadge tone={pointExchangeStatusTone(request.status)}>
            {POINT_EXCHANGE_STATUS_LABEL[request.status]}
          </StatusBadge>
        </div>
        {request.status === "rejected" && request.rejectReason && (
          <p className="text-sm text-muted">理由: {request.rejectReason}</p>
        )}
      </li>
    );
  }

  const consumedPenaltyTickets = request.effects.consumedPenaltyTickets;
  const penaltyTicketShortage =
    currentPenaltyTicketCount !== null &&
    consumedPenaltyTickets > currentPenaltyTicketCount;
  const primaryLine = request.items
    .map((line) => `${line.label} × ${line.quantity}`)
    .join("、");
  const processingSummary = `${primaryLine}（${request.totalPoints}pt）`;

  return (
    <>
      <PendingRequestCard
        requestedAt={request.requestedAt}
        badge={
          <StatusBadge tone="warning">{POINT_EXCHANGE_STATUS_LABEL.pending}</StatusBadge>
        }
        title={primaryLine}
        details={
          currentBalancePoints !== null && currentRewardVouchers ? (
            <>
              <DetailRow label="必要ポイント" value={`${request.totalPoints}pt`} />
              <DetailRow
                label="承認後の残高"
                value={`${currentBalancePoints - request.effects.spentPoints}pt`}
              />
              {Object.entries(request.effects.issuedRewardVouchers).map(
                ([catalogItemId, count]) => (
                  <DetailRow
                    key={catalogItemId}
                    label={`承認後の${request.items.find((item) => item.catalogItemId === catalogItemId)?.label ?? catalogItemId}`}
                    value={`${currentRewardVouchers[catalogItemId as keyof RewardVouchers] + count}枚`}
                  />
                ),
              )}
              {consumedPenaltyTickets > 0 && currentPenaltyTicketCount !== null && (
                <DetailRow
                  label="承認後のペナルティチケット"
                  value={`${currentPenaltyTicketCount - consumedPenaltyTickets}枚`}
                />
              )}
            </>
          ) : (
            <DetailRow label="必要ポイント" value={`${request.totalPoints}pt`} />
          )
        }
        shortageAlert={
          penaltyTicketShortage ? (
            <p className="text-sm font-bold text-danger" role="alert">
              ペナルティチケットが{consumedPenaltyTickets - (currentPenaltyTicketCount ?? 0)}
              枚不足しているため承認できません。
            </p>
          ) : undefined
        }
        processingSummary={processingSummary}
        isProcessing={decisionMutation.isPending && decisionMutation.variables?.decision === "approve"}
        approveOpen={approveOpen}
        approveDisabled={penaltyTicketShortage || decisionMutation.isPending}
        approveSubmitDisabled={penaltyTicketShortage || decisionMutation.isPending}
        approveConfirmMessage={`${request.totalPoints}pt を消費して承認します。よろしいですか？`}
        approveErrorMessage={
          decisionMutation.error instanceof Error ? decisionMutation.error.message : null
        }
        onApproveOpen={() => setApproveOpen(true)}
        onApproveCancel={() => setApproveOpen(false)}
        onApproveConfirm={() => decisionMutation.mutate({ decision: "approve" })}
        onRejectOpen={() => setRejectOpen(true)}
        approveOpenTestId={`parent-rewards-approve-open-${request.id}`}
        approveSubmitTestId={`parent-rewards-approve-submit-${request.id}`}
        approvePanelTestId={`parent-rewards-approve-panel-${request.id}`}
        rejectOpenTestId={`parent-rewards-reject-open-${request.id}`}
        cardClassName="bg-surface-warm"
        itemTestId={`parent-rewards-item-${request.id}`}
      />
      <RejectDecisionDialog
        open={rejectOpen}
        summary={primaryLine}
        rejectReason={rejectReason}
        errorMessage={
          decisionMutation.error instanceof Error ? decisionMutation.error.message : null
        }
        isPending={decisionMutation.isPending}
        onRejectReasonChange={setRejectReason}
        onCancel={() => {
          setRejectOpen(false);
          setRejectReason("");
        }}
        onConfirm={() => decisionMutation.mutate({ decision: "reject", rejectReason })}
        reasonTestId={`parent-rewards-reject-reason-${request.id}`}
        submitTestId={`parent-rewards-reject-submit-${request.id}`}
      />
    </>
  );
}

interface RewardVoucherRefundRequestCardProps {
  request: RewardVoucherRefundRequest;
  currentBalancePoints: number | null;
  currentRewardVouchers: RewardVouchers | null;
  onFeedback: (feedback: DecisionFeedback) => void;
}

/**
 * 戻し申請カード
 * @param {RewardVoucherRefundRequestCardProps} props - props
 * @returns {JSX.Element} カード
 */
function RewardVoucherRefundRequestCard({
  request,
  currentBalancePoints,
  currentRewardVouchers,
  onFeedback,
}: RewardVoucherRefundRequestCardProps) {
  const queryClient = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  function invalidateAfterDecision(): void {
    setApproveOpen(false);
    setRejectOpen(false);
    setRejectReason("");
    void queryClient.invalidateQueries({
      queryKey: queryKeys.rewardVoucherRefundRequestsRoot,
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.parentHome });
    void queryClient.invalidateQueries({ queryKey: queryKeys.home });
  }

  const decisionMutation = useMutation({
    mutationFn: (payload: { decision: "approve" | "reject"; rejectReason?: string }) =>
      postRewardVoucherRefundDecision({ id: request.id, ...payload }),
    onSuccess: (_data, variables) => {
      const summary = request.items
        .map((line) => formatRefundLineItemLabel(line))
        .join("、");
      if (variables.decision === "approve") {
        onFeedback({
          kind: "success-approve",
          summary,
          detail: "ポイントが戻り、ごほうびチケットが減りました",
        });
      } else {
        onFeedback({
          kind: "success-reject",
          summary,
          detail:
            "お子さまに却下が通知されました。ポイント残高とチケット枚数は変わりません。",
        });
      }
      invalidateAfterDecision();
    },
    onError: (error) => {
      onFeedback({
        kind: "error",
        summary: request.items.map((line) => formatRefundLineItemLabel(line)).join("、"),
        detail:
          error instanceof Error
            ? error.message
            : "通信エラーが発生しました。しばらく待ってからもう一度お試しください。",
      });
    },
  });

  const isPending = request.status === "pending";
  if (!isPending) {
    return (
      <li
        className="flex flex-col gap-1 rounded-default bg-surface px-3 py-3"
        data-testid={`parent-refund-item-${request.id}`}
      >
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm text-ink">{formatRefundHistoryRow(request)}</p>
          <StatusBadge tone={pointExchangeStatusTone(request.status)}>
            {POINT_EXCHANGE_STATUS_LABEL[request.status]}
          </StatusBadge>
        </div>
        {request.status === "rejected" && request.rejectReason && (
          <p className="text-sm text-muted">理由: {request.rejectReason}</p>
        )}
      </li>
    );
  }

  const voucherShortages = currentRewardVouchers
    ? request.items.filter(
        (item) => currentRewardVouchers[item.catalogItemId] < item.quantity,
      )
    : [];
  const hasVoucherShortage = voucherShortages.length > 0;
  const primaryLine = request.items
    .map((line) => `${line.label} × ${line.quantity}`)
    .join("、");
  const processingSummary = `${primaryLine}（${request.totalPoints}pt）`;

  return (
    <>
      <PendingRequestCard
        requestedAt={request.requestedAt}
        badge={<StatusBadge tone="info">戻し申請</StatusBadge>}
        title={primaryLine}
        details={
          currentBalancePoints !== null ? (
            <>
              <DetailRow label="返却ポイント" value={`${request.totalPoints}pt`} />
              <DetailRow
                label="承認後の残高"
                value={`${currentBalancePoints + request.totalPoints}pt`}
              />
              {currentRewardVouchers &&
                request.items.map((item) => (
                  <DetailRow
                    key={item.catalogItemId}
                    label={`承認後の${item.label}`}
                    value={`${currentRewardVouchers[item.catalogItemId] - item.quantity}枚`}
                  />
                ))}
            </>
          ) : (
            <DetailRow label="返却ポイント" value={`${request.totalPoints}pt`} />
          )
        }
        shortageAlert={
          hasVoucherShortage && currentRewardVouchers ? (
            <p className="text-sm font-bold text-danger" role="alert">
              {voucherShortages
                .map(
                  (item) =>
                    `${item.label}が${item.quantity - currentRewardVouchers[item.catalogItemId]}枚不足`,
                )
                .join("、")}
              しているため承認できません。
            </p>
          ) : undefined
        }
        processingSummary={processingSummary}
        isProcessing={decisionMutation.isPending && decisionMutation.variables?.decision === "approve"}
        approveOpen={approveOpen}
        approveDisabled={hasVoucherShortage || decisionMutation.isPending}
        approveSubmitDisabled={hasVoucherShortage || decisionMutation.isPending}
        approveConfirmMessage={`${request.totalPoints}pt を戻して承認します。よろしいですか？`}
        approveErrorMessage={
          decisionMutation.error instanceof Error ? decisionMutation.error.message : null
        }
        onApproveOpen={() => setApproveOpen(true)}
        onApproveCancel={() => setApproveOpen(false)}
        onApproveConfirm={() => decisionMutation.mutate({ decision: "approve" })}
        onRejectOpen={() => setRejectOpen(true)}
        approveOpenTestId={`parent-refund-approve-open-${request.id}`}
        approveSubmitTestId={`parent-refund-approve-submit-${request.id}`}
        approvePanelTestId={`parent-refund-approve-panel-${request.id}`}
        rejectOpenTestId={`parent-refund-reject-open-${request.id}`}
        cardClassName="bg-surface"
        itemTestId={`parent-refund-item-${request.id}`}
      />
      <RejectDecisionDialog
        open={rejectOpen}
        summary={primaryLine}
        rejectReason={rejectReason}
        errorMessage={
          decisionMutation.error instanceof Error ? decisionMutation.error.message : null
        }
        isPending={decisionMutation.isPending}
        onRejectReasonChange={setRejectReason}
        onCancel={() => {
          setRejectOpen(false);
          setRejectReason("");
        }}
        onConfirm={() => decisionMutation.mutate({ decision: "reject", rejectReason })}
        reasonTestId={`parent-refund-reject-reason-${request.id}`}
        submitTestId={`parent-refund-reject-submit-${request.id}`}
      />
    </>
  );
}

/**
 * 物理券使用ログ1件（Figma with-usage-history）
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
      className="flex flex-col gap-3 rounded-card border-[3px] border-border-parent-soft bg-surface-warm p-4 shadow-[var(--shadow-card)]"
      data-testid={`parent-consumption-item-${consumption.operationId}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-muted">
          {formatDateTimeJstLabel(consumption.consumedAt)}
        </span>
        <StatusBadge tone="muted">使用済み</StatusBadge>
      </div>
      <ul className="flex flex-col gap-2">
        {consumption.items.map((item) => (
          <li
            key={item.catalogItemId}
            className="flex items-center gap-3 text-2xl text-ink"
          >
            <span>{item.label}</span>
            <span className="text-2xl font-normal text-ink">× {item.quantity} 枚</span>
          </li>
        ))}
      </ul>
      <div className="rounded-sm border border-border-soft bg-surface px-3 py-3 text-xs">
        <p className="mb-1 font-bold text-ink-brand">使ったあとの残りチケット：</p>
        {consumption.items.map((item) => (
          <p key={item.catalogItemId} className="text-ink-brand-sub">
            {item.label}: {item.stockBefore}枚 → 残り {item.stockAfter}枚
          </p>
        ))}
      </div>
      <p className="text-xs text-muted-strong">
        使用記録ID: {consumption.operationId}
      </p>
    </li>
  );
}

/**
 * ポイント交換承認画面（保護者）
 * @returns {JSX.Element} ページ
 */
export function ParentRewardsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [historyFilter, setHistoryFilter] = useState<HistoryCategoryFilter>("all");
  const [feedback, setFeedback] = useState<DecisionFeedback>(null);
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
  const pendingCount = pendingItems.length + refundPendingItems.length;

  const showExchangeHistory = historyFilter === "all" || historyFilter === "exchange";
  const showRefundHistory = historyFilter === "all" || historyFilter === "refund";

  const historyRows = [
    ...(showExchangeHistory
      ? decidedItems.map((request) => ({
          key: `exchange-${request.id}`,
          sortAt: request.decidedAt || request.requestedAt,
          node: (
            <PointExchangeRequestCard
              key={request.id}
              request={request}
              currentBalancePoints={null}
              currentRewardVouchers={null}
              currentPenaltyTicketCount={null}
              onFeedback={setFeedback}
            />
          ),
        }))
      : []),
    ...(showRefundHistory
      ? refundDecidedItems.map((request) => ({
          key: `refund-${request.id}`,
          sortAt: request.decidedAt || request.requestedAt,
          node: (
            <RewardVoucherRefundRequestCard
              key={request.id}
              request={request}
              currentBalancePoints={null}
              currentRewardVouchers={null}
              onFeedback={setFeedback}
            />
          ),
        }))
      : []),
  ].sort((a, b) => Date.parse(b.sortAt) - Date.parse(a.sortAt));

  const consumptions = [...(consumptionData?.items ?? [])].sort((a, b) => {
    const timeOrder = Date.parse(b.consumedAt) - Date.parse(a.consumedAt);
    return timeOrder || a.operationId.localeCompare(b.operationId);
  });
  const currentBalancePoints = parentHome?.balancePoints ?? null;
  const currentRewardVouchers = parentHome?.rewardVouchers ?? null;
  const currentPenaltyTicketCount = parentHome?.penaltyTicketCount ?? null;

  return (
    <ParentPageFrame>
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-[13px] text-muted">保護者モード</p>
        <h1 className="text-app-lg font-bold text-ink">ポイント交換承認</h1>
        <div
          className="inline-flex items-center gap-2 rounded-default bg-surface-warm px-3 py-2"
          data-testid="parent-rewards-pending-summary"
        >
          <p className="text-base text-ink">承認待ち {pendingCount}件</p>
          {pendingCount > 0 && (
            <StatusBadge tone="warning">承認待ち</StatusBadge>
          )}
        </div>
      </div>

      <DecisionFeedbackBanner feedback={feedback} />

      <section className="mb-6 flex flex-col gap-3" data-testid="parent-rewards-pending-card">
        <h2 className="text-2xl text-ink">
          承認待ちの交換申請 ({pendingItems.length}件)
        </h2>
        {pendingItems.length === 0 ? (
          <div className="flex items-center justify-center rounded-default border border-border-soft bg-muted-soft p-4">
            <p className="text-sm text-muted">
              現在、承認待ちの交換申請はありません
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {pendingItems.map((request) => (
              <PointExchangeRequestCard
                key={request.id}
                request={request}
                currentBalancePoints={currentBalancePoints}
                currentRewardVouchers={currentRewardVouchers}
                currentPenaltyTicketCount={currentPenaltyTicketCount}
                onFeedback={setFeedback}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 flex flex-col gap-3" data-testid="parent-refund-pending-card">
        <h2 className="text-2xl text-ink">
          承認待ちの戻し申請 ({refundPendingItems.length}件)
        </h2>
        {refundLoading && <p className="text-sm text-muted">読み込み中…</p>}
        {refundError && (
          <p className="text-sm text-danger">
            {refundError instanceof Error ? refundError.message : "読み込みに失敗しました"}
          </p>
        )}
        {!refundLoading && refundPendingItems.length === 0 ? (
          <div className="flex items-center justify-center rounded-default border border-border-soft bg-muted-soft p-4">
            <p className="text-sm text-muted">
              現在、承認待ちの戻し申請はありません
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {refundPendingItems.map((request) => (
              <RewardVoucherRefundRequestCard
                key={request.id}
                request={request}
                currentBalancePoints={currentBalancePoints}
                currentRewardVouchers={currentRewardVouchers}
                onFeedback={setFeedback}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6 flex flex-col gap-3" data-testid="parent-consumption-history-card">
        <div>
          <h2 className="text-2xl text-ink">チケット使用履歴</h2>
          <p className="text-sm text-muted">子どもが使った物理チケットの記録です</p>
        </div>
        <MonthNavBar
          month={month}
          onPrev={() => setMonth((m) => shiftMonth(m, -1))}
          onNext={() => setMonth((m) => shiftMonth(m, 1))}
          testIdPrefix="parent-rewards"
          variant="boxed"
        />
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
          <ul className="flex flex-col gap-3">
            {consumptions.map((consumption) => (
              <RewardVoucherConsumptionCard
                key={consumption.operationId}
                consumption={consumption}
              />
            ))}
          </ul>
        )}
      </section>

      <section
        className="flex flex-col gap-3 rounded-card bg-muted-soft p-4"
        data-testid="parent-rewards-history-card"
      >
        <h2 className="text-2xl text-ink">承認履歴</h2>
        <div className="flex flex-col gap-3">
          <MonthNavBar
            month={month}
            onPrev={() => setMonth((m) => shiftMonth(m, -1))}
            onNext={() => setMonth((m) => shiftMonth(m, 1))}
            testIdPrefix="parent-rewards-history"
          />
          <HistoryFilterTabs value={historyFilter} onChange={setHistoryFilter} />
        </div>
        {historyRows.length === 0 ? (
          <p className="text-sm text-muted" data-testid="parent-rewards-history-empty">
            この月に承認／却下済みの申請はありません
          </p>
        ) : (
          <ul className="flex flex-col gap-2">{historyRows.map((row) => row.node)}</ul>
        )}
      </section>
    </ParentPageFrame>
  );
}
