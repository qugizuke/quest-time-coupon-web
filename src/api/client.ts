/**
 * @file Firebase Cloud Functions API クライアント
 * @description action ベースの GET/POST。正本: docs `api-tobe-f-contract.md`（Issue #20）。
 *   `VITE_MOCK_API=true` のときのみモック。認証は `X-Api-Key`（共有シークレット）。
 *   保護者パスワードはフロントのみで扱い、actor は認証代用にしない。
 * @limitation `VITE_*` はビルド時埋め込みのためブラウザから参照可能。
 */
import type {
  ApiResponse,
  ChildAnswer,
  DailyQuests,
  GradeAdjustment,
  GradeData,
  GradeDateItem,
  HomeData,
  LongVacationData,
  ParentHomeData,
  PenaltyTicketIssueResult,
  QuestExemptionsData,
  RegistrationActor,
  ResultItem,
  WakeTime,
} from "@/types/api";
import { mockApi } from "@/api/mock";
import { normalizeBalanceDebtFields } from "@/lib/balanceDebt";
import { todayLocal } from "@/lib/date";

/**
 * API のベース URL を解決する
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

const JSON_POST_HEADERS = {
  "Content-Type": "application/json",
} as const;

/**
 * 認証ヘッダーを構築する
 * @returns {Record<string, string>} キー未設定なら空オブジェクト
 */
function buildAuthHeaders(): Record<string, string> {
  return API_KEY ? { "X-Api-Key": API_KEY } : {};
}

/**
 * home レスポンスに UI 互換エイリアスと負債フィールドを付与する
 * @param {HomeData} data - サーバ／モックの home data
 * @returns {HomeData} エイリアス付き
 */
function withHomeAliases(data: HomeData): HomeData {
  const balance = normalizeBalanceDebtFields(data);
  return {
    ...data,
    ...balance,
    isExemptDay: data.isExemptToday,
    isVacationMode: data.isLongVacation,
    isWeekendEve: data.isWeekendEve ?? false,
    timerBlockCount: data.timerBlockCount ?? 0,
    registrationReopen: data.registrationReopen ?? null,
    wakePromiseYesterday: data.wakePromiseYesterday ?? null,
    bedtimeEditableUntil: data.bedtimeEditableUntil ?? null,
    questDeadlineAt: data.questDeadlineAt ?? null,
    bonusDeadlineAt: data.bonusDeadlineAt ?? null,
  };
}

/**
 * parentHome に負債フィールドを付与する
 * @param {ParentHomeData} data - サーバ／モックの parentHome
 * @returns {ParentHomeData} 正規化済み
 */
function withParentHomeBalance(data: ParentHomeData): ParentHomeData {
  return {
    ...data,
    ...normalizeBalanceDebtFields(data),
  };
}

/**
 * API リクエストを実行する
 * @param {string} action - action 名
 * @param {RequestInit} [init] - fetch オプション
 * @param {Record<string, string>} [query] - 追加クエリ
 * @returns {Promise<T>} レスポンスの data 部分
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

/**
 * from/to クエリを組み立てる（片方だけは送らない）
 * @param {string} [from] - 開始日
 * @param {string} [to] - 終了日
 * @returns {Record<string, string> | undefined} クエリ
 */
function dateRangeQuery(
  from?: string,
  to?: string,
): Record<string, string> | undefined {
  if (from === undefined && to === undefined) return undefined;
  if (from === undefined || to === undefined) {
    throw new Error(
      "dateRangeQuery: from と to は両方同時に指定してください（契約 §2.3.1）",
    );
  }
  return { from, to };
}

/** GET home */
export async function fetchHome(
  date: string = todayLocal(),
): Promise<HomeData> {
  const data = await request<HomeData>("home", { method: "GET" }, { date });
  return withHomeAliases(data);
}

/** GET dailyQuests（契約 §3.16。静的 daily.json 廃止・Issue #33） */
export function fetchDailyQuests(date: string = todayLocal()): Promise<DailyQuests> {
  return request<DailyQuests>("dailyQuests", { method: "GET" }, { date });
}

/** GET parentHome */
export async function fetchParentHome(
  date: string = todayLocal(),
): Promise<ParentHomeData> {
  const data = await request<ParentHomeData>(
    "parentHome",
    { method: "GET" },
    { date },
  );
  return withParentHomeBalance(data);
}

/** POST answers */
export function postAnswers(payload: {
  date: string;
  answers: { questId: string; childAnswer: ChildAnswer }[];
  bedtimeHour?: number;
  wakePromise?: { wakeTime: WakeTime };
  /** @deprecated wakePromise を使う */
  wakeUpTime?: WakeTime;
}): Promise<{ submittedAt: string; overwritten: boolean }> {
  const { wakeUpTime, wakePromise, ...rest } = payload;
  const body = {
    ...rest,
    wakePromise:
      wakePromise ??
      (wakeUpTime !== undefined ? { wakeTime: wakeUpTime } : undefined),
  };
  return request("answers", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(body),
  });
}

/** POST registrationSetting（actor 必須） */
export function postRegistrationSetting(payload: {
  date: string;
  bedtimeHour: number;
  actor: RegistrationActor;
}): Promise<{
  date: string;
  bedtimeHour: number;
  actor: RegistrationActor;
  setAt: string;
}> {
  return request("registrationSetting", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/** POST registrationReopen（endsAt はオフセット付き ISO） */
export function postRegistrationReopen(payload: {
  date: string;
  endsAt: string;
}): Promise<{
  date: string;
  endsAt: string;
  setAt: string;
  used: boolean;
}> {
  return request("registrationReopen", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/** GET results 一覧 */
export function fetchResults(opts?: {
  from?: string;
  to?: string;
}): Promise<{ items: ResultItem[] }> {
  return request("results", { method: "GET" }, dateRangeQuery(opts?.from, opts?.to));
}

/** POST resultsAck */
export function postResultsAck(date: string): Promise<{
  appliedDelta: number;
  penaltyOffset: number;
  balanceMinutes: number;
  displayBalance: number;
  penaltyMinutes: number;
  debtMinutes: number;
  issuablePenaltyTicketCount: number;
}> {
  return request("resultsAck", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify({ date }),
  });
}

/** GET gradeDates */
export function fetchGradeDates(opts?: {
  from?: string;
  to?: string;
}): Promise<{ dates: GradeDateItem[] }> {
  return request(
    "gradeDates",
    { method: "GET" },
    dateRangeQuery(opts?.from, opts?.to),
  );
}

/** GET grade */
export async function fetchGrade(date: string): Promise<GradeData> {
  const data = await request<GradeData>("grade", { method: "GET" }, { date });
  return {
    ...data,
    isGraded: data.alreadyGraded ?? data.isGraded ?? false,
    isRejected: data.reasonCode === "grade_rejected" || data.isRejected === true,
    withinBonusDeadline:
      data.withinBonusWindow ?? data.withinBonusDeadline ?? false,
    withinBonusWindow:
      data.withinBonusWindow ?? data.withinBonusDeadline ?? false,
    alreadyGraded: data.alreadyGraded ?? data.isGraded ?? false,
  };
}

/** POST grade */
export function postGrade(payload: {
  date: string;
  grades: { questId: string; actualDone: boolean }[];
  adjustments?: GradeAdjustment[];
}): Promise<{ gradedAt: string; totalPoints: number; reasonCode: "normal" }> {
  return request("grade", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/** POST gradeReject */
export function postGradeReject(date: string): Promise<{
  reasonCode: "grade_rejected";
  totalPoints: number;
  gradedAt: string;
}> {
  return request("gradeReject", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify({ date }),
  });
}

/** GET longVacation */
export function fetchLongVacation(): Promise<LongVacationData> {
  return request("longVacation", { method: "GET" });
}

/** POST longVacation */
export function postLongVacation(payload: {
  startDate: string;
  endDate: string;
}): Promise<LongVacationData> {
  return request("longVacation", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/** GET questExemptions */
export function fetchQuestExemptions(): Promise<QuestExemptionsData> {
  return request("questExemptions", { method: "GET" });
}

/** POST questExemptions */
export function postQuestExemptions(
  payload:
    | { op: "add"; startDate: string; endDate: string }
    | { op: "remove"; startDate: string; endDate: string }
    | {
        op: "updateEnd";
        startDate: string;
        endDate: string;
        newEndDate: string;
      }
    | {
        op: "replace";
        periods: Array<{ startDate: string; endDate: string; createdAt?: string }>;
      },
): Promise<QuestExemptionsData> {
  return request("questExemptions", {
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
}): Promise<{
  balanceMinutes: number;
  displayBalance: number;
  penaltyMinutes: number;
  debtMinutes: number;
  issuablePenaltyTicketCount: number;
}> {
  return request("timerStop", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/**
 * POST penaltyTicketIssue（保護者のみ・1枚=60分即精算）
 * @param {{ count: number }} payload - 発行枚数（1以上・issuable 以下）。actor は常に parent
 * @returns {Promise<PenaltyTicketIssueResult>} 精算結果
 */
export function postPenaltyTicketIssue(payload: {
  count: number;
}): Promise<PenaltyTicketIssueResult> {
  return request("penaltyTicketIssue", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify({ actor: "parent", count: payload.count }),
  });
}
