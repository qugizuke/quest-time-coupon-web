/**
 * @file 保護者採点 UI 判定
 * @description 肯定回答のみ ⭕️❌ 必須、否定・わからないは表示のみ（wireframes §4.3）。
 */
import type { ChildAnswer } from "@/types/api";
import { isUnknownChildAnswer } from "@/lib/labels";

/**
 * 保護者が ⭕️❌ で採点する必要がある回答か（肯定のみ）
 * @param {ChildAnswer | number | string} childAnswer - 子どもの回答
 * @returns {boolean} 採点 UI が必要なら true
 */
export function isParentGradableAnswer(
  childAnswer: ChildAnswer | number | string,
): boolean {
  return Number(childAnswer) === 1;
}

/**
 * 否定回答（表示のみ・自動未達）か
 * @param {ChildAnswer | number | string} childAnswer - 子どもの回答
 * @returns {boolean} 否定なら true
 */
export function isNegativeChildAnswer(
  childAnswer: ChildAnswer | number | string,
): boolean {
  return Number(childAnswer) === 0;
}

/**
 * 採点確定 payload 用の actualDone を決める
 * @param {ChildAnswer} childAnswer - 子どもの回答
 * @param {boolean | undefined} selected - 保護者の ⭕️❌（肯定時のみ）
 * @returns {boolean | undefined} 送信する actualDone。
 *   否定・わからないは表示のみのため undefined（スキップ）。否定は API/mock 側で自動未達。
 * @throws {Error} 肯定なのに未選択の場合
 */
export function resolveActualDoneForSubmit(
  childAnswer: ChildAnswer,
  selected: boolean | undefined,
): boolean | undefined {
  if (isUnknownChildAnswer(childAnswer)) {
    return undefined;
  }
  if (isNegativeChildAnswer(childAnswer)) {
    return undefined;
  }
  if (selected === undefined) {
    throw new Error(
      "resolveActualDoneForSubmit: 肯定回答が未採点です childAnswer=1",
    );
  }
  return selected;
}
