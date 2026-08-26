/**
 * @file TimerPage
 * @description クーポン時間のカウントダウンと使用記録。
 *   未確認採点結果があるときは Start 不可（screen-design §6.6）。
 *   負債（負残高＋超過）があるときも Start 不可。
 *   Figma v6 kid-timer に合わせ、タイマーと未確認警告を縦に配置する。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { postSwitchTicketRedeem, postTimerStop } from "@/api/client";
import { homeQuery, queryKeys } from "@/api/queries";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMinutesSeconds, useTimer } from "@/hooks/useTimer";
import { calcDebtMinutes, resolveTimerStartBlockReason } from "@/lib/debt";
import { SWITCH_TICKET_MINUTES } from "@/lib/rewardVouchers";
import type { SwitchTicketCatalogItemId } from "@/types/api";

/** タイマー画面で消費できる Switch券の表示順（契約 §3.11.2・Issue #45） */
const SWITCH_TICKET_ITEMS: readonly SwitchTicketCatalogItemId[] = [
  "switch-30",
  "switch-60",
];

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

  const redeemMutation = useMutation({
    mutationFn: (catalogItemId: SwitchTicketCatalogItemId) =>
      postSwitchTicketRedeem({ catalogItemId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
  });

  const rewardVouchers = home?.rewardVouchers;
  const isBlocked = blockedByUnacked && !isRunning;
  const timerHeading = display.isPenalty
    ? "⏲️ 超過時間"
    : isRunning
      ? "⏲️ あんぜんにプレイ中..."
      : isBlocked
        ? "タイマーはロックされています"
        : showsStoredDebt
          ? "タイマー超過の負債"
          : "のこりのゲーム時間";

  return (
    <ChildPageFrame vacationMode={home?.isVacationMode}>
      <div
        className="flex w-full flex-col items-stretch gap-6 pt-2"
        data-testid="timer-layout"
      >
        {isBlocked && (
          <Banner
            onClick={() => navigate("/results")}
            data-testid="timer-unacked-banner"
          >
            ⚠️ 未確認の採点結果があります！
          </Banner>
        )}

        <div
          className={[
            "flex w-full flex-col items-stretch",
            isBlocked ? "gap-4" : "gap-6",
          ].join(" ")}
          data-testid="timer-main"
        >
          <h1 className="text-sm font-normal leading-5 text-muted">
            🎮 ゲーム・YouTube共通時間
          </h1>

          {isBlocked && (
            <p
              className="rounded-[12px] bg-danger-soft p-4 text-center text-base leading-6 text-danger"
              data-testid="timer-unacked-alert"
            >
              さいてん結果をかくにんしてから、タイマーをつかいましょう。
            </p>
          )}

          <Card
            className={[
              "flex min-h-[220px] w-full flex-col items-center justify-center gap-4 border-4 p-6 text-center shadow-[var(--shadow-card)] sm:p-10",
              isBlocked
                ? "border-border-soft bg-bg-parent opacity-50 shadow-none"
                : showsPenalty
                  ? "border-danger bg-danger-soft"
                  : isRunning
                    ? "border-success bg-success-soft"
                    : "border-border bg-surface-warm",
            ].join(" ")}
          >
            <p
              className={[
                "text-lg leading-7",
                showsPenalty
                  ? "text-danger-shadow"
                  : isRunning
                    ? "text-success-deep"
                    : "text-muted",
              ].join(" ")}
            >
              {timerHeading}
            </p>
            <p
              className={[
                "font-display text-[64px] leading-none sm:text-app-timer",
                showsPenalty
                  ? "text-danger-shadow"
                  : isBlocked
                    ? "text-muted"
                    : "text-ink",
              ].join(" ")}
            >
              {display.isPenalty ? "+" : showsStoredDebt ? "-" : ""}
              {formatMinutesSeconds(timerSeconds)}
            </p>
          </Card>

          {display.isPenalty && (
            <p className="text-center text-[13px] text-danger-shadow">
              超過した時間はペナルティとして記録されます
            </p>
          )}

          {showsStoredDebt && (
            <p className="text-center text-sm text-danger-shadow">
              次のごほうび時間から {penaltyMinutes} 分を相殺します
            </p>
          )}

          {!isRunning && !isBlocked && startBlockReason && (
            <p
              className="text-center text-muted"
              data-testid="timer-start-block-reason"
            >
              {startBlockReason}
            </p>
          )}

          {isBlocked ? (
            <Button
              fullWidth
              variant="danger"
              className="font-normal"
              onClick={() => navigate("/results")}
            >
              👀 結果をかくにんする
            </Button>
          ) : isRunning ? (
            <Button
              variant="secondary"
              className="mx-auto w-full max-w-[280px] font-normal"
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              ⏸ いちじていし
            </Button>
          ) : (
            <Button
              fullWidth
              className="font-normal"
              onClick={start}
              disabled={!allowStart}
            >
              ▶ スタートする！
            </Button>
          )}

          {stopMutation.error && (
            <p className="text-danger">
              {stopMutation.error instanceof Error
                ? stopMutation.error.message
                : "エラー"}
            </p>
          )}
        </div>

        {isRunning ? (
          <div
            className="flex w-full items-center justify-center rounded-[12px] bg-bg-parent p-4 text-center text-xs leading-4 text-muted"
            data-testid="timer-running-lock"
          >
            🔒 タイマー動作中はチケットを使えません。一時停止してください。
          </div>
        ) : rewardVouchers ? (
          <Card
            className={[
              "flex flex-col gap-4 border-border-soft p-6 shadow-none",
              isBlocked ? "bg-bg-parent opacity-60" : "bg-surface",
            ].join(" ")}
            data-testid="switch-ticket-redeem-section"
          >
            <h2 className="text-base font-normal leading-6 text-ink">
              🎟️ Switchの時間をもらう（のりもの・おてつだい券）
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SWITCH_TICKET_ITEMS.map((catalogItemId) => {
                const count = rewardVouchers[catalogItemId];
                return (
                  <li
                    key={catalogItemId}
                    className={[
                      "flex flex-col items-center gap-3 rounded-default border p-4",
                      !isBlocked && count > 0
                        ? "border-primary bg-surface-warm"
                        : "border-border-soft bg-bg-parent",
                    ].join(" ")}
                    data-testid={`switch-ticket-row-${catalogItemId}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base text-ink">
                        ⏱️ {SWITCH_TICKET_MINUTES[catalogItemId]}分券
                      </span>
                      <span
                        className={[
                          "rounded-pill px-2 py-0.5 text-xs leading-4 text-white",
                          !isBlocked && count > 0 ? "bg-primary" : "bg-muted",
                        ].join(" ")}
                      >
                        ×{count}枚
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      fullWidth
                      className="px-4 text-sm font-normal"
                      disabled={
                        isBlocked || count < 1 || redeemMutation.isPending
                      }
                      onClick={() => redeemMutation.mutate(catalogItemId)}
                      data-testid={`switch-ticket-redeem-${catalogItemId}`}
                    >
                      {count > 0
                        ? `${SWITCH_TICKET_MINUTES[catalogItemId]}分券を使う`
                        : "券がありません"}
                    </Button>
                  </li>
                );
              })}
            </ul>
            {redeemMutation.error && (
              <p className="text-sm text-danger" role="alert">
                {redeemMutation.error instanceof Error
                  ? redeemMutation.error.message
                  : "券の消費に失敗しました"}
              </p>
            )}
          </Card>
        ) : null}
      </div>
    </ChildPageFrame>
  );
}
