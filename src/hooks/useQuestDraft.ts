/**
 * @file useQuestDraft
 * @description クエスト回答下書きの読み書きとインデックス管理。
 */
import { useCallback, useEffect, useState } from "react";
import type { ChildAnswer, DailyQuests, DraftAnswer } from "@/types/api";
import { getQuestDraft, setQuestDraft } from "@/lib/sessionStorage";

/**
 * クエスト定義と下書きから answers 配列を構築する
 * @param {DailyQuests} daily - クエスト定義
 * @param {{ answers: DraftAnswer[]; index: number } | null} saved - Session Storage
 */
function buildAnswers(
  daily: DailyQuests,
  saved: { answers: DraftAnswer[]; index: number } | null,
): { answers: DraftAnswer[]; index: number } {
  const savedMap = new Map(
    (saved?.answers ?? []).map((a) => [a.questId, a.childAnswer]),
  );
  return {
    answers: daily.quests.map((q) => ({
      questId: q.id,
      childAnswer: savedMap.get(q.id),
    })),
    index: saved?.index ?? 0,
  };
}

/**
 * クエスト下書きフック
 * @param {string} date - 対象日
 * @param {DailyQuests | undefined} daily - クエスト定義
 */
export function useQuestDraft(date: string, daily: DailyQuests | undefined) {
  const [draft, setDraft] = useState<{ answers: DraftAnswer[]; index: number }>({
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
    (next: { answers: DraftAnswer[]; index: number }) => {
      setDraft(next);
      setQuestDraft(date, next);
    },
    [date],
  );

  /**
   * 現在問の回答を更新
   * @param {ChildAnswer} childAnswer - 回答
   */
  const setAnswer = useCallback(
    (childAnswer: ChildAnswer) => {
      if (!daily) return;
      const quest = daily.quests[draft.index];
      if (!quest) return;
      const answers = draft.answers.map((a) =>
        a.questId === quest.id ? { ...a, childAnswer } : a,
      );
      persist({ ...draft, answers });
    },
    [daily, draft, persist],
  );

  /** 次の問へ */
  const goNext = useCallback(() => {
    if (!daily) return;
    const nextIndex = Math.min(draft.index + 1, daily.quests.length - 1);
    persist({ ...draft, index: nextIndex });
  }, [daily, draft, persist]);

  /** 前の問へ */
  const goPrev = useCallback(() => {
    const nextIndex = Math.max(draft.index - 1, 0);
    persist({ ...draft, index: nextIndex });
  }, [draft, persist]);

  /** 全問回答済みか */
  const isComplete =
    !!daily &&
    daily.quests.every((q) => {
      const a = draft.answers.find((x) => x.questId === q.id);
      return a?.childAnswer !== undefined;
    });

  return {
    draft,
    ready,
    setAnswer,
    goNext,
    goPrev,
    isComplete,
    currentQuest: daily?.quests[draft.index],
  };
}
