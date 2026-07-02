/**
 * @file 定時登録ボーナス判定
 * @description 寝る準備クエストの回答に応じた定時ボーナス適用可否を判定する。
 */
import type { ChildAnswer } from "@/types/api";

/** @type {string} 定時ボーナス対象外となる寝る準備クエスト ID */
export const BEDTIME_PREP_QUEST_ID = "bedtime-prep";

/**
 * 寝る準備クエストの回答が定時ボーナスをブロックするか
 * @param {{ questId: string; childAnswer: ChildAnswer }[] | undefined} answers - 当日の回答一覧
 * @returns {boolean} 「できなかった」(0) なら true
 */
export function isBedtimePrepBlockingRegistrationBonus(
  answers: { questId: string; childAnswer: ChildAnswer }[] | undefined,
): boolean {
  const row = answers?.find((a) => a.questId === BEDTIME_PREP_QUEST_ID);
  if (!row) return false;
  return row.childAnswer === 0;
}
