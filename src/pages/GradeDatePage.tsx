/**
 * @file GradeDatePage
 * @description 保護者が1日分を採点する画面。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { postGrade } from "@/api/client";
import { gradeQuery, queryKeys } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { formatDateJa } from "@/lib/date";
import { childAnswerLabel, isUnknownChildAnswer } from "@/lib/labels";

/**
 * 採点画面
 * @returns {JSX.Element} ページ
 */
export function GradeDatePage() {
  const { date = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: gradeData, isLoading } = useQuery(gradeQuery(date));
  const { data: daily } = useDailyQuests();
  const [grades, setGrades] = useState<Record<string, boolean>>({});

  const gradableItems = useMemo(
    () => gradeData?.items.filter((item) => !isUnknownChildAnswer(item.childAnswer)) ?? [],
    [gradeData],
  );

  const isComplete = gradableItems.every(
    (item) => grades[item.questId] !== undefined,
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (!gradeData) throw new Error("GradeDatePage: データがありません");
      const payload = gradableItems.map((item) => {
        const actualDone = grades[item.questId];
        if (actualDone === undefined) {
          throw new Error(`GradeDatePage: 未採点 questId=${item.questId}`);
        }
        return { questId: item.questId, actualDone };
      });
      return postGrade({ date, grades: payload });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gradeDates });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      navigate("/grade");
    },
  });

  if (isLoading || !gradeData) {
    return <LoadingScreen />;
  }

  return (
    <AppLayout>
      <h1 className="mb-2 text-app-lg font-bold">
        採点 {formatDateJa(date)}
      </h1>
      <p className="mb-4 text-sm text-muted">
        実際にできた / できなかった を選んでください。
        「分からない」と答えたものは採点不要です（虚偽の次に重い減点が自動でつきます）。
      </p>

      <ul className="flex flex-col gap-4">
        {gradeData.items.map((item) => {
          const title =
            daily?.quests.find((q) => q.id === item.questId)?.title ?? item.questId;
          const isUnknown = isUnknownChildAnswer(item.childAnswer);
          const selected = grades[item.questId];
          return (
            <li key={item.questId} className="rounded-default bg-white p-4 shadow-sm">
              <p className="font-medium">{title}</p>
              <p className="mb-3 text-sm text-muted">
                子どもの回答: {childAnswerLabel(item.childAnswer)}
              </p>
              {isUnknown ? (
                <p className="text-sm text-warning">
                  採点不要（自動で減点）
                </p>
              ) : (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant={selected === true ? "primary" : "secondary"}
                    onClick={() =>
                      setGrades((g) => ({ ...g, [item.questId]: true }))
                    }
                  >
                    実際にできた
                  </Button>
                  <Button
                    className="flex-1"
                    variant={selected === false ? "primary" : "secondary"}
                    onClick={() =>
                      setGrades((g) => ({ ...g, [item.questId]: false }))
                    }
                  >
                    実際にできなかった
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {mutation.error && (
        <p className="mt-4 text-danger">
          {mutation.error instanceof Error ? mutation.error.message : "エラー"}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <Button
          fullWidth
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !isComplete}
        >
          採点を確定
        </Button>
        <Button variant="secondary" fullWidth onClick={() => navigate("/grade")}>
          一覧に戻る
        </Button>
      </div>
    </AppLayout>
  );
}
