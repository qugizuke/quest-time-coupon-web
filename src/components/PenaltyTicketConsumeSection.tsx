/**
 * @file PenaltyTicketConsumeSection
 * @description 保護者向けペナルティチケット消費 UI。
 *   実生活の手伝い完了後などに在庫チケットを1枚ずつ消費する。残高・負債は変えない。
 *   子ども画面には置かない。actor は常に parent。
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postPenaltyTicketConsume } from "@/api/client";
import { queryKeys } from "@/api/queries";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { canConsumePenaltyTicket } from "@/lib/debt";

/**
 * @typedef {object} PenaltyTicketConsumeSectionProps
 * @property {number} penaltyTicketCount - 未消費のペナルティチケット枚数
 */
export interface PenaltyTicketConsumeSectionProps {
  /** @type {number} 未消費のペナルティチケット枚数 */
  penaltyTicketCount: number;
}

/**
 * ペナルティチケット消費セクション（保護者のみ）
 * @param {PenaltyTicketConsumeSectionProps} props - props
 * @returns {JSX.Element} 消費 UI
 */
export function PenaltyTicketConsumeSection({
  penaltyTicketCount,
}: PenaltyTicketConsumeSectionProps) {
  const queryClient = useQueryClient();
  const canConsume = canConsumePenaltyTicket(penaltyTicketCount);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const consumeMutation = useMutation({
    mutationFn: () => postPenaltyTicketConsume(),
    onSuccess: () => {
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.parentHome });
    },
  });

  return (
    <Card data-testid="penalty-ticket-consume-section">
      <h2 className="mb-2 font-bold text-ink">ペナルティチケット消費</h2>
      <p className="mb-3 text-xs text-muted">
        実生活の手伝い完了後などに1枚消費（残高・負債は変わりません）
      </p>

      <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">在庫枚数</dt>
        <dd data-testid="consume-ticket-count">{penaltyTicketCount}枚</dd>
      </dl>

      {!canConsume ? (
        <p className="mb-3 text-sm text-muted" data-testid="consume-disabled-reason">
          在庫チケットがないため消費できません
        </p>
      ) : null}

      {!confirmOpen ? (
        <Button
          fullWidth
          disabled={!canConsume || consumeMutation.isPending}
          onClick={() => setConfirmOpen(true)}
          data-testid="consume-open-confirm"
        >
          1枚消費する
        </Button>
      ) : (
        <div className="flex flex-col gap-3" data-testid="consume-confirm-panel">
          <p className="text-sm text-ink">
            在庫 {penaltyTicketCount}枚 → 1枚消費 → 残り{" "}
            <span className="font-bold">
              {Math.max(0, penaltyTicketCount - 1)}枚
            </span>
          </p>
          {consumeMutation.error && (
            <p className="text-sm text-danger">
              {consumeMutation.error instanceof Error
                ? consumeMutation.error.message
                : "消費に失敗しました"}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              disabled={consumeMutation.isPending}
              onClick={() => consumeMutation.mutate()}
              data-testid="consume-confirm-submit"
            >
              {consumeMutation.isPending ? "処理中…" : "確認して消費"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={consumeMutation.isPending}
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
