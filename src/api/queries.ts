/**
 * @file TanStack Query キーとフェッチャー
 * @description 契約 action 向けの queryKey / queryFn（Issue #20）。
 */
import {
  fetchDailyQuests,
  fetchGrade,
  fetchGradeDates,
  fetchHome,
  fetchLongVacation,
  fetchParentHome,
  fetchQuestExemptions,
  fetchResults,
} from "@/api/client";

/** Query キー定数 */
export const queryKeys = {
  home: ["home"] as const,
  parentHome: ["parentHome"] as const,
  results: ["results"] as const,
  gradeDates: ["gradeDates"] as const,
  grade: (date: string) => ["grade", date] as const,
  longVacation: ["longVacation"] as const,
  questExemptions: ["questExemptions"] as const,
  dailyQuests: (date: string) => ["dailyQuests", date] as const,
};

export const homeQuery = {
  queryKey: queryKeys.home,
  queryFn: () => fetchHome(),
};

export const parentHomeQuery = {
  queryKey: queryKeys.parentHome,
  queryFn: () => fetchParentHome(),
};

export const resultsQuery = {
  queryKey: queryKeys.results,
  queryFn: () => fetchResults(),
};

export const gradeDatesQuery = {
  queryKey: queryKeys.gradeDates,
  queryFn: () => fetchGradeDates(),
};

export const longVacationQuery = {
  queryKey: queryKeys.longVacation,
  queryFn: fetchLongVacation,
};

export const questExemptionsQuery = {
  queryKey: queryKeys.questExemptions,
  queryFn: fetchQuestExemptions,
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

/**
 * クエストマスタクエリ（契約 §3.16・固定10問のため staleTime は Infinity）
 * @param {string} date - YYYY-MM-DD
 */
export function dailyQuestsQuery(date: string) {
  return {
    queryKey: queryKeys.dailyQuests(date),
    queryFn: () => fetchDailyQuests(date),
    staleTime: Infinity,
  };
}
