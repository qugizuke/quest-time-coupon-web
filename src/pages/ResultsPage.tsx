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
import { actualDoneLabel, childAnswerLabel, isUnknownChildAnswer } from "@/lib/labels";

/** 「分からない」回答がある日の促しメッセージ */
const UNKNOWN_ANSWER_MESSAGE =
  "「分からない」は、その日クエストを意識できていなかった扱いで大きめの減点だよ。次からは思い出して「できた」「できなかった」で答えよう！";

/** 登録タイミング調整の表示ラベル */
function registrationTimingLabel(adjustment: number): string {
  if (adjustment > 0) return `定時登録ボーナス +${adjustment}分`;
  if (adjustment < 0) return `登録締切超過 ${adjustment}分`;
  return "";
}

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
    onSuccess: (_data, date) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.results });

      const current = queryClient.getQueryData<{
        items: Array<{ date: string; acknowledged: boolean }>;
      }>(queryKeys.results);
      const hasOtherUnacked = (current?.items ?? []).some(
        (item) => !item.acknowledged && item.date !== date,
      );

      if (hasOtherUnacked) {
        setSelectedDate(null);
      } else {
        navigate("/");
      }
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
        <h1 className="text-app-lg font-bold">採点結果</h1>
        <Button variant="secondary" onClick={() => navigate("/")}>
          ホーム
        </Button>
      </div>

      {!selected && (
        <div className="flex flex-col gap-2">
          {unacked.length === 0 && acked.length === 0 && (
            <p className="text-muted">まだ結果はありません。</p>
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
                {item.totalPoints}分
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
              {selected.totalPoints} 分
            </p>
          </Card>

          {selected.details.some((d) => isUnknownChildAnswer(d.childAnswer)) && (
            <div className="rounded-default border-2 border-warning bg-warning/20 px-4 py-3 text-base text-gray-900">
              {UNKNOWN_ANSWER_MESSAGE}
            </div>
          )}

          {selected.registrationTimingAdjustment !== 0 && (
            <div
              className={`rounded-default px-4 py-3 text-base ${
                selected.registrationTimingAdjustment > 0
                  ? "border-2 border-success bg-success/10 text-gray-900"
                  : "border-2 border-danger bg-danger/10 text-gray-900"
              }`}
            >
              {registrationTimingLabel(selected.registrationTimingAdjustment)}
            </div>
          )}

          {(selected.adjustments ?? []).length > 0 && (
            <ul className="flex flex-col gap-2">
              {selected.adjustments!.map((adj) => (
                <li
                  key={`${adj.kind}-${adj.code}`}
                  className={`rounded-default px-4 py-3 text-base ${
                    adj.minutes > 0
                      ? "border-2 border-success bg-success/10 text-gray-900"
                      : "border-2 border-danger bg-danger/10 text-gray-900"
                  }`}
                >
                  {adj.label}: {adj.minutes > 0 ? "+" : ""}
                  {adj.minutes}分
                </li>
              ))}
            </ul>
          )}

          {selected.details.length === 0 &&
            selected.registrationTimingAdjustment < 0 && (
              <p className="text-base text-muted">
                この日はクエストを登録しなかったため、減点が記録されています。
              </p>
            )}

          <ul className="flex flex-col gap-2">
            {selected.details.map((d) => {
              const title =
                daily?.quests.find((q) => q.id === d.questId)?.title ?? d.questId;
              const isUnknown = isUnknownChildAnswer(d.childAnswer);
              return (
                <li
                  key={d.questId}
                  className={`rounded-default bg-white px-4 py-3 shadow-sm ${
                    d.mismatch ? "border-l-4 border-danger" : ""
                  }`}
                >
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted">
                    自分の回答: {childAnswerLabel(d.childAnswer)}
                  </p>
                  {isUnknown ? (
                    <p className="text-sm text-muted">ママの採点: なし（自動減点）</p>
                  ) : (
                    <p className="text-sm text-muted">
                      ママの採点: {actualDoneLabel(d.actualDone)}
                    </p>
                  )}
                  <p className="text-sm text-muted">{d.finalPoints}分</p>
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
            一覧に戻る
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
