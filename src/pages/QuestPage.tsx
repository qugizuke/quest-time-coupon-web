/**
 * @file QuestPage
 * @description 1問ずつクエストに回答する画面（宿題条件分岐対応）。
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { ChildAnswer, QuestDefinition } from "@/types/api";
import { homeQuery } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { useQuestDraft } from "@/hooks/useQuestDraft";
import { todayLocal } from "@/lib/date";
import {
  isBeforeQuestRegistrationStart,
  isPastQuestRegistrationCutoff,
} from "@/lib/deadline";
import { ensureQuestSessionStarted, getBedtimeHourDraft } from "@/lib/sessionStorage";

const CHOICES: { value: ChildAnswer; label: string }[] = [
  { value: 1, label: "できた" },
  { value: 0, label: "できなかった" },
  { value: -1, label: "分からない" },
];

/** 2択クエスト用の選択肢 */
const BINARY_CHOICES: { value: ChildAnswer; label: string }[] = [
  { value: 1, label: "できた" },
  { value: 0, label: "できなかった" },
];

/** はい / いいえゲート用の選択肢 */
const YES_NO_CHOICES: { value: ChildAnswer; label: string }[] = [
  { value: 1, label: "はい" },
  { value: 0, label: "いいえ" },
];

/**
 * 現在のクエストに表示する選択肢を返す
 * @param {QuestDefinition} quest - 表示中のクエスト
 * @param {boolean} isFollowUpMode - 追問表示中か
 * @returns {{ value: ChildAnswer; label: string }[]} 選択肢一覧
 */
function answerChoicesFor(
  quest: QuestDefinition,
  isFollowUpMode: boolean,
): { value: ChildAnswer; label: string }[] {
  if (isFollowUpMode) return CHOICES;
  if (quest.conditional?.gateAnswerMode === "yesNo") return YES_NO_CHOICES;
  if (quest.answerMode === "binary") return BINARY_CHOICES;
  return CHOICES;
}

/**
 * クエスト回答画面
 * @returns {JSX.Element} ページ
 */
export function QuestPage() {
  const navigate = useNavigate();
  const date = todayLocal();
  const { data: homeData } = useQuery(homeQuery);
  const { data: daily, isLoading } = useDailyQuests();
  const {
    draft,
    ready,
    setAnswer,
    goNext,
    goPrev,
    isComplete,
    currentQuest,
    currentAnswer,
    isFollowUpMode,
    canGoNext,
    canConfirm,
  } = useQuestDraft(date, daily);

  useEffect(() => {
    ensureQuestSessionStarted(date);
  }, [date]);

  useEffect(() => {
    if (!homeData) return;
    if (homeData.questAction === "none") {
      navigate("/", { replace: true });
      return;
    }
    if (homeData.questAction !== "start") return;
    const bedtimeHour =
      homeData.bedtimeHour ?? getBedtimeHourDraft(date) ?? 21;
    const now = new Date();
    if (
      isBeforeQuestRegistrationStart(date, now, bedtimeHour) ||
      isPastQuestRegistrationCutoff(date, now, bedtimeHour)
    ) {
      navigate("/", { replace: true });
    }
  }, [date, homeData, navigate]);

  if (isLoading || !daily || !ready || !currentQuest) {
    return <LoadingScreen />;
  }

  const choices = answerChoicesFor(currentQuest, isFollowUpMode);

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-6 transition-opacity duration-300">
        <p className="text-center text-muted">
          {isFollowUpMode ? "追問" : `${draft.index + 1} / ${daily.quests.length}`}
        </p>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-app-lg font-bold leading-relaxed">
            {currentQuest.title}
          </h1>
          {currentQuest.hint && (
            <p className="text-muted">{currentQuest.hint}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {choices.map((c) => (
            <Button
              key={c.value}
              fullWidth
              variant={currentAnswer === c.value ? "primary" : "secondary"}
              onClick={() => setAnswer(c.value)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-3">
          <Button
            className="flex-1"
            variant="secondary"
            disabled={draft.index === 0 && !isFollowUpMode}
            onClick={goPrev}
          >
            戻る
          </Button>
          {canGoNext ? (
            <Button className="flex-1" onClick={goNext}>
              次へ
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled={!canConfirm && !isComplete}
              onClick={() => navigate("/quest/confirm")}
            >
              確認へ
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
