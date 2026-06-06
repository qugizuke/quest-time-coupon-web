/**
 * @file QuestConfirmPage
 * @description 回答一覧の最終確認と登録。
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { postAnswers } from "@/api/client";
import { queryKeys } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { todayLocal } from "@/lib/date";
import { childAnswerLabel } from "@/lib/labels";
import { getQuestDraft, clearQuestDraft } from "@/lib/sessionStorage";

/**
 * 最終確認画面
 * @returns {JSX.Element} ページ
 */
export function QuestConfirmPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const date = todayLocal();
  const { data: daily } = useDailyQuests();
  const draft = getQuestDraft(date);

  const mutation = useMutation({
    mutationFn: () => {
      if (!draft || !daily) {
        throw new Error("QuestConfirmPage: 下書きまたは定義がありません");
      }
      const answers = daily.quests.map((q) => {
        const a = draft.answers.find((x) => x.questId === q.id);
        if (a?.childAnswer === undefined) {
          throw new Error(`QuestConfirmPage: 未回答 questId=${q.id}`);
        }
        return { questId: q.id, childAnswer: a.childAnswer };
      });
      return postAnswers({ date, answers });
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
        {daily.quests.map((q) => {
          const a = draft.answers.find((x) => x.questId === q.id);
          return (
            <li
              key={q.id}
              className="flex justify-between rounded-default bg-white px-4 py-3 shadow-sm"
            >
              <span>{q.title}</span>
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
