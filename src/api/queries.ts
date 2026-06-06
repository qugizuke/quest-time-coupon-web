/**
 * @file TanStack Query キーとフェッチャー
 */
import {
  fetchGrade,
  fetchGradeDates,
  fetchHome,
  fetchResults,
} from "@/api/client";

/** Query キー定数 */
export const queryKeys = {
  home: ["home"] as const,
  results: ["results"] as const,
  gradeDates: ["gradeDates"] as const,
  grade: (date: string) => ["grade", date] as const,
};

export const homeQuery = {
  queryKey: queryKeys.home,
  queryFn: () => fetchHome(),
};

export const resultsQuery = {
  queryKey: queryKeys.results,
  queryFn: fetchResults,
};

export const gradeDatesQuery = {
  queryKey: queryKeys.gradeDates,
  queryFn: fetchGradeDates,
};

/**
 * 採点日クエリ
 * @param {string} date - YYYY-MM-DD
 */
export function gradeQuery(date: string) {
  return {
    queryKey: queryKeys.grade(date),
    queryFn: () => fetchGrade(date),
  };
}
