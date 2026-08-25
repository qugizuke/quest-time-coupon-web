/**
 * @file TimerPage
 * @description クーポン時間のカウントダウンと使用記録。
 *   未確認採点結果があるときは Start 不可（screen-design §6.6）。
 *   負債（負残高＋超過）があるときも Start 不可。
 *   Figma v6 kid-timer に合わせ、タイマーと未確認警告を縦に配置する。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { postTimerStop } from "@/api/client";
import { homeQuery, queryKeys } from "@/api/queries";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMinutesSeconds, useTimer } from "@/hooks/useTimer";
import { calcDebtMinutes, resolveTimerStartBlockReason } from "@/lib/debt";

/**
 * タイマー画面
 * @returns {JSX.Element} ページ
 */
export function TimerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: home } = useQuery(homeQuery);
  const switchMinutes = home?.switchMinutes ?? home?.displayBalance ?? 0;
  const displayBalance = Math.max(0, switchMinutes);
  const penaltyMinutes = home?.penaltyMinutes ?? 0;
  const debtMinutes =
    home?.debtMinutes ?? calcDebtMinutes(switchMinutes, penaltyMinutes);
  const timerBlockCount = home?.timerBlockCount ?? 0;
  const blockedByUnacked = timerBlockCount > 0;
  const { display, start, stop, canStart, isRunning, state } =
    useTimer(displayBalance);
  const allowStart =
    canStart &&
    debtMinutes === 0 &&
    !blockedByUnacked &&
    (home?.canStartTimer ?? false);
  const showsStoredDebt = !isRunning && penaltyMinutes > 0;
  const showsPenalty = display.isPenalty || showsStoredDebt;
  const timerSeconds = showsStoredDebt ? penaltyMinutes * 60 : display.seconds;
  const startBlockReason = resolveTimerStartBlockReason({
    switchMinutes,
    debtMinutes,
    blockedByUnacked,
  });

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

      <div
        className="mx-auto flex w-full max-w-[944px] flex-col items-stretch gap-6"
        data-testid="timer-layout"
      >
        <div
          className="flex w-full flex-col items-stretch gap-5"
          data-testid="timer-main"
        >
          <Card
            className={[
              "flex min-h-[36vh] w-full flex-col items-center justify-center gap-4 border-4 text-center md:min-h-[42vh] md:p-10",
              showsPenalty
                ? "border-danger bg-danger-soft"
                : "border-border bg-surface",
            ].join(" ")}
          >
            <p className="text-lg text-muted">
              {display.isPenalty
                ? "超過時間"
                : showsStoredDebt
                  ? "タイマー超過の負債"
                  : "のこりのゲーム時間"}
            </p>
            <p
              className={[
                "font-display text-app-timer leading-none",
                showsPenalty ? "text-danger" : "text-ink",
              ].join(" ")}
            >
              {display.isPenalty ? "+" : showsStoredDebt ? "-" : ""}
              {formatMinutesSeconds(timerSeconds)}
            </p>
            <p className="text-sm text-muted">
              {showsStoredDebt
                ? `次のごほうび時間から ${penaltyMinutes} 分を相殺します`
                : `残高 ${switchMinutes} 分`}
            </p>
          </Card>

          {!isRunning && startBlockReason && (
            <p
              className="text-center text-muted"
              data-testid="timer-start-block-reason"
            >
              {startBlockReason}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1"
              fullWidth
              onClick={start}
              disabled={!allowStart || isRunning}
            >
              ▶ スタート
            </Button>
            <Button
              className="flex-1"
              fullWidth
              variant="secondary"
              onClick={() => stopMutation.mutate()}
              disabled={!isRunning || stopMutation.isPending}
            >
              ⏸ ストップ
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
          <div
            className="flex w-full flex-col items-stretch gap-4 rounded-default border-[3px] border-danger bg-danger-soft p-6 text-left shadow-[0_10px_12px_0_rgb(255_90_95_/_0.15)]"
            data-testid="timer-unacked-alert"
          >
            <p className="font-bold text-danger">⚠️ ストップ！</p>
            <p className="text-sm text-ink">未確認の採点結果があります。</p>
            <p className="text-sm text-danger">
              「採点結果を先に確認」してから、タイマーを使いましょう。
            </p>
            <Button
              fullWidth
              variant="secondary"
              onClick={() => navigate("/results")}
            >
              👀 結果を確認する
            </Button>
          </div>
        )}
      </div>
    </ChildPageFrame>
  );
}
