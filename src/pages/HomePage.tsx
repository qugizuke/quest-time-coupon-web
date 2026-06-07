/**
 * @file HomePage
 * @description 子ども向けホーム。残高・状態・各画面への導線。
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuestDeadlineCountdown } from "@/components/QuestDeadlineCountdown";
import { QuestRulesDialog } from "@/components/QuestRulesDialog";
import { homeQuery } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useQuestDeadlineClock } from "@/hooks/useQuestDeadlineClock";
import { todayLocal } from "@/lib/date";

const STATUS_LABEL = {
  unanswered: "今日はまだ答えていません",
  answered_ungraded: "回答済み・採点待ち",
  pending_ack: "結果の確認が必要です",
  completed: "今日は全部終わり！",
} as const;

/** 締切後に未着手だった場合のメッセージ */
function missedStartMessage(deadlineLabel: string): string {
  return `${deadlineLabel}を過ぎたので、今日はクエストを開始できません（-30分）`;
}

/**
 * ホーム画面
 * @returns {JSX.Element} ページ
 */
export function HomePage() {
  const navigate = useNavigate();
  const [rulesOpen, setRulesOpen] = useState(false);
  const { data, isLoading, error } = useQuery(homeQuery);
  const today = todayLocal();

  const deadlineActive =
    !isLoading &&
    !!data &&
    data.todayStatus === "unanswered" &&
    data.questAction === "start";

  const deadline = useQuestDeadlineClock(today, deadlineActive);

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

  const canStartQuest = data.questAction === "start" && !deadline.pastDeadline;
  const showMissedStartMessage =
    deadline.pastDeadline &&
    data.todayStatus === "unanswered" &&
    data.questAction === "start";

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
              ? missedStartMessage(deadline.deadlineLabel)
              : STATUS_LABEL[data.todayStatus]}
          </p>
          {!deadline.pastDeadline &&
            (data.questAction === "start" || data.questAction === "retry") &&
            !deadline.showCountdown && (
              <p className="mt-2 text-sm text-muted">
                {deadline.deadlineLabel} までにクエストを始めて登録しよう（定時登録で +15分！）
              </p>
            )}
        </Card>

        {deadline.showCountdown && (
          <QuestDeadlineCountdown
            countdownFormatted={deadline.countdownFormatted}
            deadlineLabel={deadline.deadlineLabel}
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

      <QuestRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />

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
