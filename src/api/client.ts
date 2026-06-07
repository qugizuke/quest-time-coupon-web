/**
 * @file GAS API クライアント
 * @description action ベースの GET/POST。VITE_MOCK_API=true 時はモックを返す。
 */
import type { ApiResponse, ChildAnswer, HomeData } from "@/types/api";
import { mockApi } from "@/api/mock";
import { todayLocal } from "@/lib/date";

const GAS_URL = import.meta.env.VITE_GAS_URL ?? "";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";
const USE_MOCK = import.meta.env.VITE_MOCK_API === "true";

/**
 * GAS Web App は OPTIONS（CORS プリフライト）非対応のため、
 * JSON 本体でも Content-Type は text/plain にする（Simple Request）。
 */
const GAS_POST_HEADERS = {
  "Content-Type": "text/plain;charset=utf-8",
} as const;

/**
 * API リクエストを実行する
 * @param {string} action - action 名
 * @param {RequestInit} [init] - fetch オプション
 * @param {Record<string, string>} [query] - 追加クエリ
 * @returns {Promise<T>} data 部分
 */
async function request<T>(
  action: string,
  init?: RequestInit,
  query?: Record<string, string>,
): Promise<T> {
  if (USE_MOCK) {
    return mockApi<T>(action, init, query);
  }

  if (!GAS_URL) {
    throw new Error(
      "request: VITE_GAS_URL が未設定です。.env を確認してください。",
    );
  }

  const params = new URLSearchParams({ action, key: API_KEY, ...query });
  const url = `${GAS_URL}?${params.toString()}`;
  const response = await fetch(url, { redirect: "follow", ...init });
  const json = (await response.json()) as ApiResponse<T>;

  if (!json.ok || json.data === undefined) {
    const code = json.error?.code ?? "UNKNOWN";
    const message = json.error?.message ?? "API エラーが発生しました";
    throw new Error(`${code}: ${message}`);
  }

  return json.data;
}

/** GET home */
export function fetchHome(date: string = todayLocal()): Promise<HomeData> {
  return request<HomeData>("home", { method: "GET" }, { date });
}

/** POST answers */
export function postAnswers(payload: {
  date: string;
  answers: { questId: string; childAnswer: ChildAnswer }[];
}): Promise<{ submittedAt: string; overwritten: boolean }> {
  return request("answers", {
    method: "POST",
    headers: GAS_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/** POST results 一覧 */
export function fetchResults(): Promise<{
  items: Array<{
    date: string;
    totalPoints: number;
    acknowledged: boolean;
    registrationTimingAdjustment: number;
    details: Array<{
      questId: string;
      childAnswer: ChildAnswer;
      actualDone: boolean;
      finalPoints: number;
      mismatch: boolean;
    }>;
  }>;
}> {
  return request("results", { method: "GET" });
}

/** POST resultsAck */
export function postResultsAck(date: string): Promise<{
  appliedDelta: number;
  penaltyOffset: number;
  displayBalance: number;
  penaltyMinutes: number;
}> {
  return request("resultsAck", {
    method: "POST",
    headers: GAS_POST_HEADERS,
    body: JSON.stringify({ date }),
  });
}

/** GET gradeDates */
export function fetchGradeDates(): Promise<{
  dates: Array<{
    date: string;
    status: "ungraded" | "graded" | "unanswered";
    ungradedCount: number;
    totalPoints: number | null;
  }>;
}> {
  return request("gradeDates", { method: "GET" });
}

/** GET grade */
export function fetchGrade(date: string): Promise<{
  date: string;
  items: Array<{
    questId: string;
    childAnswer: ChildAnswer;
    actualDone: boolean | null;
  }>;
}> {
  return request("grade", { method: "GET" }, { date });
}

/** POST grade */
export function postGrade(payload: {
  date: string;
  grades: { questId: string; actualDone: boolean }[];
}): Promise<{ gradedAt: string }> {
  return request("grade", {
    method: "POST",
    headers: GAS_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/** POST timerStop */
export function postTimerStop(payload: {
  sessionId: string;
  startedAt: string;
  stoppedAt: string;
  usedMinutes: number;
  overrunMinutes: number;
}): Promise<{ displayBalance: number }> {
  return request("timerStop", {
    method: "POST",
    headers: GAS_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}
