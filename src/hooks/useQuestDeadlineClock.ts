/**
 * @file useQuestDeadlineClock
 * @description 未着手時の登録締切カウントダウンと、締切超過判定を1秒ごとに更新する。
 */
import { useEffect, useState } from "react";
import {
  formatDeadlineCountdown,
  formatQuestDeadlineLabel,
  getMsUntilQuestDeadline,
  isPastQuestDeadline,
  isQuestDeadlineCountdownVisible,
} from "@/lib/deadline";

/**
 * 登録締切に関する時刻情報
 * @typedef {object} QuestDeadlineClock
 * @property {boolean} showCountdown - 20:00〜20:30 のカウントダウン表示中
 * @property {string} countdownFormatted - MM:SS 形式の残り時間
 * @property {boolean} pastDeadline - 20:30 を過ぎている
 * @property {string} deadlineLabel - 締切ラベル（例: "20:30"）
 */
export interface QuestDeadlineClock {
  /** 20:00〜20:30 のカウントダウンを表示する */
  showCountdown: boolean;
  /** MM:SS 形式の残り時間 */
  countdownFormatted: string;
  /** 20:30 を過ぎている */
  pastDeadline: boolean;
  /** 締切ラベル（例: "20:30"） */
  deadlineLabel: string;
}

/**
 * 未着手時に締切時刻を1秒ごとに更新する
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {boolean} active - 未着手かつクエスト開始可能状態のとき true
 * @returns {QuestDeadlineClock} 締切関連の表示用データ
 */
export function useQuestDeadlineClock(date: string, active: boolean): QuestDeadlineClock {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, date]);

  const pastDeadline = isPastQuestDeadline(date, now);
  const showCountdown = active && isQuestDeadlineCountdownVisible(date, now);
  const remainingMs = getMsUntilQuestDeadline(date, now);

  return {
    showCountdown,
    countdownFormatted: formatDeadlineCountdown(remainingMs),
    pastDeadline,
    deadlineLabel: formatQuestDeadlineLabel(),
  };
}
