/**
 * @file HomePage
 * @description 子ども向けホーム。残高・状態・各画面への導線。
 *   4バリアント（通常／免除／vacation／exempt-vacation）と就寝モーダル（Issue #16）。
 *   保護者モード入口は ChildPageFrame（Issue #15）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuestDeadlineCountdown } from "@/components/QuestDeadlineCountdown";
import { QuestRegistrationCutoffCountdown } from "@/components/QuestRegistrationCutoffCountdown";
import { QuestRulesDialog } from "@/components/QuestRulesDialog";
import { BedtimeModal } from "@/components/BedtimeModal";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { homeQuery, queryKeys } from "@/api/queries";
import { postRegistrationSetting } from "@/api/client";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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

const STATUS_LABEL = {
  unanswered: "今日はまだ答えていません",
  answered_ungraded: "回答済み・採点待ち",
  pending_ack: "結果の確認が必要です",
  completed: "今日は全部終わり！",
  exempt: "今日はクエストお休みです",
} as const;

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

  /** きょうの状態本文（Figma 寄せ・免除は仕様文言） */
  const statusBody = isExemptDay
    ? EXEMPT_MESSAGE
    : showMissedStartMessage
      ? missedStartMessage(deadline.registrationCutoffLabel)
      : data.todayStatus === "unanswered"
        ? "クエスト未回答：今日のクエストが待っているよ！"
        : STATUS_LABEL[data.todayStatus];

  return (
    <ChildPageFrame showHome={false} vacationMode={isVacationMode}>
      <div
        className="flex flex-1 flex-col gap-8"
        data-testid="home-page"
        data-home-variant={variant}
      >
        <Card
          tone="hero"
          className="flex flex-col items-center justify-center gap-3 p-8 text-center"
        >
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
        </Card>

        {data.balancePoints < 0 && (
          <Banner
            tone="danger"
            onClick={() => navigate("/rewards")}
            data-testid="point-debt-banner"
          >
            ポイントがマイナスです。チケットで穴埋めできます
          </Banner>
        )}

        {data.unacknowledgedCount > 0 && (
          <Banner onClick={() => navigate("/results?unacked=1")}>
            採点結果を確認する（未確認あり！）
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

        <div
          className={[
            "flex items-start gap-4 rounded-default border-[3px] p-5",
            isExemptDay
              ? "border-info bg-info-soft"
              : data.todayStatus === "completed"
                ? "border-success bg-success-soft"
                : "border-danger bg-danger-soft",
          ].join(" ")}
        >
          <span className="mt-0.5 shrink-0 text-xl" aria-hidden>
            {isExemptDay ? "🌙" : data.todayStatus === "completed" ? "✅" : "❗"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-muted">きょうの状態</p>
            <p
              className="mt-1 text-lg leading-snug text-ink"
              data-testid={isExemptDay ? "exempt-message" : undefined}
            >
              {statusBody}
            </p>
            {!isExemptDay && isReopenActive && data.registrationReopen?.endsAt && (
              <p className="mt-2 text-sm text-muted" data-testid="reopen-active-hint">
                ママが受付を再開してくれたよ！
                {formatRegistrationReopenEndsAtLabel(
                  data.registrationReopen.endsAt,
                  today,
                )}
                までクエストできる
              </p>
            )}
            {!isExemptDay &&
              !isReopenActive &&
              !deadline.pastRegistrationCutoff &&
              deadline.beforeRegistrationStart &&
              data.questAction === "start" && (
                <p className="mt-2 text-sm text-muted">
                  {deadline.registrationStartLabel} からクエスト開始できます（
                  {deadline.registrationCutoffLabel} まで受付）
                </p>
              )}
            {!isExemptDay &&
              !isReopenActive &&
              !deadline.pastRegistrationCutoff &&
              (data.questAction === "start" || data.questAction === "retry") &&
              !deadline.beforeRegistrationStart &&
              !deadline.showBonusCountdown &&
              !deadline.showRegistrationCountdown && (
                <p className="mt-2 text-sm text-muted">
                  {deadline.bonusDeadlineLabel}{" "}
                  までに登録して、寝る準備をママが確認できたら +5pt！（
                  {deadline.registrationStartLabel}〜
                  {deadline.registrationCutoffLabel} 受付）
                </p>
              )}
          </div>
        </div>

        {!isExemptDay && deadline.showBonusCountdown && (
          <QuestDeadlineCountdown
            countdownFormatted={deadline.bonusCountdownFormatted}
            bonusDeadlineLabel={deadline.bonusDeadlineLabel}
          />
        )}

        {!isExemptDay && deadline.showRegistrationCountdown && (
          <QuestRegistrationCutoffCountdown
            countdownFormatted={deadline.registrationCountdownFormatted}
            registrationCutoffLabel={deadline.registrationCutoffLabel}
          />
        )}

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            {showQuestStart && canStartQuest && (
              <Button fullWidth onClick={() => navigate("/quest")}>
                ⚔️ クエストをはじめる！
              </Button>
            )}
            {showQuestStart && !canStartQuest && (
              <Button fullWidth disabled>
                ⚔️ クエストをはじめる！
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
            {!isExemptDay && (
              <Button
                fullWidth
                variant="secondary"
                onClick={() => setRulesOpen(true)}
              >
                クエストのルール
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              fullWidth
              variant="navResults"
              onClick={() => navigate("/results")}
              data-testid="nav-results"
            >
              📊 採点結果をみる
            </Button>
            <Button
              fullWidth
              variant="navRewards"
              onClick={() => navigate("/rewards")}
              data-testid="nav-rewards"
            >
              🎁 ポイントを交換する
            </Button>
            <Button
              fullWidth
              variant="navTimer"
              onClick={() => navigate("/timer")}
              data-testid="nav-timer"
            >
              ⏱️ タイマーをスタート
            </Button>
          </div>

          {bedtimeUi === "settable" && (
            <Card className="flex flex-col gap-3 p-6">
              <p className="text-base text-ink">🛏️ 今日の寝る時間を設定する</p>
              <Button
                fullWidth
                variant="secondary"
                onClick={() => setBedtimeModalOpen(true)}
                disabled={registrationMutation.isPending}
                data-testid="bedtime-entry"
              >
                {bedtimeButtonLabel()}
              </Button>
            </Card>
          )}
          {bedtimeUi === "display" && bedtimeHour !== undefined && (
            <Card className="p-6 text-center" data-testid="bedtime-display">
              <p className="text-base">今日の寝る時間: {bedtimeHour}時</p>
            </Card>
          )}
          {bedtimeUi === "locked21" && (
            <Card className="p-6 text-center" data-testid="bedtime-locked">
              <p className="text-base">今日は21時</p>
            </Card>
          )}
        </div>
      </div>

      <QuestRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />

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
