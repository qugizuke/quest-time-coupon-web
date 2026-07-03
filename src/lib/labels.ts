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

/** はい / いいえ形式の表示文言 */
export const YES_NO_LABELS: Record<0 | 1, string> = {
  1: "はい",
  0: "いいえ",
};

/**
 * 子ども回答のラベルを返す
 * @param {ChildAnswer} value - 回答値
 * @param {"default" | "yesNo"} [mode] - 表示モード
 * @returns {string} 表示文言
 */
export function childAnswerLabel(
  value: ChildAnswer,
  mode: "default" | "yesNo" = "default",
): string {
  if (mode === "yesNo" && value !== -1) {
    return YES_NO_LABELS[value];
  }
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
export function isUnknownChildAnswer(value: ChildAnswer | number | string): boolean {
  return Number(value) === -1;
}
