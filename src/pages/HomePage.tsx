/**
 * @file HomePage
 * @description 子ども向けホーム。残高・状態・各画面への導線。
 *   4バリアント（通常／免除／vacation／exempt-vacation）と就寝モーダル（Issue #16）。
 *   保護者モード入口は ChildPageFrame（Issue #15）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuestRulesDialog } from "@/components/QuestRulesDialog";
import { BedtimeModal } from "@/components/BedtimeModal";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { homeQuery, queryKeys } from "@/api/queries";
import { postRegistrationSetting } from "@/api/client";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { useQuestDeadlineClock } from "@/hooks/useQuestDeadlineClock";
import { isWeekendEve } from "@/lib/deadline";
import { todayLocal } from "@/lib/date";
import {
  resolveBedtimeUiMode,
  resolveHomeVariant,
} from "@/lib/homeMode";
import {
  formatRegistrationReopenEndsAtLabel,
  isRegistrationReopenActive,
} from "@/lib/registrationReopen";
import {
  clearBedtimeHourDraft,
  setBedtimeHourDraft,
} from "@/lib/sessionStorage";
import type { BedtimeHour } from "@/types/api";

/** 免除日のお休み文言（仕様正） */
const EXEMPT_MESSAGE = "今日はクエストお休みです（ママが免除日に設定）";

/** 長期休みモード終了1週間前の移行期間バナー文言（仕様正・Issue #36） */
const VACATION_TRANSITION_MESSAGE =
  "長期休みモード終了の1週間前なので、生活リズムを元に戻そう。寝る時間は21時だよ";

/** 登録受付締切後に未着手だった場合のメッセージ */
function missedStartMessage(cutoffLabel: string): string {
  return `${cutoffLabel}を過ぎたので、今日はクエストを開始できません（-100pt）`;
}

/**
 * ホーム画面
 * @returns {JSX.Element} ページ
 */
export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [bedtimeModalOpen, setBedtimeModalOpen] = useState(false);
  const { data, isLoading, error } = useQuery(homeQuery);
  const today = todayLocal();
  const [bedtimeHour, setBedtimeHour] = useState<BedtimeHour | undefined>(
    undefined,
  );
  const [confirmedBedtimeHour, setConfirmedBedtimeHour] = useState<
    BedtimeHour | undefined
  >(undefined);

  useEffect(() => {
    if (!data) {
      return;
    }
    setBedtimeHour(data.bedtimeHour);
    setConfirmedBedtimeHour(data.bedtimeHour);
    if (data.bedtimeHour === undefined) {
      clearBedtimeHourDraft(today);
    } else {
      setBedtimeHourDraft(today, data.bedtimeHour);
    }
  }, [data, today]);

  const registrationMutation = useMutation({
    mutationFn: (hour: BedtimeHour) =>
      postRegistrationSetting({ date: today, bedtimeHour: hour, actor: "child" }),
    onSuccess: (saved) => {
      const savedHour = saved.bedtimeHour as BedtimeHour;
      setBedtimeHour(savedHour);
      setConfirmedBedtimeHour(savedHour);
      setBedtimeHourDraft(today, savedHour);
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
    onError: () => {
      const fallbackHour = confirmedBedtimeHour;
      setBedtimeHour(fallbackHour);
      if (fallbackHour === undefined) {
        clearBedtimeHourDraft(today);
      } else {
        setBedtimeHourDraft(today, fallbackHour);
      }
    },
  });

  const isExemptDay = data?.isExemptDay ?? false;
  const isVacationMode = data?.isVacationMode ?? false;
  const isVacationTransition = data?.isVacationTransition ?? false;
  const weekendEve = data?.isWeekendEve ?? isWeekendEve(today);

  const isReopenActive = isRegistrationReopenActive(data?.registrationReopen);

  const deadlineActive =
    !isLoading &&
    !!data &&
    !isExemptDay &&
    data.todayStatus === "unanswered" &&
    data.questAction === "start" &&
    !isReopenActive;

  const deadline = useQuestDeadlineClock(today, deadlineActive, bedtimeHour);

  if (isLoading) {
    return (
      <ChildPageFrame showHome={false} vacationMode={isVacationMode}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted">読み込み中…</p>
        </div>
      </ChildPageFrame>
    );
  }

  if (error || !data) {
    return (
      <ChildPageFrame showHome={false} vacationMode={isVacationMode}>
        <p className="text-danger">
          エラー: {error instanceof Error ? error.message : "不明"}
        </p>
      </ChildPageFrame>
    );
  }

  const variant = resolveHomeVariant(isExemptDay, isVacationMode);
  const bedtimeUi = resolveBedtimeUiMode({
    isExemptDay,
    isVacationMode,
    isWeekendEveDay: weekendEve,
    bedtimeHour,
    todayStatus: data.todayStatus,
    date: today,
    isTransitionPeriod: isVacationTransition,
  });

  const canStartQuest =
    !isExemptDay &&
    data.questAction === "start" &&
    (isReopenActive ||
      (!deadline.pastRegistrationCutoff && !deadline.beforeRegistrationStart)) &&
    !registrationMutation.isPending;
  const showMissedStartMessage =
    !isExemptDay &&
    !isReopenActive &&
    deadline.pastRegistrationCutoff &&
    data.todayStatus === "unanswered" &&
    data.questAction === "start";
  const showQuestStart = !isExemptDay && data.questAction === "start";
  const showQuestRetry = !isExemptDay && data.questAction === "retry";

  /**
   * 寝る時間を選択してサーバに保存する
   * @param {BedtimeHour} hour - 就寝時刻（時）
   * @returns {void}
   */
  function handleBedtimeChange(hour: BedtimeHour) {
    setBedtimeHour(hour);
    registrationMutation.mutate(hour);
  }

  /**
   * 就寝ボタンのラベル
   * @returns {string} ラベル
   */
  function bedtimeButtonLabel(): string {
    if (bedtimeHour === undefined) {
      return "今日の寝る時間を設定する";
    }
    return `今日の寝る時間: ${bedtimeHour}時`;
  }

  return (
    <ChildPageFrame showHome={false} vacationMode={isVacationMode}>
      <div
        className="flex flex-1 flex-col gap-5"
        data-testid="home-page"
        data-home-variant={variant}
      >
        {data.unacknowledgedCount > 0 && (
          <Banner onClick={() => navigate("/results?unacked=1")}>
            採点結果を確認する（未確認あり！）
          </Banner>
        )}

        <div className="flex flex-col items-center justify-center gap-3 rounded-card bg-surface-warm p-8 text-center shadow-[var(--shadow-card)]">
          <BalanceDisplay
            balancePoints={data.balancePoints}
            switchMinutes={data.switchMinutes ?? data.displayBalance}
            penaltyMinutes={data.penaltyMinutes}
            debtMinutes={data.debtMinutes}
            penaltyTicketCount={data.penaltyTicketCount}
            rewardVouchers={data.rewardVouchers}
            audience="child"
            compact
          />
          <button
            type="button"
            className="text-sm text-ink underline-offset-4 hover:underline"
            onClick={() => navigate("/rewards")}
          >
            🎟️ チケットをみる →
          </button>
        </div>

        {data.balancePoints < 0 && (
          <Banner
            tone="danger"
            onClick={() => navigate("/rewards")}
            data-testid="point-debt-banner"
          >
            ポイントがマイナスです。チケットで穴埋めできます
          </Banner>
        )}

        {!isExemptDay && isVacationTransition && (
          <div
            className="flex items-start gap-3 rounded-default border-[3px] border-info bg-info-soft px-4 py-4"
            data-testid="vacation-transition-banner"
          >
            <span className="mt-0.5 shrink-0 text-lg" aria-hidden>
              ⏰
            </span>
            <p className="min-w-0 flex-1 text-[15px] leading-snug text-ink">
              {VACATION_TRANSITION_MESSAGE}
            </p>
          </div>
        )}

        {bedtimeUi === "settable" && (
          <button
            type="button"
            onClick={() => setBedtimeModalOpen(true)}
            disabled={registrationMutation.isPending}
            data-testid="bedtime-entry"
            className="flex min-h-touch w-full items-center gap-3 rounded-default border border-border bg-surface px-5 py-3 text-left text-base text-ink disabled:opacity-40"
          >
            <span aria-hidden>🛏️</span>
            <span className="min-w-0 flex-1">{bedtimeButtonLabel()}</span>
            <span aria-hidden>{bedtimeHour === undefined ? "→" : "✓"}</span>
          </button>
        )}
        {bedtimeUi === "display" && bedtimeHour !== undefined && (
          <div
            className="flex min-h-touch items-center gap-3 rounded-default border border-border bg-surface px-5 py-3 text-base text-ink"
            data-testid="bedtime-display"
          >
            <span aria-hidden>🛏️</span>
            <span className="flex-1">今日の寝る時間: {bedtimeHour}時</span>
            <span aria-hidden>✓</span>
          </div>
        )}
        {(bedtimeUi === "locked21" ||
          (bedtimeUi === "hidden" && !isExemptDay)) && (
          <div
            className="flex min-h-touch items-center gap-3 rounded-default border border-border bg-surface px-5 py-3 text-base text-ink"
            data-testid="bedtime-locked"
          >
            <span aria-hidden>🛏️</span>
            <span className="flex-1">今日の寝る時間: 21時</span>
            <span aria-hidden>✓</span>
          </div>
        )}

        {isExemptDay && (
          <div className="flex items-start gap-3 rounded-default border-[3px] border-info bg-info-soft p-5">
            <span aria-hidden>🌙</span>
            <p className="text-lg text-ink" data-testid="exempt-message">
              {EXEMPT_MESSAGE}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {showQuestStart && canStartQuest && (
            <Button fullWidth onClick={() => navigate("/quest")}>
              🎯 クエストをはじめる！
            </Button>
          )}
          {showQuestStart && !canStartQuest && (
            <Button fullWidth disabled>
              🎯 クエストをはじめる！
            </Button>
          )}
          {showQuestRetry && (
            <Button
              fullWidth
              variant="secondary"
              onClick={() => navigate("/quest")}
            >
              やり直す
            </Button>
          )}
        </div>

        {!isExemptDay && isReopenActive && data.registrationReopen?.endsAt && (
          <p className="text-center text-sm text-muted" data-testid="reopen-active-hint">
            ママが受付を再開してくれたよ！
            {formatRegistrationReopenEndsAtLabel(
              data.registrationReopen.endsAt,
              today,
            )}
            までクエストできる
          </p>
        )}

        {showMissedStartMessage && (
          <Banner tone="danger">
            {missedStartMessage(deadline.registrationCutoffLabel)}
          </Banner>
        )}

        <div className="flex flex-col gap-3">
          <Button
            fullWidth
            variant="navResults"
            onClick={() => navigate("/results")}
            data-testid="nav-results"
          >
            採点結果をみる
          </Button>
          <Button
            fullWidth
            variant="navRewards"
            onClick={() => navigate("/rewards")}
            data-testid="nav-rewards"
          >
            ポイントを交換する
          </Button>
          <Button
            fullWidth
            variant="navTimer"
            onClick={() => navigate("/timer")}
            data-testid="nav-timer"
          >
            タイマーをスタート
          </Button>
        </div>

        {!isExemptDay && (
          <button
            type="button"
            className="flex min-h-touch w-full items-center justify-center rounded-default border border-border bg-surface px-6 py-3 text-lg text-ink hover:bg-surface-soft"
            onClick={() => setRulesOpen(true)}
          >
            クエストのルール
          </button>
        )}
      </div>

      <QuestRulesDialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        isVacationTransition={isVacationTransition}
      />

      <BedtimeModal
        open={bedtimeModalOpen}
        onClose={() => setBedtimeModalOpen(false)}
        selectedHour={bedtimeHour}
        onSelect={handleBedtimeChange}
        disabled={registrationMutation.isPending}
      />
    </ChildPageFrame>
  );
}
