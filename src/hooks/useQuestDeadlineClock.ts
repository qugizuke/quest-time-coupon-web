/**
 * @file useQuestDeadlineClock
 * @description 未着手時のボーナス・登録受付締切カウントダウンを1秒ごとに更新する。
 */
import { useEffect, useState } from "react";
import {
  formatDeadlineCountdown,
  formatQuestBonusDeadlineLabel,
  formatQuestRegistrationCutoffLabel,
  getMsUntilQuestBonusDeadline,
  getMsUntilQuestRegistrationCutoff,
  isPastQuestBonusDeadline,
  isPastQuestRegistrationCutoff,
  isQuestBonusCountdownVisible,
  isQuestRegistrationCutoffCountdownVisible,
} from "@/lib/deadline";

/**
 * 登録締切に関する時刻情報
 */
export interface QuestDeadlineClock {
  /** 20:00〜20:30 のボーナス締切カウントダウンを表示する */
  showBonusCountdown: boolean;
  /** MM:SS 形式のボーナス締切までの残り時間 */
  bonusCountdownFormatted: string;
  /** 20:30〜21:00 の登録受付締切カウントダウンを表示する */
  showRegistrationCountdown: boolean;
  /** MM:SS 形式の登録受付締切までの残り時間 */
  registrationCountdownFormatted: string;
  /** 21:00 を過ぎている（登録受付終了） */
  pastRegistrationCutoff: boolean;
  /** 20:30 を過ぎている（定時ボーナス対象外） */
  pastBonusDeadline: boolean;
  /** 定時ボーナス締切ラベル（例: "20:30"） */
  bonusDeadlineLabel: string;
  /** 登録受付締切ラベル（例: "21:00"） */
  registrationCutoffLabel: string;
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

  const pastRegistrationCutoff = isPastQuestRegistrationCutoff(date, now);
  const pastBonusDeadline = isPastQuestBonusDeadline(date, now);
  const showBonusCountdown = active && isQuestBonusCountdownVisible(date, now);
  const showRegistrationCountdown =
    active && isQuestRegistrationCutoffCountdownVisible(date, now);

  return {
    showBonusCountdown,
    bonusCountdownFormatted: formatDeadlineCountdown(
      getMsUntilQuestBonusDeadline(date, now),
    ),
    showRegistrationCountdown,
    registrationCountdownFormatted: formatDeadlineCountdown(
      getMsUntilQuestRegistrationCutoff(date, now),
    ),
    pastRegistrationCutoff,
    pastBonusDeadline,
    bonusDeadlineLabel: formatQuestBonusDeadlineLabel(),
    registrationCutoffLabel: formatQuestRegistrationCutoffLabel(),
  };
}
