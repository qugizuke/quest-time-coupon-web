/**
 * @file TimerPage
 * @description クーポン時間のカウントダウンと使用記録。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { postTimerStop } from "@/api/client";
import { homeQuery, queryKeys } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMinutesSeconds, useTimer } from "@/hooks/useTimer";

/**
 * タイマー画面
 * @returns {JSX.Element} ページ
 */
export function TimerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: home } = useQuery(homeQuery);
  const displayBalance = home?.displayBalance ?? 0;
  const { display, start, stop, canStart, isRunning, state } =
    useTimer(displayBalance);

  const stopMutation = useMutation({
    mutationFn: async () => {
      if (!state) throw new Error("TimerPage: タイマーが動いていません");
      const now = Date.now();
      const elapsedSec = Math.floor((now - state.startedAt) / 1000);
      const budgetSec = state.initialBalanceMinutes * 60;
      const usedMinutes = Math.ceil(Math.min(elapsedSec, budgetSec) / 60);
      const overrunMinutes = Math.ceil(Math.max(0, elapsedSec - budgetSec) / 60);
      return postTimerStop({
        sessionId: state.sessionId,
        startedAt: new Date(state.startedAt).toISOString(),
        stoppedAt: new Date(now).toISOString(),
        usedMinutes,
        overrunMinutes,
      });
    },
    onSuccess: () => {
      stop();
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
  });

  return (
    <AppLayout>
      <div className="mb-4 flex justify-between">
        <h1 className="text-app-lg font-bold">タイマー</h1>
        <Button variant="secondary" onClick={() => navigate("/")}>
          ホーム
        </Button>
      </div>

      <Card
        className={`flex min-h-[50vh] flex-col items-center justify-center text-center ${
          display.isPenalty ? "bg-danger/10" : ""
        }`}
      >
        <p className="text-lg">
          {display.isPenalty ? "超過時間" : "残り時間"}
        </p>
        <p className="mt-4 text-app-xl font-bold text-primary">
          {display.isPenalty ? "+" : ""}
          {formatMinutesSeconds(display.seconds)}
        </p>
      </Card>

      {!canStart && !isRunning && displayBalance <= 0 && (
        <p className="mt-4 text-center text-muted">
          残高がないので スタートできません
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {canStart && (
          <Button fullWidth onClick={start}>
            スタート
          </Button>
        )}
        {isRunning && (
          <Button
            fullWidth
            variant="danger"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
          >
            ストップ
          </Button>
        )}
      </div>
      {stopMutation.error && (
        <p className="mt-4 text-danger">
          {stopMutation.error instanceof Error ? stopMutation.error.message : "エラー"}
        </p>
      )}
    </AppLayout>
  );
}
