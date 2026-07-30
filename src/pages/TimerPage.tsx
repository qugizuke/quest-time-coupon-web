/**
 * @file TimerPage
 * @description クーポン時間のカウントダウンと使用記録。
 *   未確認採点結果があるときは Start 不可（screen-design §6.6）。
 *   見た目は Figma kid-timer（大きな数字・紫アクセント）に寄せる（Issue #19）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { postTimerStop } from "@/api/client";
import { homeQuery, queryKeys } from "@/api/queries";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
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
  const timerBlockCount = home?.timerBlockCount ?? 0;
  const blockedByUnacked = timerBlockCount > 0;
  const { display, start, stop, canStart, isRunning, state } =
    useTimer(displayBalance);
  const allowStart = canStart && !blockedByUnacked && (home?.canStartTimer ?? false);

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
    <ChildPageFrame vacationMode={home?.isVacationMode}>
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <p className="text-sm text-timer-ink">⏱️ タイマー</p>
        <h1 className="text-app-lg font-bold text-ink">残り時間をはかろう</h1>
      </div>

      <Card
        className={[
          "flex min-h-[45vh] flex-col items-center justify-center gap-3 border-4 text-center",
          display.isPenalty
            ? "border-danger bg-danger-soft"
            : "border-timer-ink/30 bg-nav-timer/40",
        ].join(" ")}
      >
        <p className="text-lg text-muted">
          {display.isPenalty ? "超過時間" : "残り時間"}
        </p>
        <p
          className={[
            "font-display text-app-timer leading-none",
            display.isPenalty ? "text-danger" : "text-timer-ink",
          ].join(" ")}
        >
          {display.isPenalty ? "+" : ""}
          {formatMinutesSeconds(display.seconds)}
        </p>
        <p className="text-sm text-muted">残高 {displayBalance} 分</p>
      </Card>

      {blockedByUnacked && !isRunning && (
        <div className="mt-6 text-center">
          <p className="rounded-default border-[3px] border-info bg-info-soft px-4 py-3 text-info">
            採点結果を先に確認してね
          </p>
          <Button
            className="mt-4"
            variant="navResults"
            onClick={() => navigate("/results")}
          >
            📊 採点結果を確認する
          </Button>
        </div>
      )}

      {!blockedByUnacked && !canStart && !isRunning && displayBalance <= 0 && (
        <p className="mt-6 text-center text-muted">
          残高がないので スタートできません
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {allowStart && (
          <Button fullWidth onClick={start}>
            スタート
          </Button>
        )}
        {!allowStart && !isRunning && (
          <Button fullWidth disabled>
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
          {stopMutation.error instanceof Error
            ? stopMutation.error.message
            : "エラー"}
        </p>
      )}
    </ChildPageFrame>
  );
}
