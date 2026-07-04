/**
 * @file HomePage
 * @description 子ども向けホーム。残高・状態・各画面への導線（v5: 寝る時間選択対応）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuestDeadlineCountdown } from "@/components/QuestDeadlineCountdown";
import { QuestRegistrationCutoffCountdown } from "@/components/QuestRegistrationCutoffCountdown";
import { QuestRulesDialog } from "@/components/QuestRulesDialog";
import { homeQuery, queryKeys } from "@/api/queries";
import { postRegistrationSetting } from "@/api/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useQuestDeadlineClock } from "@/hooks/useQuestDeadlineClock";
import { isWeekendEve } from "@/lib/deadline";
import { todayLocal } from "@/lib/date";
import { clearBedtimeHourDraft, setBedtimeHourDraft } from "@/lib/sessionStorage";
import type { BedtimeHour } from "@/types/api";

const STATUS_LABEL = {
  unanswered: "今日はまだ答えていません",
  answered_ungraded: "回答済み・採点待ち",
  pending_ack: "結果の確認が必要です",
  completed: "今日は全部終わり！",
} as const;

const BEDTIME_OPTIONS: { value: BedtimeHour; label: string }[] = [
  { value: 21, label: "21:00" },
  { value: 22, label: "22:00" },
  { value: 23, label: "23:00" },
];

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
  const { data, isLoading, error } = useQuery(homeQuery);
  const today = todayLocal();
  const showBedtimePicker = isWeekendEve(today);
  const [bedtimeHour, setBedtimeHour] = useState<BedtimeHour | undefined>(undefined);
  const [confirmedBedtimeHour, setConfirmedBedtimeHour] = useState<BedtimeHour | undefined>(
    undefined,
  );

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

  const deadlineActive =
    !isLoading &&
    !!data &&
    data.todayStatus === "unanswered" &&
    data.questAction === "start";

  const deadline = useQuestDeadlineClock(today, deadlineActive, bedtimeHour);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !data) {
    return (
      <AppLayout>
        <p className="text-danger">
          エラー: {error instanceof Error ? error.message : "不明"}
        </p>
      </AppLayout>
    );
  }

  const canStartQuest =
    data.questAction === "start" &&
    !deadline.pastRegistrationCutoff &&
    !deadline.beforeRegistrationStart &&
    !registrationMutation.isPending;
  const showMissedStartMessage =
    deadline.pastRegistrationCutoff &&
    data.todayStatus === "unanswered" &&
    data.questAction === "start";

  /**
   * 寝る時間を選択してサーバに保存する
   * @param {BedtimeHour} hour - 就寝時刻（時）
   */
  function handleBedtimeChange(hour: BedtimeHour) {
    setBedtimeHour(hour);
    registrationMutation.mutate(hour);
  }

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col justify-center gap-6">
        <Card className="flex flex-col items-center justify-center text-center">
          <p className="text-lg text-muted">残り時間</p>
          <p className="text-app-xl font-bold text-primary">
            {data.displayBalance}
            <span className="ml-2 text-2xl">分</span>
          </p>
          <p className="mt-4 text-base">
            {showMissedStartMessage
              ? missedStartMessage(deadline.registrationCutoffLabel)
              : STATUS_LABEL[data.todayStatus]}
          </p>
          {!deadline.pastRegistrationCutoff &&
            deadline.beforeRegistrationStart &&
            data.questAction === "start" && (
              <p className="mt-2 text-sm text-muted">
                {deadline.registrationStartLabel} からクエスト開始できます（
                {deadline.registrationCutoffLabel} まで受付）
              </p>
            )}
          {!deadline.pastRegistrationCutoff &&
            (data.questAction === "start" || data.questAction === "retry") &&
            !deadline.beforeRegistrationStart &&
            !deadline.showBonusCountdown &&
            !deadline.showRegistrationCountdown && (
              <p className="mt-2 text-sm text-muted">
                {deadline.bonusDeadlineLabel} までに登録して、寝る準備をママが確認できたら +15分！（{deadline.registrationStartLabel}〜
                {deadline.registrationCutoffLabel} 受付）
              </p>
            )}
        </Card>

        {showBedtimePicker && data.todayStatus === "unanswered" && (
          <Card>
            <p className="mb-3 text-center font-medium">今日の寝る時間</p>
            <div className="flex gap-2">
              {BEDTIME_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  className="flex-1"
                  variant={bedtimeHour === opt.value ? "primary" : "secondary"}
                  onClick={() => handleBedtimeChange(opt.value)}
                  disabled={registrationMutation.isPending}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {deadline.showBonusCountdown && (
          <QuestDeadlineCountdown
            countdownFormatted={deadline.bonusCountdownFormatted}
            bonusDeadlineLabel={deadline.bonusDeadlineLabel}
          />
        )}

        {deadline.showRegistrationCountdown && (
          <QuestRegistrationCutoffCountdown
            countdownFormatted={deadline.registrationCountdownFormatted}
            registrationCutoffLabel={deadline.registrationCutoffLabel}
          />
        )}

        {data.unacknowledgedCount > 0 && (
          <Banner onClick={() => navigate("/results")}>
            採点結果が {data.unacknowledgedCount} 日 待っています。タップして
            確認してね
          </Banner>
        )}

        <div className="flex flex-col gap-3">
          {data.questAction === "start" && canStartQuest && (
            <Button fullWidth onClick={() => navigate("/quest")}>
              クエスト開始
            </Button>
          )}
          {data.questAction === "start" && !canStartQuest && (
            <Button fullWidth disabled>
              クエスト開始
            </Button>
          )}
          {data.questAction === "retry" && (
            <Button fullWidth variant="secondary" onClick={() => navigate("/quest")}>
              やり直す
            </Button>
          )}
          <Button fullWidth variant="secondary" onClick={() => setRulesOpen(true)}>
            クエストのルール
          </Button>
          <Button fullWidth variant="secondary" onClick={() => navigate("/results")}>
            採点結果
          </Button>
          <Button fullWidth variant="secondary" onClick={() => navigate("/timer")}>
            タイマー
          </Button>
        </div>
      </div>

      <QuestRulesDialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        bedtimeHour={bedtimeHour}
        isRestDayEve={showBedtimePicker}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 mx-auto flex max-w-lg justify-end px-4">
        <Button
          className="pointer-events-auto min-h-10 px-4 py-2 text-base opacity-70"
          variant="secondary"
          onClick={() => navigate("/grade/login")}
          aria-label="採点画面へ"
        >
          採点
        </Button>
      </div>
    </AppLayout>
  );
}
