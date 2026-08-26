/**
 * @file ParentHomePage
 * @description 保護者ホーム（要対応キュー・現在設定・管理機能）。
 *   画面状態の正は GET parentHome（契約 §3.5）。
 *   Figma v6 parent-home のセクション構成に寄せる（Issue #75）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postRegistrationReopen } from "@/api/client";
import {
  parentHomeQuery,
  pointExchangeRequestsQuery,
  queryKeys,
  rewardVoucherRefundRequestsQuery,
} from "@/api/queries";
import { PenaltyTicketConsumeSection } from "@/components/PenaltyTicketConsumeSection";
import { PenaltyTicketIssueSection } from "@/components/PenaltyTicketIssueSection";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { currentMonth } from "@/lib/month";
import {
  DEFAULT_REOPEN_DURATION_MINUTES,
  buildEndsAtFromDuration,
  buildReopenDurationOptions,
  formatRegistrationReopenEndsAtLabel,
  parseReopenDurationMinutes,
} from "@/lib/registrationReopen";
import type { TodayRegistrationStatus } from "@/types/api";

/** 登録状況ラベル */
type RegistrationStatusLabel = "未登録" | "登録済" | "締切済み" | "免除";

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
      return "締切済み";
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
  const { data: parentHome, isLoading, error } = useQuery(parentHomeQuery);
  const { data: pendingExchange } = useQuery(
    pointExchangeRequestsQuery(currentMonth(), "pending"),
  );
  const { data: pendingRefund } = useQuery(
    rewardVoucherRefundRequestsQuery(currentMonth(), "pending"),
  );
  const pendingExchangeCount = pendingExchange?.items.length ?? 0;
  const pendingRefundCount = pendingRefund?.items.length ?? 0;
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
        : registrationStatus === "締切済み"
          ? "danger"
          : "warning";

  const registrationDescription =
    registrationStatus === "免除"
      ? "本日はクエスト免除です。"
      : registrationStatus === "登録済"
        ? "本日の登録は完了しています。"
        : registrationStatus === "締切済み"
          ? "本日は登録締め切り時間を過ぎています。"
          : parentHome.registrationReopen.isOpen
            ? "お子様からの登録を受け付けています。"
            : "本日の登録を待っています。";

  const bedtimeLabel = `${String(parentHome.bedtimeHour).padStart(2, "0")}:00`;

  return (
    <ParentPageFrame>
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-sm text-muted">保護者モード</p>
        <h1 className="text-app-lg text-ink">きょうの運用</h1>
      </div>

      <section className="mb-6" aria-labelledby="parent-operation-heading">
        <h2 id="parent-operation-heading" className="text-2xl text-ink">
          きょうの運用
        </h2>
        <p className="mt-2 text-sm text-muted">
          保護者としての今すぐの対応と、運用の確認をまとめて確認できます。
        </p>
      </section>

      <section className="mb-6" aria-labelledby="parent-queue-heading">
        <div className="mb-3">
          <h2 id="parent-queue-heading" className="text-2xl text-ink">
            📋 要対応
          </h2>
          <p className="mt-1 text-sm text-muted">
            優先度の高い対応をまとめて確認できます。
          </p>
        </div>

        <div
          className="grid gap-4 md:grid-cols-2"
          data-testid="parent-queue-grid"
        >
          <Card className="flex flex-col gap-3 p-4" data-testid="ungraded-card">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-ink">未採点のクエスト</h3>
              <StatusBadge tone={ungradedCount > 0 ? "danger" : "muted"}>
                {ungradedCount}件
              </StatusBadge>
            </div>
            <p className="text-sm text-muted">
              {ungradedCount > 0
                ? `お子様が提出したクエストが${ungradedCount}件未採点です。`
                : "対応は必要ありません。"}
            </p>
            <Button
              fullWidth
              variant={ungradedCount > 0 ? "primary" : "secondary"}
              onClick={() => navigate("/parent/grades")}
            >
              {ungradedCount > 0 ? "採点をはじめる →" : "採点一覧をみる"}
            </Button>
          </Card>

          <Card
            className="flex flex-col gap-3 p-4"
            data-testid="registration-reopen-card"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-ink">登録受付の再開</h3>
              <StatusBadge tone={registrationTone}>
                {registrationStatus}
              </StatusBadge>
            </div>
            <p className="text-sm text-muted">{registrationDescription}</p>
            {parentHome.registrationReopen.isOpen &&
              parentHome.registrationReopen.endsAt && (
                <p
                  className="text-sm text-muted"
                  data-testid="reopen-open-hint"
                >
                  登録受付再開中（〜
                  {formatRegistrationReopenEndsAtLabel(
                    parentHome.registrationReopen.endsAt,
                    targetDate,
                  )}
                  まで）
                </p>
              )}
            {!reopenOpen ? (
              <Button
                fullWidth
                disabled={!canReopen}
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
                    onChange={(event) => setReopenDuration(event.target.value)}
                    data-testid="reopen-duration-select"
                  >
                    {reopenOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
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

          <Card
            className="flex flex-col gap-3 p-4"
            data-testid="point-exchange-pending-card"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-ink">交換承認待ち</h3>
              <StatusBadge
                tone={pendingExchangeCount > 0 ? "warning" : "muted"}
              >
                {pendingExchangeCount}件
              </StatusBadge>
            </div>
            <p className="text-sm text-muted">
              {pendingExchangeCount > 0
                ? "お子様からの交換申請が承認待ちです。"
                : "対応は必要ありません。"}
            </p>
            <Button
              fullWidth
              variant={pendingExchangeCount > 0 ? "primary" : "secondary"}
              onClick={() => navigate("/parent/rewards")}
            >
              確認 →
            </Button>
          </Card>

          <Card
            className="flex flex-col gap-3 p-4"
            data-testid="return-pending-card"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-ink">戻し承認待ち</h3>
              <StatusBadge tone={pendingRefundCount > 0 ? "warning" : "muted"}>
                {pendingRefundCount}件
              </StatusBadge>
            </div>
            <p className="text-sm text-muted">
              {pendingRefundCount > 0
                ? "お子様からの戻し申請が承認待ちです。"
                : "対応は必要ありません。"}
            </p>
            <Button
              fullWidth
              variant={pendingRefundCount > 0 ? "primary" : "secondary"}
              onClick={() => navigate("/parent/rewards")}
            >
              確認 →
            </Button>
          </Card>
        </div>
      </section>

      <section
        className="mb-6"
        aria-labelledby="parent-settings-summary-heading"
      >
        <div className="mb-3">
          <h2
            id="parent-settings-summary-heading"
            className="text-2xl text-ink"
          >
            ⚙️ いまの設定
          </h2>
          <p className="mt-1 text-sm text-muted">
            現在の運用設定を確認できます。
          </p>
        </div>

        <div
          className="grid gap-4 md:grid-cols-3"
          data-testid="parent-settings-summary-grid"
        >
          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-ink">長期休みモード</h3>
            <div className="flex flex-col gap-1">
              <p
                className={
                  vacationActive ? "text-lg text-primary" : "text-lg text-muted"
                }
              >
                {vacationActive ? "モード中" : "オフ"}
              </p>
              {parentHome.isVacationTransition && (
                <p
                  className="text-sm text-warning"
                  data-testid="vacation-transition-indicator"
                >
                  終了1週間前の移行期間中（就寝21時固定）
                </p>
              )}
              <p className="text-sm text-muted" data-testid="vacation-period">
                {vacationPeriod
                  ? `期間：${vacationPeriod.startDate} 〜 ${vacationPeriod.endDate}`
                  : "期間未設定"}
              </p>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-ink">免除期間</h3>
            <p className="text-sm text-muted">
              {parentHome.isExemptToday ? "本日は免除" : "設定なし"}
            </p>
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <h3 className="text-ink">本日の目標就寝時刻</h3>
            <p className="text-lg text-ink">{bedtimeLabel}</p>
          </Card>
        </div>
      </section>

      <section aria-labelledby="parent-management-heading">
        <div className="mb-3">
          <h2 id="parent-management-heading" className="text-2xl text-ink">
            🔧 管理・設定
          </h2>
          <p className="mt-1 text-sm text-muted">
            日常頻度が低い管理機能をまとめて配置しています。
          </p>
        </div>

        <div
          className="grid gap-4 md:grid-cols-2"
          data-testid="parent-management-grid"
        >
          <PenaltyTicketIssueSection
            switchMinutes={parentHome.switchMinutes}
            penaltyMinutes={parentHome.penaltyMinutes}
            debtMinutes={parentHome.debtMinutes}
            issuablePenaltyTicketCount={parentHome.issuablePenaltyTicketCount}
          />
          <PenaltyTicketConsumeSection
            penaltyTicketCount={parentHome.penaltyTicketCount}
          />

          <Card
            className="flex flex-col gap-3 p-4"
            data-testid="point-refill-card"
          >
            <h3 className="text-ink">ポイント補填</h3>
            <p className="text-sm text-muted">
              お子様のポイントを保護者で補填します。
            </p>
            <Button fullWidth onClick={() => navigate("/parent/rewards")}>
              補填する
            </Button>
          </Card>

          <button
            type="button"
            className="self-start rounded-card border-[3px] border-border bg-surface p-4 text-left shadow-[var(--shadow-card)] hover:bg-surface-soft"
            onClick={() => navigate("/parent/settings")}
            data-testid="settings-management-card"
          >
            <span className="block text-ink">設定へ</span>
            <span className="mt-3 block text-sm text-muted">
              詳細設定や各種管理を行います。
            </span>
          </button>
        </div>
      </section>
    </ParentPageFrame>
  );
}
