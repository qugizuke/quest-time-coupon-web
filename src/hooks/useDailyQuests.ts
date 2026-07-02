/**
 * @file useDailyQuests
 * @description public/quests/daily.json を読み込む。
 */
import { useQuery } from "@tanstack/react-query";
import type { DailyQuests } from "@/types/api";

/**
 * 日次クエスト定義を取得する
 * @returns {ReturnType<typeof useQuery<DailyQuests>>} クエリ結果
 */
export function useDailyQuests() {
  return useQuery({
    queryKey: ["dailyQuests"],
    queryFn: async (): Promise<DailyQuests> => {
      const res = await fetch(`${import.meta.env.BASE_URL}quests/daily.json`);
      if (!res.ok) {
        throw new Error(
          `useDailyQuests: daily.json の取得に失敗 status=${res.status}`,
        );
      }
      return res.json() as Promise<DailyQuests>;
    },
    staleTime: Infinity,
  });
}
