/**
 * @file questLabels
 * @description クエスト ID から表示用タイトルを解決する。
 *   #6（宿題）・#7（キッズケータイ）は専用3択クエスト（api-tobe-f-contract.md §4.1・
 *   tobe-ui-wireframes.md §3.3）。childAnswer=-1 が「わからない」ではなく
 *   「評価スキップ（点0・ストリーク非接触）」を意味するため questId で判定する。
 */
import type { DailyQuests } from "@/types/api";

/** 宿題クエスト ID（専用3択・#6） */
export const HOMEWORK_QUEST_ID = "homework-done-today";

/** キッズケータイクエスト ID（専用3択・#7・Issue #29 で eat-neatly から差し替え） */
export const PHONE_QUEST_ID = "phone-non-emergency-unused";

/**
 * childAnswer=-1 が「評価スキップ」（宿題なし／キッズケータイ不要）を意味する
 * 専用3択クエストか判定する
 * @param {string} questId - クエスト ID
 * @returns {boolean} スキップ扱いのクエストなら true
 */
export function isSkipAnswerQuest(questId: string): boolean {
  return questId === HOMEWORK_QUEST_ID || questId === PHONE_QUEST_ID;
}

const LEGACY_QUEST_TITLES: Record<string, string> = {
  "sleep-on-time": "決められた時間に寝る",
  "brush-teeth-am": "朝の歯みがきをした",
  "wash-hands-gargle": "帰宅後、手洗いとうがいをした",
  homework: "宿題をテキパキとやった",
  "brush-teeth-pm": "夜の歯みがきをした",
  "save-water": "水とお湯の無駄づかいをしない",
  "listen-to-mama": "ママの話をちゃんときく",
};

/**
 * クエスト ID の表示タイトルを取得する
 * @param {DailyQuests | undefined} daily - 現在のクエスト定義
 * @param {string} questId - クエスト ID
 * @param {{ preferFollowUpTitle?: boolean }} [options] - 表示オプション
 * @returns {string} 表示用タイトル
 */
export function resolveQuestTitle(
  daily: DailyQuests | undefined,
  questId: string,
  options: { preferFollowUpTitle?: boolean } = {},
): string {
  const quest = daily?.quests.find((q) => q.id === questId);
  if (options.preferFollowUpTitle && quest?.conditional?.followUpTitle) {
    return quest.conditional.followUpTitle;
  }
  return (
    LEGACY_QUEST_TITLES[questId] ??
    quest?.title ??
    questId
  );
}
