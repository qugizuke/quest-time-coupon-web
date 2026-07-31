/**
 * @file useDailyQuests
 * @description クエストマスタ（`GET dailyQuests`・契約 §3.16）を取得する。
 *   Issue #33 で静的 `public/quests/daily.json` 配信を廃止し、API（`VITE_MOCK_API=true`
 *   時はモック）経由の取得へ切り替えた。固定10問のため date が同じ間は再取得しない
 *   （`staleTime: Infinity`）。
 */
import { useQuery } from "@tanstack/react-query";
import { dailyQuestsQuery } from "@/api/queries";
import { todayLocal } from "@/lib/date";

/**
 * 日次クエスト定義を取得する
 * @param {string} [date] - 対象日（YYYY-MM-DD）。省略時は当日
 * @returns {ReturnType<typeof useQuery>} クエリ結果
 */
export function useDailyQuests(date: string = todayLocal()) {
  return useQuery(dailyQuestsQuery(date));
}
