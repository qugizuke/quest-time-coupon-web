/**
 * @file useQuestDraft
 * @description クエスト回答下書きの読み書きとインデックス管理（宿題条件分岐対応）。
 */
import { useCallback, useEffect, useState } from "react";
import type { ChildAnswer, DailyQuests, DraftAnswer, QuestDefinition } from "@/types/api";
import { getQuestDraft, setQuestDraft } from "@/lib/sessionStorage";

/**
 * クエスト定義と下書きから answers 配列を構築する
 * @param {DailyQuests} daily - クエスト定義
 * @param {{ answers: DraftAnswer[]; index: number; followUpQuestId?: string } | null} saved - Session Storage
 */
function buildAnswers(
  daily: DailyQuests,
  saved: { answers: DraftAnswer[]; index: number; followUpQuestId?: string } | null,
): { answers: DraftAnswer[]; index: number; followUpQuestId?: string } {
  const savedMap = new Map(
    (saved?.answers ?? []).map((a) => [a.questId, a.childAnswer]),
  );
  return {
    answers: daily.quests.map((q) => ({
      questId: q.id,
      childAnswer: savedMap.get(q.id),
    })),
    index: saved?.index ?? 0,
    followUpQuestId: saved?.followUpQuestId,
  };
}

/**
 * 追問が必要かどうか
 * @param {QuestDefinition} quest - クエスト定義
 * @param {ChildAnswer | undefined} answer - 親の回答
 * @returns {boolean} 追問が必要なら true
 */
function needsFollowUp(quest: QuestDefinition, answer: ChildAnswer | undefined): boolean {
  if (!quest.conditional || answer === undefined) return false;
  return answer === quest.conditional.followUpWhen;
}

/**
 * クエスト下書きフック
 * @param {string} date - 対象日
 * @param {DailyQuests | undefined} daily - クエスト定義
 */
export function useQuestDraft(date: string, daily: DailyQuests | undefined) {
  const [draft, setDraft] = useState<{
    answers: DraftAnswer[];
    index: number;
    followUpQuestId?: string;
  }>({
    answers: [],
    index: 0,
  });
  const [ready, setReady] = useState(false);

  /** daily 読み込み後に下書きを初期化する */
  useEffect(() => {
    if (!daily) {
      setReady(false);
      return;
    }
    const saved = getQuestDraft(date);
    setDraft(buildAnswers(daily, saved));
    setReady(true);
  }, [date, daily]);

  const persist = useCallback(
    (next: { answers: DraftAnswer[]; index: number; followUpQuestId?: string }) => {
      setDraft(next);
      setQuestDraft(date, next);
    },
    [date],
  );

  const currentQuest = daily?.quests[draft.index];
  const isFollowUpMode =
    !!draft.followUpQuestId &&
    currentQuest?.id === draft.followUpQuestId &&
    !!currentQuest.conditional;

  /**
   * 現在問の回答を更新
   * @param {ChildAnswer} childAnswer - 回答
   */
  const setAnswer = useCallback(
    (childAnswer: ChildAnswer) => {
      if (!daily || !currentQuest) return;

      if (isFollowUpMode) {
        const answers = draft.answers.map((a) =>
          a.questId === currentQuest.id ? { ...a, childAnswer } : a,
        );
        persist({ ...draft, answers, followUpQuestId: undefined });
        return;
      }

      const answers = draft.answers.map((a) =>
        a.questId === currentQuest.id ? { ...a, childAnswer } : a,
      );

      if (needsFollowUp(currentQuest, childAnswer)) {
        persist({
          ...draft,
          answers: answers.map((a) =>
            a.questId === currentQuest.id ? { ...a, childAnswer: undefined } : a,
          ),
          followUpQuestId: currentQuest.id,
        });
        return;
      }

      persist({ ...draft, answers, followUpQuestId: undefined });
    },
    [daily, currentQuest, draft, isFollowUpMode, persist],
  );

  /** 次の問へ */
  const goNext = useCallback(() => {
    if (!daily) return;
    const nextIndex = Math.min(draft.index + 1, daily.quests.length - 1);
    persist({ ...draft, index: nextIndex, followUpQuestId: undefined });
  }, [daily, draft, persist]);

  /** 前の問へ */
  const goPrev = useCallback(() => {
    if (!daily) return;
    const quest = daily.quests[draft.index];
    if (draft.followUpQuestId === quest?.id) {
      persist({ ...draft, followUpQuestId: undefined });
      return;
    }
    const nextIndex = Math.max(draft.index - 1, 0);
    persist({ ...draft, index: nextIndex, followUpQuestId: undefined });
  }, [daily, draft, persist]);

  /** 全問回答済みか */
  const isComplete =
    !!daily &&
    daily.quests.every((q) => {
      const a = draft.answers.find((x) => x.questId === q.id);
      return a?.childAnswer !== undefined;
    }) &&
    !draft.followUpQuestId;

  const displayQuest = isFollowUpMode && currentQuest.conditional
    ? {
        ...currentQuest,
        title: currentQuest.conditional.followUpTitle,
        hint: undefined,
      }
    : currentQuest;

  const currentAnswer = draft.answers.find(
    (a) => a.questId === currentQuest?.id,
  )?.childAnswer;

  return {
    draft,
    ready,
    setAnswer,
    goNext,
    goPrev,
    isComplete,
    currentQuest: displayQuest,
    isFollowUpMode,
    canGoNext:
      !isFollowUpMode &&
      currentAnswer !== undefined &&
      draft.index < (daily?.quests.length ?? 1) - 1,
    canConfirm:
      isComplete ||
      (draft.index === (daily?.quests.length ?? 1) - 1 &&
        currentAnswer !== undefined &&
        !draft.followUpQuestId),
  };
}
