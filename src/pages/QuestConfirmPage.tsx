/**
 * @file QuestConfirmPage
 * @description 回答一覧の最終確認と登録。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { postAnswers } from "@/api/client";
import { homeQuery, queryKeys } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { todayLocal } from "@/lib/date";
import { childAnswerLabel } from "@/lib/labels";
import { getQuestDraft, clearQuestDraft, getBedtimeHourDraft } from "@/lib/sessionStorage";
import { isWeekendEve } from "@/lib/deadline";
import type { BedtimeHour, ChildAnswer, DailyQuests, QuestDefinition, QuestDraft } from "@/types/api";

/**
 * API に送信する回答を下書きから構築する
 * @param {DailyQuests} daily - クエスト定義
 * @param {QuestDraft} draft - 下書き
 * @returns {{ questId: string; childAnswer: ChildAnswer }[]} 送信対象回答
 */
function buildSubmittableAnswers(
  daily: DailyQuests,
  draft: QuestDraft,
): { questId: string; childAnswer: ChildAnswer }[] {
  return daily.quests.flatMap((q) => {
    const a = draft.answers.find((x) => x.questId === q.id);
    if (q.conditional?.persistGateAnswer === false) {
      const gateAnswer = draft.gateAnswers?.[q.id];
      if (gateAnswer === undefined) {
        throw new Error(`QuestConfirmPage: ゲート未回答 questId=${q.id}`);
      }
      if (gateAnswer !== q.conditional.followUpWhen) {
        return [];
      }
      if (a?.childAnswer === undefined) {
        throw new Error(`QuestConfirmPage: 追問未回答 questId=${q.id}`);
      }
      return [{ questId: q.id, childAnswer: a.childAnswer }];
    }
    if (a?.childAnswer !== undefined) {
      return [{ questId: q.id, childAnswer: a.childAnswer }];
    }
    throw new Error(`QuestConfirmPage: 未回答 questId=${q.id}`);
  });
}

/**
 * 確認画面に表示するタイトルを返す
 * @param {QuestDefinition} quest - クエスト定義
 * @returns {string} 表示タイトル
 */
function confirmationTitle(quest: QuestDefinition): string {
  return quest.conditional?.followUpTitle ?? quest.title;
}

/**
 * 最終確認画面
 * @returns {JSX.Element} ページ
 */
export function QuestConfirmPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const date = todayLocal();
  const { data: daily } = useDailyQuests();
  const { data: homeData } = useQuery(homeQuery);
  const draft = getQuestDraft(date);

  const mutation = useMutation({
    mutationFn: () => {
      if (!draft || !daily) {
        throw new Error("QuestConfirmPage: 下書きまたは定義がありません");
      }
      const answers = buildSubmittableAnswers(daily, draft);
      const bedtimeHour: BedtimeHour | undefined = isWeekendEve(date)
        ? (getBedtimeHourDraft(date) ?? homeData?.bedtimeHour ?? 21)
        : undefined;
      return postAnswers({ date, answers, bedtimeHour });
    },
    onSuccess: () => {
      clearQuestDraft(date);
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      navigate("/");
    },
  });

  if (!draft || !daily) {
    return (
      <AppLayout>
        <p className="text-danger">下書きが見つかりません。</p>
        <Button className="mt-4" onClick={() => navigate("/quest")}>
          クエストに戻る
        </Button>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-app-lg font-bold">
        最後の確認
      </h1>
      <ul className="mb-6 flex flex-col gap-2">
        {daily.quests.flatMap((q) => {
          const a = draft.answers.find((x) => x.questId === q.id);
          if (q.conditional?.persistGateAnswer === false) {
            const gateAnswer = draft.gateAnswers?.[q.id];
            if (
              gateAnswer !== q.conditional.followUpWhen ||
              a?.childAnswer === undefined
            ) {
              return [];
            }
          }
          return (
            <li
              key={q.id}
              className="flex justify-between rounded-default bg-white px-4 py-3 shadow-sm"
            >
              <span>{confirmationTitle(q)}</span>
              <span className="font-medium">
                {a?.childAnswer !== undefined
                  ? childAnswerLabel(a.childAnswer)
                  : "—"}
              </span>
            </li>
          );
        })}
      </ul>
      {mutation.error && (
        <p className="mb-4 text-danger">
          {mutation.error instanceof Error ? mutation.error.message : "登録失敗"}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button fullWidth onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          登録する
        </Button>
        <Button fullWidth variant="secondary" onClick={() => navigate("/quest")}>
          修正する
        </Button>
      </div>
    </AppLayout>
  );
}
