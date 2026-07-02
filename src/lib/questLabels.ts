/**
 * @file questLabels
 * @description クエスト ID から表示用タイトルを解決する。
 */
import type { DailyQuests } from "@/types/api";

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
 * @returns {string} 表示用タイトル
 */
export function resolveQuestTitle(
  daily: DailyQuests | undefined,
  questId: string,
): string {
  return (
    LEGACY_QUEST_TITLES[questId] ??
    daily?.quests.find((q) => q.id === questId)?.title ??
    questId
  );
}
