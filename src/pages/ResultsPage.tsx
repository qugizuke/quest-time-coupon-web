/**
 * @file ResultsPage
 * @description 採点結果の一覧・詳細・「確認した」操作。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { postResultsAck } from "@/api/client";
import { queryKeys, resultsQuery } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { formatDateJa } from "@/lib/date";
import { childAnswerLabel } from "@/lib/labels";

/**
 * 採点結果画面
 * @returns {JSX.Element} ページ
 */
export function ResultsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(resultsQuery);
  const { data: daily } = useDailyQuests();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const selected = data?.items.find((i) => i.date === selectedDate);

  const ackMutation = useMutation({
    mutationFn: (date: string) => postResultsAck(date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.results });
      setSelectedDate(null);
    },
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <AppLayout>
        <p className="text-danger">{error instanceof Error ? error.message : "エラー"}</p>
      </AppLayout>
    );
  }

  const items = data?.items ?? [];
  const unacked = items.filter((i) => !i.acknowledged);
  const acked = items.filter((i) => i.acknowledged);

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-app-lg font-bold">採点けっか</h1>
        <Button variant="secondary" onClick={() => navigate("/")}>
          ホーム
        </Button>
      </div>

      {!selected && (
        <div className="flex flex-col gap-2">
          {unacked.length === 0 && acked.length === 0 && (
            <p className="text-muted">まだ けっかは ありません。</p>
          )}
          {[...unacked, ...acked].map((item) => (
            <button
              key={item.date}
              type="button"
              onClick={() => setSelectedDate(item.date)}
              className="flex items-center justify-between rounded-default bg-white px-4 py-3 text-left shadow-sm"
            >
              <span>{formatDateJa(item.date)}</span>
              <span className={item.totalPoints >= 0 ? "text-success" : "text-danger"}>
                {item.totalPoints >= 0 ? "+" : ""}
                {item.totalPoints}ふん
                {!item.acknowledged && "（未確認）"}
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-4">
          <Card
            className={
              selected.totalPoints >= 0
                ? "border-2 border-success"
                : "border-2 border-danger"
            }
          >
            <p className="text-lg font-bold">{formatDateJa(selected.date)}</p>
            <p className="text-app-lg font-bold">
              {selected.totalPoints >= 0 ? "+" : ""}
              {selected.totalPoints} ふん
            </p>
          </Card>

          <ul className="flex flex-col gap-2">
            {selected.details.map((d) => {
              const title =
                daily?.quests.find((q) => q.id === d.questId)?.title ?? d.questId;
              return (
                <li
                  key={d.questId}
                  className={`rounded-default bg-white px-4 py-3 shadow-sm ${
                    d.mismatch ? "border-l-4 border-danger" : ""
                  }`}
                >
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted">
                    こたえ: {childAnswerLabel(d.childAnswer)} / {d.finalPoints}ふん
                  </p>
                </li>
              );
            })}
          </ul>

          {!selected.acknowledged && (
            <Button
              fullWidth
              onClick={() => ackMutation.mutate(selected.date)}
              disabled={ackMutation.isPending}
            >
              確認した
            </Button>
          )}
          <Button variant="secondary" fullWidth onClick={() => setSelectedDate(null)}>
            いちらんにもどる
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
