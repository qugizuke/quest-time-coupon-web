/**
 * @file useQuestDeadlineClock
 * @description 未着手時のボーナス・登録受付締切カウントダウンを1秒ごとに更新する（v5: bedtime 対応）。
 */
import { useEffect, useState } from "react";
import {
  formatDeadlineCountdown,
  formatQuestBonusDeadlineLabel,
  formatQuestRegistrationCutoffLabel,
  formatQuestRegistrationStartLabel,
  getMsUntilQuestBonusDeadline,
  getMsUntilQuestRegistrationCutoff,
  isBeforeQuestRegistrationStart,
  isPastQuestBonusDeadline,
  isPastQuestRegistrationCutoff,
  isQuestBonusCountdownVisible,
  isQuestRegistrationCutoffCountdownVisible,
} from "@/lib/deadline";

/**
 * 登録締切に関する時刻情報
 */
export interface QuestDeadlineClock {
  /** ボーナス締切カウントダウンを表示する */
  showBonusCountdown: boolean;
  /** MM:SS 形式のボーナス締切までの残り時間 */
  bonusCountdownFormatted: string;
  /** 登録受付締切カウントダウンを表示する */
  showRegistrationCountdown: boolean;
  /** MM:SS 形式の登録受付締切までの残り時間 */
  registrationCountdownFormatted: string;
  /** 登録受付締切を過ぎている */
  pastRegistrationCutoff: boolean;
  /** 登録受付開始前 */
  beforeRegistrationStart: boolean;
  /** 定時ボーナス締切を過ぎている */
  pastBonusDeadline: boolean;
  /** 定時ボーナス締切ラベル（例: "20:30"） */
  bonusDeadlineLabel: string;
  /** 登録受付開始ラベル（例: "20:00"） */
  registrationStartLabel: string;
  /** 登録受付締切ラベル（例: "21:00"） */
  registrationCutoffLabel: string;
}

/**
 * 未着手時に締切時刻を1秒ごとに更新する
 * @param {string} date - 対象日 YYYY-MM-DD
 * @param {boolean} active - 未着手かつクエスト開始可能状態のとき true
 * @param {number} [bedtimeHour] - 就寝時刻（時）
 * @returns {QuestDeadlineClock} 締切関連の表示用データ
 */
export function useQuestDeadlineClock(
  date: string,
  active: boolean,
  bedtimeHour?: number,
): QuestDeadlineClock {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [active, date, bedtimeHour]);

  const pastRegistrationCutoff = isPastQuestRegistrationCutoff(date, now, bedtimeHour);
  const beforeRegistrationStart = isBeforeQuestRegistrationStart(date, now, bedtimeHour);
  const pastBonusDeadline = isPastQuestBonusDeadline(date, now, bedtimeHour);
  const showBonusCountdown =
    active && isQuestBonusCountdownVisible(date, now, bedtimeHour);
  const showRegistrationCountdown =
    active && isQuestRegistrationCutoffCountdownVisible(date, now, bedtimeHour);

  return {
    showBonusCountdown,
    bonusCountdownFormatted: formatDeadlineCountdown(
      getMsUntilQuestBonusDeadline(date, now, bedtimeHour),
    ),
    showRegistrationCountdown,
    registrationCountdownFormatted: formatDeadlineCountdown(
      getMsUntilQuestRegistrationCutoff(date, now, bedtimeHour),
    ),
    pastRegistrationCutoff,
    beforeRegistrationStart,
    pastBonusDeadline,
    bonusDeadlineLabel: formatQuestBonusDeadlineLabel(date, bedtimeHour),
    registrationStartLabel: formatQuestRegistrationStartLabel(date, bedtimeHour),
    registrationCutoffLabel: formatQuestRegistrationCutoffLabel(date, bedtimeHour),
  };
}
