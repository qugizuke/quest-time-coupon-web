/**
 * @file ParentHomePage
 * @description 保護者ホーム（未採点・登録状況・再開・長期休み参照・設定）。
 *   画面状態の正は GET parentHome（契約 §3.5）。
 *   Figma parent-home の左主／右サイド2カラムに寄せる（Issue #19）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postRegistrationReopen } from "@/api/client";
import { parentHomeQuery, queryKeys } from "@/api/queries";
import { PenaltyTicketIssueSection } from "@/components/PenaltyTicketIssueSection";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  DEFAULT_REOPEN_DURATION_MINUTES,
  buildEndsAtFromDuration,
  buildReopenDurationOptions,
  formatRegistrationReopenEndsAtLabel,
  parseReopenDurationMinutes,
} from "@/lib/registrationReopen";
import type { TodayRegistrationStatus } from "@/types/api";

/** 登録状況ラベル */
type RegistrationStatusLabel =
  | "未登録"
  | "登録済"
  | "締切超過"
  | "免除";

/**
 * todayRegistrationStatus を UI ラベルへ変換する
 * @param {TodayRegistrationStatus} status - サーバ状態
 * @returns {RegistrationStatusLabel} 表示ラベル
 */
function toRegistrationLabel(
  status: TodayRegistrationStatus,
): RegistrationStatusLabel {
  switch (status) {
    case "exempt":
      return "免除";
    case "registered":
    case "graded":
    case "result_pending_ack":
      return "登録済";
    case "closed_unregistered":
      return "締切超過";
    case "open_unregistered":
    case "reopen_open":
      return "未登録";
    default:
      return "未登録";
  }
}

/**
 * 保護者ホーム
 * @returns {JSX.Element} ページ
 */
export function ParentHomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: parentHome,
    isLoading,
    error,
  } = useQuery(parentHomeQuery);
  const [reopenDuration, setReopenDuration] = useState(
    String(DEFAULT_REOPEN_DURATION_MINUTES),
  );
  const [reopenOpen, setReopenOpen] = useState(false);

  const ungradedCount = parentHome?.ungradedCount ?? 0;
  const targetDate = parentHome?.date ?? "";

  const registrationStatus: RegistrationStatusLabel = useMemo(() => {
    if (!parentHome) return "未登録";
    return toRegistrationLabel(parentHome.todayRegistrationStatus);
  }, [parentHome]);

  const canReopen = parentHome?.registrationReopen.available === true;

  const reopenOptions = useMemo(() => buildReopenDurationOptions(), []);

  const vacationPeriod =
    parentHome?.longVacation.startDate && parentHome?.longVacation.endDate
      ? {
          startDate: parentHome.longVacation.startDate,
          endDate: parentHome.longVacation.endDate,
        }
      : null;
  const vacationActive =
    parentHome?.longVacation.active === true ||
    parentHome?.isLongVacation === true;

  const reopenMutation = useMutation({
    mutationFn: (durationValue: string) => {
      const minutes = parseReopenDurationMinutes(durationValue);
      if (minutes === null) {
        throw new Error(
          `ParentHomePage.reopenMutation: 不正なタイマー値です durationValue=${durationValue}`,
        );
      }
      if (!targetDate) {
        throw new Error(
          "ParentHomePage.reopenMutation: 対象日が未設定です targetDate が空です",
        );
      }
      const endsAt = buildEndsAtFromDuration(minutes);
      return postRegistrationReopen({ date: targetDate, endsAt });
    },
    onSuccess: () => {
      setReopenOpen(false);
      setReopenDuration(String(DEFAULT_REOPEN_DURATION_MINUTES));
      void queryClient.invalidateQueries({ queryKey: queryKeys.parentHome });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gradeDates });
    },
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !parentHome) {
    return (
      <ParentPageFrame>
        <p className="text-danger">
          {error instanceof Error ? error.message : "読み込みに失敗しました"}
        </p>
      </ParentPageFrame>
    );
  }

  const registrationTone =
    registrationStatus === "免除"
      ? "info"
      : registrationStatus === "登録済"
        ? "success"
        : registrationStatus === "締切超過"
          ? "danger"
          : "warning";

  return (
    <ParentPageFrame>
      <div className="mb-6">
        <p className="text-sm text-muted">保護者モード</p>
        <h1 className="text-app-lg font-bold text-ink">きょうの運用</h1>
      </div>

      {/*
        Figma parent-home: 左約2/3（未採点＋登録）、右約1/3（長期休み＋設定）。
        狭幅のみ1列へ畳む。
      */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)] md:items-start">
        <div className="flex flex-col gap-4">
          {ungradedCount > 0 ? (
            <div
              className="flex flex-col gap-3 rounded-default border-[3px] border-info bg-info-soft p-4 sm:flex-row sm:items-center"
              data-testid="ungraded-banner"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-info">【要対応】未確認のクエストがあります</p>
                <p className="mt-1 text-sm text-ink">
                  お子様が提出したクエストが {ungradedCount}件 未採点です
                </p>
              </div>
              <Button onClick={() => navigate("/parent/grades")}>
                採点をはじめる →
              </Button>
            </div>
          ) : (
            <Card>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="font-bold text-ink">未採点</h2>
                <StatusBadge tone="muted">0件</StatusBadge>
              </div>
              <Button fullWidth variant="secondary" onClick={() => navigate("/parent/grades")}>
                採点一覧をみる
              </Button>
            </Card>
          )}

          <Card>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="font-bold text-ink">📅 本日の回答・登録状況</h2>
              <StatusBadge tone={registrationTone}>{registrationStatus}</StatusBadge>
            </div>
            {(parentHome.isExemptToday || registrationStatus === "免除") && (
              <p className="text-sm text-muted">今日はクエスト免除です</p>
            )}
            {registrationStatus === "締切超過" && (
              <p className="text-sm text-muted">
                本日は登録締め切り時間を過ぎているため、お子様側からの提出はロックされています。
              </p>
            )}
            {parentHome.registrationReopen.isOpen &&
              parentHome.registrationReopen.endsAt && (
                <p className="mt-2 text-sm text-muted" data-testid="reopen-open-hint">
                  登録受付再開中（〜
                  {formatRegistrationReopenEndsAtLabel(
                    parentHome.registrationReopen.endsAt,
                    targetDate,
                  )}
                  まで）
                </p>
              )}
          </Card>

          {canReopen && (
            <Card data-testid="registration-reopen-card">
              <h2 className="mb-2 font-bold text-ink">登録受付を再開</h2>
              <p className="mb-3 text-sm text-muted">
                当日1回のみ。いまからの時間を選んで子どもが登録できるようにします。
              </p>
              {!reopenOpen ? (
                <Button
                  fullWidth
                  onClick={() => {
                    setReopenOpen(true);
                    setReopenDuration(String(DEFAULT_REOPEN_DURATION_MINUTES));
                  }}
                >
                  登録受付を再開
                </Button>
              ) : (
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>再開する時間</span>
                    <select
                      className="rounded-default border-[3px] border-border bg-surface px-3 py-2 text-ink"
                      value={reopenDuration}
                      onChange={(e) => setReopenDuration(e.target.value)}
                      data-testid="reopen-duration-select"
                    >
                      {reopenOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {reopenMutation.error && (
                    <p className="text-sm text-danger">
                      {reopenMutation.error instanceof Error
                        ? reopenMutation.error.message
                        : "再開に失敗しました"}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={
                        parseReopenDurationMinutes(reopenDuration) === null ||
                        reopenMutation.isPending
                      }
                      onClick={() => reopenMutation.mutate(reopenDuration)}
                    >
                      再開する
                    </Button>
                    <Button
                      className="flex-1"
                      variant="secondary"
                      onClick={() => setReopenOpen(false)}
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          <PenaltyTicketIssueSection
            balanceMinutes={parentHome.balanceMinutes}
            penaltyMinutes={parentHome.penaltyMinutes}
            debtMinutes={parentHome.debtMinutes}
            issuablePenaltyTicketCount={parentHome.issuablePenaltyTicketCount}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-2 font-bold text-ink">🏖️ 長期休みモード</h2>
            <div
              className={[
                "rounded-default border-[3px] px-3 py-3",
                vacationActive
                  ? "border-primary bg-surface-warm"
                  : "border-border-soft bg-surface-soft",
              ].join(" ")}
            >
              <p className="text-sm text-muted">現在</p>
              <p
                className={[
                  "text-lg font-bold",
                  vacationActive ? "text-primary" : "text-muted",
                ].join(" ")}
              >
                {vacationActive ? "モード中" : "オフ"}
              </p>
              {vacationPeriod ? (
                <p className="mt-1 text-sm text-muted" data-testid="vacation-period">
                  期間：{vacationPeriod.startDate} 〜 {vacationPeriod.endDate}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">期間未設定</p>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">変更は各種設定から行えます</p>
          </Card>

          <Card>
            <h2 className="mb-3 font-bold text-ink">⚙️ 設定クイックメニュー</h2>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => navigate("/parent/settings")}
                className="flex w-full items-center justify-between rounded-default border border-border-parent-chip bg-surface px-4 py-3 text-left text-sm text-ink hover:bg-parent-chip"
              >
                <span>特定日のクエスト免除を設定</span>
                <span aria-hidden>→</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/parent/settings")}
                className="flex w-full items-center justify-between rounded-default border border-border-parent-chip bg-surface px-4 py-3 text-left text-sm text-ink hover:bg-parent-chip"
              >
                <span>本日の目標就寝時間を上書きする</span>
                <span aria-hidden>→</span>
              </button>
              <Button
                fullWidth
                variant="secondary"
                onClick={() => navigate("/parent/settings")}
              >
                設定へ
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </ParentPageFrame>
  );
}

