/**
 * @file 表示ラベル
 * @description 子ども回答などの日本語表示。
 */
import type { ChildAnswer } from "@/types/api";

/** childAnswer の表示文言 */
export const CHILD_ANSWER_LABELS: Record<ChildAnswer, string> = {
  1: "できた",
  0: "できなかった",
  [-1]: "わからない",
};

/**
 * 子ども回答のラベルを返す
 * @param {ChildAnswer} value - 回答値
 * @returns {string} 表示文言
 */
export function childAnswerLabel(value: ChildAnswer): string {
  return CHILD_ANSWER_LABELS[value];
}
