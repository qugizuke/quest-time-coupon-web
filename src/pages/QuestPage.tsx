/**
 * @file QuestPage
 * @description 1問ずつクエストに回答する画面。
 */
import { useNavigate } from "react-router-dom";
import type { ChildAnswer } from "@/types/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { useQuestDraft } from "@/hooks/useQuestDraft";
import { todayLocal } from "@/lib/date";

const CHOICES: { value: ChildAnswer; label: string }[] = [
  { value: 1, label: "できた" },
  { value: 0, label: "できなかった" },
  { value: -1, label: "わからない" },
];

/**
 * クエスト回答画面
 * @returns {JSX.Element} ページ
 */
export function QuestPage() {
  const navigate = useNavigate();
  const date = todayLocal();
  const { data: daily, isLoading } = useDailyQuests();
  const { draft, ready, setAnswer, goNext, goPrev, isComplete, currentQuest } =
    useQuestDraft(date, daily);

  if (isLoading || !daily || !ready || !currentQuest) {
    return <LoadingScreen />;
  }

  const currentAnswer = draft.answers.find(
    (a) => a.questId === currentQuest.id,
  )?.childAnswer;

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-6 transition-opacity duration-300">
        <p className="text-center text-muted">
          {draft.index + 1} / {daily.quests.length}
        </p>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-[length:var(--font-size-lg)] font-bold leading-relaxed">
            {currentQuest.title}
          </h1>
          {currentQuest.hint && (
            <p className="text-muted">{currentQuest.hint}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {CHOICES.map((c) => (
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
            disabled={draft.index === 0}
            onClick={goPrev}
          >
            もどる
          </Button>
          {draft.index < daily.quests.length - 1 ? (
            <Button
              className="flex-1"
              disabled={currentAnswer === undefined}
              onClick={goNext}
            >
              つぎへ
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled={!isComplete}
              onClick={() => navigate("/quest/confirm")}
            >
              かくにんへ
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
