/**
 * @file 表示ラベル
 * @description 子ども回答などの日本語表示。
 *   #6（宿題）・#7（キッズケータイ）は専用3択のため、questId を渡すと
 *   childAnswer=-1 の文言を「専用スキップ表記」に差し替える
 *   （api-tobe-f-contract.md §4.1・tobe-ui-wireframes.md §3.3）。
 *   ただし履歴では gradingMode を渡して「評価スキップ」時のみ特殊文言とし、
 *   旧履歴の -1（分からない）は通常文言「分からない」を返す。
 */
import type { ChildAnswer, GradingMode } from "@/types/api";
import { HOMEWORK_QUEST_ID, PHONE_QUEST_ID } from "@/lib/questLabels";

/** childAnswer の表示文言（通常3択） */
export const CHILD_ANSWER_LABELS: Record<ChildAnswer, string> = {
  1: "できた",
  0: "できなかった",
  [-1]: "分からない",
};

/** 専用3択クエストの childAnswer 表示文言（questId ごと） */
const SPECIAL_CHILD_ANSWER_LABELS: Record<string, Record<ChildAnswer, string>> = {
  [HOMEWORK_QUEST_ID]: {
    1: "テキパキできた",
    0: "テキパキできなかった",
    [-1]: "今日は宿題がなかった",
  },
  [PHONE_QUEST_ID]: {
    1: "できた",
    0: "できなかった",
    [-1]: "今日はキッズケータイを使う必要がなかった",
  },
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
 * @param {string} [questId] - クエスト ID（専用3択の文言差し替えに使用）
 * @param {GradingMode} [gradingMode] - 採点モード（履歴で -1 のスキップ/分からない区別に使用）
 * @returns {string} 表示文言
 */
export function childAnswerLabel(
  value: ChildAnswer,
  mode: "default" | "yesNo" = "default",
  questId?: string,
  gradingMode?: GradingMode,
): string {
  if (questId && SPECIAL_CHILD_ANSWER_LABELS[questId]) {
    // -1 の特殊文言は「評価スキップ（gradingMode === "skip"）」時のみ適用する。
    // gradingMode が渡された場合、skip 以外は旧履歴の「分からない」扱い。
    // gradingMode 未渡し（当日下書きなど）は専用スキップ文言を維持する。
    if (value === -1 && gradingMode !== undefined && gradingMode !== "skip") {
      return CHILD_ANSWER_LABELS[value];
    }
    return SPECIAL_CHILD_ANSWER_LABELS[questId][value];
  }
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
