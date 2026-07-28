/**
 * @file Firebase Cloud Functions API クライアント
 * @description action ベースの GET/POST。`VITE_API_URL`（`api` 関数のベース URL）へ
 *   `?action=<name>` を付けてリクエストし、`{ ok, data, error }` 形のレスポンスから
 *   `data` を取り出す。`VITE_MOCK_API=true` のときのみモックを返す。
 * @limitation 認証はヘッダー `X-Api-Key` による共有シークレット方式（家庭用のため
 *   Firebase Auth は使わない）。`VITE_*` はビルド時にバンドルへ埋め込まれるため、
 *   キーはブラウザから参照可能である点を前提に運用する。
 */
import type { ApiResponse, ChildAnswer, GradeAdjustment, HomeData } from "@/types/api";
import { mockApi } from "@/api/mock";
import { todayLocal } from "@/lib/date";

/**
 * API のベース URL を解決する
 * @description `VITE_API_URL`（例: `https://<region>-<project>.cloudfunctions.net/api`）のみを使う。
 *   旧 `VITE_GAS_URL` へのフォールバックは廃止（設定漏れを無言で GAS へ流さない）。
 * @returns {string} 末尾スラッシュを除いたベース URL（未設定なら空文字）
 */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured !== "string" || configured.trim() === "") {
    return "";
  }
  return configured.trim().replace(/\/+$/, "");
}

const API_BASE_URL = resolveApiBaseUrl();
const API_KEY = import.meta.env.VITE_API_KEY ?? "";
const USE_MOCK = import.meta.env.VITE_MOCK_API === "true";

/**
 * POST 本体は JSON。Cloud Functions は CORS プリフライト（OPTIONS）に対応するため、
 * GAS 版で必要だった `text/plain` 回避策は不要になった。
 */
const JSON_POST_HEADERS = {
  "Content-Type": "application/json",
} as const;

/**
 * 認証ヘッダーを構築する
 * @description クエリ `?key=` は Cloud Logging のリクエスト URL に残るため使わず、
 *   ヘッダー `X-Api-Key` のみで送る（Functions 側は両対応）。
 * @returns {Record<string, string>} キー未設定なら空オブジェクト
 */
function buildAuthHeaders(): Record<string, string> {
  return API_KEY ? { "X-Api-Key": API_KEY } : {};
}

/**
 * API リクエストを実行する
 * @param {string} action - action 名（例: `home` / `answers`）
 * @param {RequestInit} [init] - fetch オプション
 * @param {Record<string, string>} [query] - 追加クエリ
 * @returns {Promise<T>} レスポンスの data 部分
 * @throws {Error} ベース URL 未設定、通信失敗、JSON 解析失敗、API がエラーを返した場合
 */
async function request<T>(
  action: string,
  init?: RequestInit,
  query?: Record<string, string>,
): Promise<T> {
  if (USE_MOCK) {
    return mockApi<T>(action, init, query);
  }

  if (!API_BASE_URL) {
    throw new Error(
      `request: VITE_API_URL が未設定です（action=${action}）。` +
        "ローカルは .env、本番は apphosting.yaml / Firebase Console を確認してください。",
    );
  }

  const params = new URLSearchParams({ action, ...query });
  const url = `${API_BASE_URL}?${params.toString()}`;
  const response = await fetch(url, {
    redirect: "follow",
    ...init,
    headers: { ...buildAuthHeaders(), ...init?.headers },
  });

  let json: ApiResponse<T>;
  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `request: レスポンスの JSON 解析に失敗しました（action=${action}, ` +
        `status=${response.status} ${response.statusText}, url=${url}）: ${reason}`,
    );
  }

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
  bedtimeHour?: number;
}): Promise<{ submittedAt: string; overwritten: boolean }> {
  return request("answers", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/** POST registrationSetting */
export function postRegistrationSetting(payload: {
  date: string;
  bedtimeHour: number;
}): Promise<{ date: string; bedtimeHour: number }> {
  return request("registrationSetting", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/** GET results 一覧 */
export function fetchResults(): Promise<{
  items: Array<{
    date: string;
    totalPoints: number;
    acknowledged: boolean;
    registrationTimingAdjustment: number;
    registrationTimingReason?: string;
    bedtimePrepPenalty?: number;
    bedtimePrepPenaltyReason?: string;
    adjustments?: Array<{
      kind: "bonus" | "penalty";
      code: string;
      label: string;
      minutes: number;
    }>;
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
    headers: JSON_POST_HEADERS,
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
  adjustments: GradeAdjustment[];
}> {
  return request("grade", { method: "GET" }, { date });
}

/** POST grade */
export function postGrade(payload: {
  date: string;
  grades: { questId: string; actualDone: boolean }[];
  adjustments?: GradeAdjustment[];
}): Promise<{ gradedAt: string }> {
  return request("grade", {
    method: "POST",
    headers: JSON_POST_HEADERS,
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
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}
