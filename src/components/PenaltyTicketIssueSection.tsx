/**
 * @file PenaltyTicketIssueSection
 * @description 保護者向けペナルティチケット発行 UI。
 *   1枚 = 100pt精算 + 在庫加算（penaltyTicketCount += count）。issuablePenaltyTicketCount === 0 のとき disabled。
 *   発行した在庫の消費は PenaltyTicketConsumeSection の担当。子ども画面には置かない。actor は常に parent。
 */
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postPenaltyTicketIssue } from "@/api/client";
import { queryKeys } from "@/api/queries";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  PENALTY_TICKET_POINTS,
  calcPointDebt,
  calcIssuableTicketCount,
  canIssuePenaltyTicket,
  previewBalancePointsAfterIssue,
} from "@/lib/debt";

/**
 * @typedef {object} PenaltyTicketIssueSectionProps
 * @property {number} balancePoints - ポイント残高
 * @property {number} [issuablePenaltyTicketCount] - 発行可能枚数（未指定時は算出）
 */
export interface PenaltyTicketIssueSectionProps {
  /** @type {number} ポイント残高 */
  balancePoints: number;
  /** @type {number} 発行可能枚数 */
  issuablePenaltyTicketCount?: number;
}

/**
 * ペナルティチケット発行セクション（保護者のみ）
 * @param {PenaltyTicketIssueSectionProps} props - props
 * @returns {JSX.Element} 発行 UI
 */
export function PenaltyTicketIssueSection({
  balancePoints,
  issuablePenaltyTicketCount: issuableProp,
}: PenaltyTicketIssueSectionProps) {
  const queryClient = useQueryClient();
  const issuable =
    issuableProp ?? calcIssuableTicketCount(balancePoints);
  const canIssue = canIssuePenaltyTicket(balancePoints) && issuable >= 1;
  const pointDebt = calcPointDebt(balancePoints);

  const [count, setCount] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const safeCount = Math.min(Math.max(1, count), Math.max(1, issuable));
  const previewBalance = useMemo(
    () => previewBalancePointsAfterIssue(balancePoints, safeCount),
    [balancePoints, safeCount],
  );

  const issueMutation = useMutation({
    mutationFn: (issueCount: number) =>
      postPenaltyTicketIssue({ count: issueCount }),
    onSuccess: () => {
      setConfirmOpen(false);
      setCount(1);
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.parentHome });
    },
  });

  const countOptions = useMemo(() => {
    if (!canIssue) return [1];
    return Array.from({ length: issuable }, (_, i) => i + 1);
  }, [canIssue, issuable]);

  return (
    <Card data-testid="penalty-ticket-issue-section">
      <h2 className="mb-2 font-bold text-ink">
        ペナルティチケット発行（1枚={PENALTY_TICKET_POINTS}pt）
      </h2>
      <p className="mb-3 text-xs text-muted">発行は保護者のみ</p>

      <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">ポイント残高</dt>
        <dd
          className={balancePoints < 0 ? "font-semibold text-danger" : "text-ink"}
          data-testid="issue-balance-points"
        >
          {balancePoints}pt
        </dd>
        <dt className="text-muted">ポイント負債</dt>
        <dd
          className="font-semibold text-danger"
          data-testid="issue-point-debt"
        >
          {pointDebt}pt
        </dd>
        <dt className="text-muted">発行可能</dt>
        <dd data-testid="issue-issuable-count">{issuable}枚</dd>
      </dl>

      {!canIssue ? (
        <p className="mb-3 text-sm text-danger" data-testid="issue-disabled-reason">
          ポイント負債が100pt未満のため発行できません
        </p>
      ) : null}

      {!confirmOpen ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>発行枚数</span>
            <select
              className="rounded-default border-[3px] border-border bg-surface px-3 py-2 text-ink disabled:opacity-40"
              value={safeCount}
              disabled={!canIssue || issueMutation.isPending}
              onChange={(e) => setCount(Number(e.target.value))}
              data-testid="issue-count-select"
            >
              {countOptions.map((n) => (
                <option key={n} value={n}>
                  {n}枚（{n * PENALTY_TICKET_POINTS}pt精算）
                </option>
              ))}
            </select>
          </label>
          <Button
            fullWidth
            disabled={!canIssue || issueMutation.isPending}
            onClick={() => setConfirmOpen(true)}
            data-testid="issue-open-confirm"
          >
            発行する
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="issue-confirm-panel">
          <p className="text-sm text-ink">
            ポイント {balancePoints}pt → {safeCount}枚発行 → 発行後{" "}
            <span className="font-bold">{previewBalance}pt</span>
          </p>
          {issueMutation.error && (
            <p className="text-sm text-danger">
              {issueMutation.error instanceof Error
                ? issueMutation.error.message
                : "発行に失敗しました"}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              disabled={issueMutation.isPending}
              onClick={() => issueMutation.mutate(safeCount)}
              data-testid="issue-confirm-submit"
            >
              {issueMutation.isPending ? "発行中…" : "確認して発行"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={issueMutation.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
