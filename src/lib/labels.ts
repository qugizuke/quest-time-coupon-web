/**
 * @file 表示ラベル
 * @description 子ども回答などの日本語表示。
 */
import type { ChildAnswer } from "@/types/api";

/** childAnswer の表示文言 */
export const CHILD_ANSWER_LABELS: Record<ChildAnswer, string> = {
  1: "できた",
  0: "できなかった",
  [-1]: "分からない",
};

/**
 * 子ども回答のラベルを返す
 * @param {ChildAnswer} value - 回答値
 * @returns {string} 表示文言
 */
export function childAnswerLabel(value: ChildAnswer): string {
  return CHILD_ANSWER_LABELS[value];
}

/**
 * 保護者採点（actualDone）のラベルを返す
 * @param {boolean} value - 実際にできたか
 * @returns {string} 表示文言
 */
export function actualDoneLabel(value: boolean): string {
  return value ? "できた" : "できなかった";
}

/**
 * 保護者採点が不要な「分からない」回答か
 * @param {ChildAnswer} value - 回答値
 * @returns {boolean} 分からないなら true
 */
export function isUnknownChildAnswer(value: ChildAnswer): boolean {
  return value === -1;
}
