/**
 * @file 定時登録ボーナス判定
 * @description 寝る準備クエストの子ども回答と保護者採点から、定時ボーナスと虚偽ペナルティを判定する。
 */
import type { ChildAnswer } from "@/types/api";

/** @type {string} 定時ボーナス対象外となる寝る準備クエスト ID */
export const BEDTIME_PREP_QUEST_ID = "bedtime-prep";

/** @type {number} 寝る準備の虚偽ペナルティ（分） */
export const BEDTIME_PREP_FALSE_CLAIM_PENALTY = -30;

/** 寝る準備の判定材料 */
export interface BedtimePrepEvaluation {
  /** @type {ChildAnswer} 子どもの寝る準備回答 */
  childAnswer: ChildAnswer;
  /** @type {boolean} 保護者の寝る準備判定 */
  actualDone: boolean;
}

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

/**
 * 定時登録ボーナスを付与できる寝る準備判定か
 * @param {BedtimePrepEvaluation | undefined} evaluation - 寝る準備の判定材料
 * @returns {boolean} 子ども・保護者ともに「できた」なら true
 */
export function canApplyBedtimePrepRegistrationBonus(
  evaluation: BedtimePrepEvaluation | undefined,
): boolean {
  return !!evaluation && evaluation.childAnswer === 1 && evaluation.actualDone;
}

/**
 * 寝る準備の虚偽ペナルティを計算する
 * @param {BedtimePrepEvaluation | undefined} evaluation - 寝る準備の判定材料
 * @returns {number} ペナルティ分数
 */
export function calcBedtimePrepFalseClaimPenalty(
  evaluation: BedtimePrepEvaluation | undefined,
): number {
  if (!evaluation) return 0;
  return evaluation.childAnswer === 1 && !evaluation.actualDone
    ? BEDTIME_PREP_FALSE_CLAIM_PENALTY
    : 0;
}
