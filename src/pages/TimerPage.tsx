/**
 * @file TimerPage
 * @description クーポン時間のカウントダウンと使用記録。
 *   未確認採点結果があるときは Start 不可（screen-design §6.6）。
 *   見た目は Figma kid-timer（横向き2カラム・紫アクセント）に寄せる（Issue #19）。
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

      {/*
        Figma kid-timer: 横向きは左にタイマー＋操作、右に未確認アラート。
        狭幅のみ縦積みに戻す。
      */}
      <div
        className={[
          "flex flex-col gap-4",
          "md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.9fr)] md:items-start md:gap-6",
        ].join(" ")}
      >
        <div className="flex flex-col gap-4">
          <Card
            className={[
              "flex min-h-[36vh] flex-col items-center justify-center gap-3 border-4 text-center md:min-h-[42vh]",
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

          {!blockedByUnacked && !canStart && !isRunning && displayBalance <= 0 && (
            <p className="text-center text-muted md:text-left">
              残高がないので スタートできません
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1"
              fullWidth
              onClick={start}
              disabled={!allowStart || isRunning}
            >
              スタート
            </Button>
            <Button
              className="flex-1"
              fullWidth
              variant="danger"
              onClick={() => stopMutation.mutate()}
              disabled={!isRunning || stopMutation.isPending}
            >
              ストップ
            </Button>
          </div>
          {stopMutation.error && (
            <p className="text-danger">
              {stopMutation.error instanceof Error
                ? stopMutation.error.message
                : "エラー"}
            </p>
          )}
        </div>

        {blockedByUnacked && !isRunning && (
          <div className="flex flex-col gap-4 text-center md:pt-2">
            <p className="rounded-default border-[3px] border-info bg-info-soft px-4 py-3 text-info">
              採点結果を先に確認してね
            </p>
            <Button
              variant="navResults"
              onClick={() => navigate("/results")}
            >
              📊 採点結果を確認する
            </Button>
          </div>
        )}
      </div>
    </ChildPageFrame>
  );
}
