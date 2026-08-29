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
  GradeCorrectionPayload,
  GradeCorrectionResult,
  GradeData,
  GradeDateItem,
  HomeData,
  LongVacationData,
  ParentHomeData,
  PenaltyTicketConsumeResult,
  PenaltyTicketIssueResult,
  PointDebtOffsetItemInput,
  PointDebtOffsetResult,
  PointExchangeCreateResult,
  PointExchangeDecision,
  PointExchangeDecisionResult,
  PointExchangeRequestItemInput,
  PointExchangeRequestsData,
  PointExchangeStatus,
  PhysicalRewardVoucherCatalogItemId,
  QuestExemptionsData,
  RegistrationActor,
  ResultItem,
  RewardVoucherRefundCreateResult,
  RewardVoucherRefundDecision,
  RewardVoucherRefundDecisionResult,
  RewardVoucherRefundItemInput,
  RewardVoucherRefundRequestsData,
  RewardVoucherRefundStatus,
  RewardVoucherConsumptionItemInput,
  RewardVoucherConsumptionResult,
  RewardVoucherConsumptionsData,
  SwitchTicketCatalogItemId,
  SwitchTicketRedeemResult,
  WakeTime,
} from "@/types/api";
import { mockApi } from "@/api/mock";
import { normalizeBalanceDebtFields } from "@/lib/balanceDebt";
import { normalizeRewardVouchers } from "@/lib/rewardVouchers";
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
  const vacationPhase =
    data.vacationPhase ??
    (data.isVacationTransition
      ? "transition"
      : data.isLongVacation
        ? "active"
        : "none");
  return {
    ...data,
    ...balance,
    rewardVouchers: normalizeRewardVouchers(data.rewardVouchers),
    isExemptDay: data.isExemptToday,
    // Functions 契約は vacationPhase 正本。旧 isLongVacation 欠落時もモード判定できるようにする。
    isVacationMode: data.isLongVacation ?? vacationPhase !== "none",
    isLongVacation: data.isLongVacation ?? vacationPhase !== "none",
    isWeekendEve: data.isWeekendEve ?? false,
    vacationPhase,
    // Functions 契約は vacationPhase 正本。旧 boolean 欠落時は transition から導出する。
    isVacationTransition:
      data.isVacationTransition ?? vacationPhase === "transition",
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
  const vacationPhase =
    data.vacationPhase ??
    (data.isVacationTransition
      ? "transition"
      : data.isLongVacation
        ? "active"
        : "none");
  return {
    ...data,
    ...normalizeBalanceDebtFields(data),
    rewardVouchers: normalizeRewardVouchers(data.rewardVouchers),
    vacationPhase,
    isVacationTransition:
      data.isVacationTransition ?? vacationPhase === "transition",
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

/** POST resultsAck（ADR-005: ポイントだけを更新する） */
export function postResultsAck(date: string): Promise<{
  appliedDelta: number;
  penaltyOffset: number;
  balancePoints: number;
  switchMinutes: number;
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
    gradingRevision: data.gradingRevision ?? (data.alreadyGraded || data.isGraded ? 1 : 0),
    originalGradedAt: data.originalGradedAt ?? "",
    lastCorrectedAt: data.lastCorrectedAt ?? "",
    acknowledged: data.acknowledged ?? false,
    canCorrect: data.canCorrect ?? false,
    cannotCorrectReason: data.cannotCorrectReason ?? null,
    totalPoints:
      typeof data.totalPoints === "number" && Number.isFinite(data.totalPoints)
        ? data.totalPoints
        : null,
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

/** POST gradeCorrection */
export function postGradeCorrection(
  payload: GradeCorrectionPayload,
): Promise<GradeCorrectionResult> {
  return request("gradeCorrection", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
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

/** POST timerStop（ADR-005: Switch時間とタイマー負債だけを更新する） */
export function postTimerStop(payload: {
  sessionId: string;
  startedAt: string;
  stoppedAt: string;
  usedMinutes: number;
  overrunMinutes: number;
}): Promise<{
  balancePoints: number;
  switchMinutes: number;
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
 * POST penaltyTicketIssue（保護者のみ・1枚=100pt即精算）
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

/**
 * POST penaltyTicketConsume（保護者のみ・在庫1枚ずつ消費・残高・負債は変えない）
 * @returns {Promise<PenaltyTicketConsumeResult>} 消費結果（消費後の在庫枚数）
 */
export function postPenaltyTicketConsume(): Promise<PenaltyTicketConsumeResult> {
  return request("penaltyTicketConsume", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify({ actor: "parent" }),
  });
}

/**
 * GET pointExchangeRequests（契約 §3.11.1・子ども `/rewards` と保護者 `/parent/rewards` で共用）
 * @param {{ month: string; status?: PointExchangeStatus }} opts - 対象月（`YYYY-MM`）と状態フィルタ
 * @returns {Promise<PointExchangeRequestsData>} 月次の申請一覧
 */
export function fetchPointExchangeRequests(opts: {
  month: string;
  status?: PointExchangeStatus;
}): Promise<PointExchangeRequestsData> {
  const query: Record<string, string> = { month: opts.month };
  if (opts.status) {
    query.status = opts.status;
  }
  return request("pointExchangeRequests", { method: "GET" }, query);
}

/**
 * POST pointExchangeRequests（子ども申請・pending 作成のみ・残高は変えない）
 * @param {{ items: PointExchangeRequestItemInput[] }} payload - 交換内訳（複数種・複数枚可）
 * @returns {Promise<PointExchangeCreateResult>} 作成結果
 */
export function postPointExchangeRequest(payload: {
  items: PointExchangeRequestItemInput[];
}): Promise<PointExchangeCreateResult> {
  return request("pointExchangeRequests", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/**
 * POST pointExchangeDecision（保護者の承認／却下）
 * @param {{ id: string; decision: PointExchangeDecision; rejectReason?: string }} payload - 決定内容
 * @returns {Promise<PointExchangeDecisionResult>} 決定結果
 */
export function postPointExchangeDecision(payload: {
  id: string;
  decision: PointExchangeDecision;
  rejectReason?: string;
}): Promise<PointExchangeDecisionResult> {
  return request("pointExchangeDecision", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/**
 * POST switchTicketRedeem（子ども・Switch券消費・契約 §3.11.2・Issue #45）
 * @param {{ catalogItemId: SwitchTicketCatalogItemId }} payload - 消費する券
 * @returns {Promise<SwitchTicketRedeemResult>} 消費結果
 */
export function postSwitchTicketRedeem(payload: {
  catalogItemId: SwitchTicketCatalogItemId;
}): Promise<SwitchTicketRedeemResult> {
  return request("switchTicketRedeem", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/**
 * GET rewardVoucherRefundRequests（契約 §3.11.3・子ども `/rewards` と保護者 `/parent/rewards` で共用）
 * @param {{ month: string; status?: RewardVoucherRefundStatus }} opts - 対象月（`YYYY-MM`）と状態フィルタ
 * @returns {Promise<RewardVoucherRefundRequestsData>} 月次の申請一覧
 */
export function fetchRewardVoucherRefundRequests(opts: {
  month: string;
  status?: RewardVoucherRefundStatus;
}): Promise<RewardVoucherRefundRequestsData> {
  const query: Record<string, string> = { month: opts.month };
  if (opts.status) {
    query.status = opts.status;
  }
  return request("rewardVoucherRefundRequests", { method: "GET" }, query);
}

/**
 * POST rewardVoucherRefundRequests（子ども申請・pending 作成のみ・在庫は変えない・Issue #46）
 * @param {{ items: RewardVoucherRefundItemInput[] }} payload - 戻し内訳
 * @returns {Promise<RewardVoucherRefundCreateResult>} 作成結果
 */
export function postRewardVoucherRefundRequest(payload: {
  items: RewardVoucherRefundItemInput[];
}): Promise<RewardVoucherRefundCreateResult> {
  return request("rewardVoucherRefundRequests", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/**
 * POST rewardVoucherRefundDecision（保護者の承認／却下・Issue #46）
 * @param {{ id: string; decision: RewardVoucherRefundDecision; rejectReason?: string }} payload - 決定内容
 * @returns {Promise<RewardVoucherRefundDecisionResult>} 決定結果
 */
export function postRewardVoucherRefundDecision(payload: {
  id: string;
  decision: RewardVoucherRefundDecision;
  rejectReason?: string;
}): Promise<RewardVoucherRefundDecisionResult> {
  return request("rewardVoucherRefundDecision", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/**
 * POST pointDebtOffset（子ども・負債の即時穴埋め・保護者承認不要・Issue #47）
 * @param {{ items: PointDebtOffsetItemInput[] }} payload - 穴埋めに使う券の内訳
 * @returns {Promise<PointDebtOffsetResult>} 穴埋め結果
 */
export function postPointDebtOffset(payload: {
  items: PointDebtOffsetItemInput[];
}): Promise<PointDebtOffsetResult> {
  return request("pointDebtOffset", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}

/** GET rewardVoucherConsumptions（物理報酬券の月次使用履歴） */
export function fetchRewardVoucherConsumptions(opts: {
  month: string;
  catalogItemId?: PhysicalRewardVoucherCatalogItemId;
}): Promise<RewardVoucherConsumptionsData> {
  const query: Record<string, string> = { month: opts.month };
  if (opts.catalogItemId) query.catalogItemId = opts.catalogItemId;
  return request("rewardVoucherConsumptions", { method: "GET" }, query);
}

/** POST rewardVoucherConsumptions（子どもによる即時使用・保護者承認不要） */
export function postRewardVoucherConsumption(payload: {
  operationId: string;
  items: RewardVoucherConsumptionItemInput[];
}): Promise<RewardVoucherConsumptionResult> {
  return request("rewardVoucherConsumptions", {
    method: "POST",
    headers: JSON_POST_HEADERS,
    body: JSON.stringify(payload),
  });
}
