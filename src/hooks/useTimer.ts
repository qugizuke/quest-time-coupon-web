/**
 * @file useTimer
 * @description タイマー状態の管理・復元・tick。
 */
import { useCallback, useEffect, useState } from "react";
import { useScreenWakeLock } from "@/hooks/useScreenWakeLock";
import {
  clearTimerState,
  getTimerState,
  setTimerState,
  type TimerPhase,
  type TimerState,
} from "@/lib/sessionStorage";

/** 表示用タイマー情報 */
export interface TimerDisplay {
  /** @type {TimerPhase | "idle"} 状態 */
  phase: TimerPhase | "idle";
  /** @type {number} 残りまたは超過秒 */
  seconds: number;
  /** @type {boolean} ペナルティモードか */
  isPenalty: boolean;
}

/**
 * 経過秒から表示を計算する
 * @param {TimerState} state - 保存状態
 * @param {number} now - 現在 ms
 * @returns {TimerDisplay} 表示
 */
function calcDisplay(state: TimerState, now: number): TimerDisplay {
  const elapsedSec = Math.floor((now - state.startedAt) / 1000);
  const budgetSec = state.initialBalanceMinutes * 60;

  if (elapsedSec < budgetSec) {
    return {
      phase: "running",
      seconds: budgetSec - elapsedSec,
      isPenalty: false,
    };
  }

  return {
    phase: "penalty",
    seconds: elapsedSec - budgetSec,
    isPenalty: true,
  };
}

/**
 * タイマーフック
 * @param {number} displayBalance - 表示残高（分）
 */
export function useTimer(displayBalance: number) {
  const [state, setState] = useState<TimerState | null>(() => getTimerState());
  const [display, setDisplay] = useState<TimerDisplay>(() => ({
    phase: "idle",
    seconds: displayBalance * 60,
    isPenalty: false,
  }));

  /** カウントダウン中は画面スリープを防ぐ（Android Chrome 等） */
  useScreenWakeLock(!!state);

  useEffect(() => {
    if (!state) {
      setDisplay({
        phase: "idle",
        seconds: displayBalance * 60,
        isPenalty: false,
      });
      return;
    }

    const tick = () => setDisplay(calcDisplay(state, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [state, displayBalance]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state]);

  /** タイマー開始 */
  const start = useCallback(() => {
    if (displayBalance <= 0) return;
    const next: TimerState = {
      sessionId: crypto.randomUUID(),
      phase: "running",
      startedAt: Date.now(),
      initialBalanceMinutes: displayBalance,
      lastTickAt: Date.now(),
    };
    setTimerState(next);
    setState(next);
  }, [displayBalance]);

  /** タイマー停止・状態クリア */
  const stop = useCallback(() => {
    clearTimerState();
    setState(null);
  }, []);

  return {
    state,
    display,
    start,
    stop,
    canStart: displayBalance > 0 && !state,
    isRunning: !!state,
  };
}

/**
 * 秒を mm:ss 表示にする
 * @param {number} totalSeconds - 秒
 * @returns {string} 表示文字列
 */
export function formatMinutesSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
