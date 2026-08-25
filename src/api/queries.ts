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
  fetchPointExchangeRequests,
  fetchQuestExemptions,
  fetchResults,
  fetchRewardVoucherRefundRequests,
} from "@/api/client";
import type { PointExchangeStatus, RewardVoucherRefundStatus } from "@/types/api";

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
  pointExchangeRequests: (month: string, status?: PointExchangeStatus) =>
    ["pointExchangeRequests", month, status ?? "all"] as const,
  rewardVoucherRefundRequests: (
    month: string,
    status?: RewardVoucherRefundStatus,
  ) => ["rewardVoucherRefundRequests", month, status ?? "all"] as const,
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

/**
 * ポイント交換の月次クエリ（契約 §3.11.1・子ども `/rewards` と保護者 `/parent/rewards` 共用）
 * @param {string} month - YYYY-MM
 * @param {PointExchangeStatus} [status] - 状態フィルタ（未指定は全状態）
 */
export function pointExchangeRequestsQuery(
  month: string,
  status?: PointExchangeStatus,
) {
  return {
    queryKey: queryKeys.pointExchangeRequests(month, status),
    queryFn: () => fetchPointExchangeRequests({ month, status }),
  };
}

/**
 * 報酬チケット戻し申請の月次クエリ（契約 §3.11.3・子ども `/rewards` と保護者 `/parent/rewards` 共用）
 * @param {string} month - YYYY-MM
 * @param {RewardVoucherRefundStatus} [status] - 状態フィルタ（未指定は全状態）
 */
export function rewardVoucherRefundRequestsQuery(
  month: string,
  status?: RewardVoucherRefundStatus,
) {
  return {
    queryKey: queryKeys.rewardVoucherRefundRequests(month, status),
    queryFn: () => fetchRewardVoucherRefundRequests({ month, status }),
  };
}
