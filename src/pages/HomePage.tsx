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
  clearBedtimeHourDraft,
  setBedtimeHourDraft,
} from "@/lib/sessionStorage";
import type { BedtimeHour } from "@/types/api";

const STATUS_LABEL = {
  unanswered: "今日はまだ答えていません",
  answered_ungraded: "回答済み・採点待ち",
  pending_ack: "結果の確認が必要です",
  completed: "今日は全部終わり！",
} as const;

/** 免除日のお休み文言（仕様正） */
const EXEMPT_MESSAGE = "今日はクエストお休みです（ママが免除日に設定）";

/** 登録受付締切後に未着手だった場合のメッセージ */
function missedStartMessage(cutoffLabel: string): string {
  return `${cutoffLabel}を過ぎたので、今日はクエストを開始できません（-60分）`;
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
      postRegistrationSetting({ date: today, bedtimeHour: hour }),
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
  const weekendEve = data?.isWeekendEve ?? isWeekendEve(today);

  const deadlineActive =
    !isLoading &&
    !!data &&
    !isExemptDay &&
    data.todayStatus === "unanswered" &&
    data.questAction === "start";

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
  });

  const canStartQuest =
    !isExemptDay &&
    data.questAction === "start" &&
    !deadline.pastRegistrationCutoff &&
    !deadline.beforeRegistrationStart &&
    !registrationMutation.isPending;
  const showMissedStartMessage =
    !isExemptDay &&
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
        className="flex flex-1 flex-col justify-center gap-6"
        data-testid="home-page"
        data-home-variant={variant}
      >
        <Card className="flex flex-col items-center justify-center text-center">
          <p className="text-lg text-muted">いま使えるゲーム・YouTubeの時間</p>
          <p className="text-app-xl font-bold text-primary">
            {data.displayBalance}
            <span className="ml-2 text-2xl">分</span>
          </p>
        </Card>

        {data.unacknowledgedCount > 0 && (
          <Banner onClick={() => navigate("/results")}>
            採点結果を確認する（未確認あり）
          </Banner>
        )}

        <Card className="text-center">
          {isExemptDay ? (
            <p className="text-base font-medium" data-testid="exempt-message">
              {EXEMPT_MESSAGE}
            </p>
          ) : (
            <p className="text-base">
              {showMissedStartMessage
                ? missedStartMessage(deadline.registrationCutoffLabel)
                : STATUS_LABEL[data.todayStatus]}
            </p>
          )}
          {!isExemptDay &&
            !deadline.pastRegistrationCutoff &&
            deadline.beforeRegistrationStart &&
            data.questAction === "start" && (
              <p className="mt-2 text-sm text-muted">
                {deadline.registrationStartLabel} からクエスト開始できます（
                {deadline.registrationCutoffLabel} まで受付）
              </p>
            )}
          {!isExemptDay &&
            !deadline.pastRegistrationCutoff &&
            (data.questAction === "start" || data.questAction === "retry") &&
            !deadline.beforeRegistrationStart &&
            !deadline.showBonusCountdown &&
            !deadline.showRegistrationCountdown && (
              <p className="mt-2 text-sm text-muted">
                {deadline.bonusDeadlineLabel}{" "}
                までに登録して、寝る準備をママが確認できたら +15分！（
                {deadline.registrationStartLabel}〜
                {deadline.registrationCutoffLabel} 受付）
              </p>
            )}
        </Card>

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

        <div className="flex flex-col gap-3">
          {showQuestStart && canStartQuest && (
            <Button fullWidth onClick={() => navigate("/quest")}>
              クエスト開始
            </Button>
          )}
          {showQuestStart && !canStartQuest && (
            <Button fullWidth disabled>
              クエスト開始
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
          <Button
            fullWidth
            variant="secondary"
            onClick={() => navigate("/results")}
            data-testid="nav-results"
          >
            採点結果
          </Button>
          <Button
            fullWidth
            variant="secondary"
            onClick={() => navigate("/timer")}
            data-testid="nav-timer"
          >
            タイマー
          </Button>

          {bedtimeUi === "settable" && (
            <Button
              fullWidth
              variant="secondary"
              onClick={() => setBedtimeModalOpen(true)}
              disabled={registrationMutation.isPending}
              data-testid="bedtime-entry"
            >
              {bedtimeButtonLabel()}
            </Button>
          )}
          {bedtimeUi === "display" && bedtimeHour !== undefined && (
            <p
              className="rounded-default border border-border-soft bg-white px-4 py-3 text-center text-base"
              data-testid="bedtime-display"
            >
              今日の寝る時間: {bedtimeHour}時
            </p>
          )}
          {bedtimeUi === "locked21" && (
            <p
              className="rounded-default border border-border-soft bg-white px-4 py-3 text-center text-base"
              data-testid="bedtime-locked"
            >
              今日は21時
            </p>
          )}
        </div>
      </div>

      <QuestRulesDialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        bedtimeHour={bedtimeHour}
        isRestDayEve={weekendEve || isVacationMode}
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
