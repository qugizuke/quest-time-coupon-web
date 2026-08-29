/**
 * @file モック API
 * @description API（Cloud Functions）未接続時の開発用インメモリ API（v5 対応）。
 *   長期休み／免除はローカルフラグ（本接続は Issue F）。
 */
import type {
  ChildAnswer,
  GradeAdjustment,
  GradeCorrectionPayload,
  GradeCorrectionResult,
  HomeData,
  PointExchangeRequest,
  PointExchangeStatus,
  PhysicalRewardVoucherCatalogItemId,
  QuestDefinition,
  RewardVoucherCatalogItemId,
  RewardVoucherConsumption,
  RewardVoucherConsumptionItemInput,
  RewardVoucherConsumptionResult,
  RewardVoucherRefundRequest,
  RewardVoucherRefundStatus,
  RewardVouchers,
  SwitchTicketCatalogItemId,
  WakeUpTime,
} from "@/types/api";
import { todayLocal } from "@/lib/date";
import { toMonth } from "@/lib/month";
import { calcExchangeTotals } from "@/lib/pointExchangeCatalog";
import {
  PENALTY_TICKET_POINTS,
  calcPointDebt,
  calcDebtMinutes,
  calcIssuableTicketCount,
} from "@/lib/debt";
import { normalizeBalanceDebtFields } from "@/lib/balanceDebt";
import {
  SWITCH_TICKET_MINUTES,
  REWARD_VOUCHER_LABELS,
  calcRewardVoucherTotals,
  hasEnoughRewardVouchers,
  isRewardVoucherCatalogItemId,
  normalizeRewardVouchers,
  zeroRewardVouchers,
} from "@/lib/rewardVouchers";
import {
  isBeforeQuestRegistrationStart,
  isPastQuestBonusDeadline,
  isPastQuestRegistrationCutoff,
  isWeekendEve,
  resolveQuestDeadlineBedtimeHour,
} from "@/lib/deadline";
import {
  AUTO_WAKE_TIME_VACATION_LAST_DAY,
  canChildSaveBedtime,
  getChildBedtimeSettingCutoff,
  isLongVacationFinalDayBeforeWeekday,
  isVacationTransitionPeriod,
  resolveWakeUpOptions,
} from "@/lib/homeMode";
import {
  BEDTIME_PREP_QUEST_ID,
  calcBedtimePrepFalseClaimPenalty,
  canApplyBedtimePrepRegistrationBonus,
} from "@/lib/registrationBonus";
import dailyJson from "../../quests/daily.json";
import adjustmentDefinitions from "../../adjustments/grade.json";

/**
 * クエスト定義フィクスチャ（to-be 10問・api-tobe-f-contract.md §4.1 準拠）。
 * JSON モジュールの型推論は string リテラルを広げるため、契約型へ明示キャストする。
 */
const daily: { version: number; quests: QuestDefinition[] } = {
  version: dailyJson.version,
  quests: dailyJson.quests as QuestDefinition[],
};

/** @type {string} モック長期休みフラグ（localStorage） */
const MOCK_VACATION_KEY = "qtc:mock:vacation";

/** @type {string} モック免除フラグ（localStorage） */
const MOCK_EXEMPT_KEY = "qtc:mock:exempt";

/** @type {number} 未登録・採点拒否ペナルティ（pt・ADR-005） */
const MISSED_REGISTRATION_PENALTY = -100;

const POINTS_CUTOVER_DATE = "2026-08-25";

function normalizeMockGradeCorrectionPayload(
  payload: GradeCorrectionPayload,
): string {
  return JSON.stringify({
    correctionId: payload.correctionId.toLowerCase(),
    date: payload.date,
    expectedRevision: payload.expectedRevision,
    resultType: payload.resultType,
    grades: [...(payload.grades ?? [])].sort((left, right) =>
      left.questId.localeCompare(right.questId),
    ),
    adjustments: [...(payload.adjustments ?? [])].sort((left, right) =>
      left.code.localeCompare(right.code),
    ),
  });
}

/** 物理券の契約上の固定順 */
const PHYSICAL_REWARD_VOUCHER_IDS: readonly PhysicalRewardVoucherCatalogItemId[] = [
  "snack-10",
  "cash-100",
  "dining-1000",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface MockStore {
  /** クエスト結果で増減するポイント残高（pt）。0未満にはならない */
  balancePoints: number;
  switchMinutes: number;
  penaltyMinutes: number;
  /** 未消費のペナルティチケット枚数（≥ 0） */
  penaltyTicketCount: number;
  answers: Map<string, Map<string, ChildAnswer>>;
  grades: Map<string, Map<string, boolean>>;
  gradedDates: Set<string>;
  rejectedDates: Set<string>;
  acknowledgedDates: Set<string>;
  missedRegistrationDates: Set<string>;
  /** resultsAck で残高へ反映した appliedDelta（後付け免除の復元用） */
  appliedDeltaByDate: Map<string, number>;
  bedtimeByDate: Map<string, number>;
  wakeUpByDate: Map<string, WakeUpTime>;
  submittedAtByDate: Map<string, string>;
  adjustmentsByDate: Map<string, GradeAdjustment[]>;
  gradingRevisionByDate: Map<string, number>;
  originalGradedAtByDate: Map<string, string>;
  lastCorrectedAtByDate: Map<string, string>;
  gradeCorrectionLogs: Map<
    string,
    { normalizedPayload: string; response: GradeCorrectionResult }
  >;
  /** date → endsAt ISO（再開枠） */
  registrationReopenByDate: Map<string, { endsAt: string; setAt: string; used: boolean }>;
  longVacation: { startDate: string; endDate: string; updatedAt: string };
  exemptionPeriods: Array<{ startDate: string; endDate: string; createdAt: string }>;
  /** id → ポイント交換申請（Issue #38） */
  pointExchangeRequests: Map<string, PointExchangeRequest>;
  /** 申請 ID 発行用の連番 */
  pointExchangeSeq: number;
  /** 報酬チケット在庫（Issue #43・ADR-006・5キー固定） */
  rewardVouchers: RewardVouchers;
  /** id → 報酬チケット戻し申請（Issue #46） */
  rewardVoucherRefundRequests: Map<string, RewardVoucherRefundRequest>;
  /** 戻し申請 ID 発行用の連番 */
  rewardVoucherRefundSeq: number;
  /** operationId → 物理報酬券使用ログ（Issue #59） */
  rewardVoucherConsumptions: Map<string, RewardVoucherConsumption>;
  /** テスト用オーバーライド（undefined なら localStorage） */
  vacationModeOverride?: boolean;
  /** テスト用免除日セット（未設定なら localStorage の当日免除） */
  exemptDatesOverride?: Set<string>;
}

const store: MockStore = {
  balancePoints: 0,
  switchMinutes: 60,
  penaltyMinutes: 0,
  penaltyTicketCount: 0,
  answers: new Map(),
  grades: new Map(),
  gradedDates: new Set(),
  rejectedDates: new Set(),
  acknowledgedDates: new Set(),
  missedRegistrationDates: new Set(),
  appliedDeltaByDate: new Map(),
  bedtimeByDate: new Map(),
  wakeUpByDate: new Map(),
  submittedAtByDate: new Map(),
  adjustmentsByDate: new Map(),
  gradingRevisionByDate: new Map(),
  originalGradedAtByDate: new Map(),
  lastCorrectedAtByDate: new Map(),
  gradeCorrectionLogs: new Map(),
  registrationReopenByDate: new Map(),
  longVacation: { startDate: "", endDate: "", updatedAt: "" },
  exemptionPeriods: [],
  pointExchangeRequests: new Map(),
  pointExchangeSeq: 0,
  rewardVouchers: zeroRewardVouchers(),
  rewardVoucherRefundRequests: new Map(),
  rewardVoucherRefundSeq: 0,
  rewardVoucherConsumptions: new Map(),
};

/**
 * 現在ストアから残高・負債フィールドを組み立てる（ADR-005 二財布）
 * @returns {ReturnType<typeof normalizeBalanceDebtFields>} 残高・負債
 */
function buildBalanceSnapshot() {
  const debtMinutes = calcDebtMinutes(
    store.switchMinutes,
    store.penaltyMinutes,
  );
  return normalizeBalanceDebtFields({
    balancePoints: store.balancePoints,
    switchMinutes: store.switchMinutes,
    displayBalance: store.switchMinutes,
    penaltyMinutes: store.penaltyMinutes,
    debtMinutes,
    issuablePenaltyTicketCount: calcIssuableTicketCount(store.balancePoints),
    penaltyTicketCount: store.penaltyTicketCount,
  });
}

/**
 * テスト用: 残高・超過・チケット在庫を上書きする
 * @param {object} opts - 上書き値
 * @param {number} [opts.balancePoints] - ポイント残高（ADR-006: 負も可・丸めない）
 * @param {number} [opts.switchMinutes] - Switch/YouTube 時間残高
 * @param {number} [opts.penaltyMinutes] - タイマー超過分
 * @param {number} [opts.penaltyTicketCount] - ペナルティチケット在庫
 * @param {Partial<RewardVouchers>} [opts.rewardVouchers] - 報酬チケット在庫（欠落キーは既存値を保持）
 * @returns {void}
 */
export function setMockBalanceDebt(opts: {
  balancePoints?: number;
  switchMinutes?: number;
  penaltyMinutes?: number;
  penaltyTicketCount?: number;
  rewardVouchers?: Partial<RewardVouchers>;
}): void {
  if (opts.balancePoints !== undefined) {
    // ADR-006: balancePoints は負を許容するため丸めない。
    store.balancePoints = opts.balancePoints;
  }
  if (opts.switchMinutes !== undefined) {
    store.switchMinutes = opts.switchMinutes;
  }
  if (opts.penaltyMinutes !== undefined) {
    store.penaltyMinutes = Math.max(0, opts.penaltyMinutes);
  }
  if (opts.penaltyTicketCount !== undefined) {
    store.penaltyTicketCount = Math.max(0, opts.penaltyTicketCount);
  }
  if (opts.rewardVouchers !== undefined) {
    store.rewardVouchers = normalizeRewardVouchers({
      ...store.rewardVouchers,
      ...opts.rewardVouchers,
    });
  }
}

/**
 * localStorage からモックフラグを読む（SSR／テストで失敗しても false）
 * @param {string} key - キー
 * @returns {boolean} "1" なら true
 */
function readMockFlag(key: string): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/**
 * モックの長期休みモードを返す
 * @returns {boolean} モード中なら true
 */
function resolveMockVacationMode(date?: string): boolean {
  if (store.vacationModeOverride !== undefined) {
    return store.vacationModeOverride;
  }
  if (store.longVacation.startDate && store.longVacation.endDate) {
    const d = date ?? todayLocal();
    return isDateInInclusiveRange(
      d,
      store.longVacation.startDate,
      store.longVacation.endDate,
    );
  }
  return readMockFlag(MOCK_VACATION_KEY);
}

/**
 * モック用: 長期休み終了1週間前の移行期間中か（Issue #36）
 * @description `store.longVacation` の期間が設定されているときのみ判定する
 *   （vacationModeOverride / フラグのみの場合は期間不明のため false）。
 * @param {string} [date] - 業務日。省略時は当日
 * @returns {boolean} 移行期間なら true
 */
function resolveMockVacationTransition(date?: string): boolean {
  if (!store.longVacation.startDate || !store.longVacation.endDate) {
    return false;
  }
  return isVacationTransitionPeriod(date ?? todayLocal(), store.longVacation);
}

/** モック用: 長期休みの3値phase */
function resolveMockVacationPhase(date?: string): "none" | "active" | "transition" {
  const target = date ?? todayLocal();
  if (resolveMockVacationTransition(target)) return "transition";
  if (resolveMockVacationMode(target)) return "active";
  return "none";
}

/**
 * モックの免除日判定
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} 免除日なら true
 * @limitation localStorage の当日免除フラグ（`qtc:mock:exempt`）は
 *   `date === todayLocal()` のときだけ有効。過去日の resultsAck を誤拒否しない。
 */
function resolveMockExemptDay(date: string): boolean {
  if (store.exemptDatesOverride) {
    return store.exemptDatesOverride.has(date);
  }
  if (
    store.exemptionPeriods.some((p) =>
      isDateInInclusiveRange(date, p.startDate, p.endDate),
    )
  ) {
    return true;
  }
  // 当日フラグは「今日」のみ（過去の未確認 ack をブロックしない）
  return readMockFlag(MOCK_EXEMPT_KEY) && date === todayLocal();
}

/**
 * 期間内の全日を YYYY-MM-DD 配列で返す
 * @param {string} startDate - 開始
 * @param {string} endDate - 終了
 * @returns {string[]} 日付一覧
 */
function expandInclusiveDateRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) return [];
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const dates: string[] = [];
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/**
 * 免除期間配列から全日セットを作る
 * @param {Array<{ startDate: string; endDate: string }>} periods - 期間一覧
 * @returns {Set<string>} 日付セット
 */
function collectExemptDatesFromPeriods(
  periods: Array<{ startDate: string; endDate: string }>,
): Set<string> {
  const dates = new Set<string>();
  for (const period of periods) {
    for (const date of expandInclusiveDateRange(period.startDate, period.endDate)) {
      dates.add(date);
    }
  }
  return dates;
}

/**
 * results に載せる免除日一覧を収集する（今日以前のみ・契約: Result は当日以前）
 * @returns {string[]} 免除日 YYYY-MM-DD
 */
function collectMockExemptDatesForResults(): string[] {
  const today = todayLocal();
  const dates = new Set<string>();
  if (store.exemptDatesOverride) {
    for (const date of store.exemptDatesOverride) {
      dates.add(date);
    }
  }
  for (const date of collectExemptDatesFromPeriods(store.exemptionPeriods)) {
    dates.add(date);
  }
  if (!store.exemptDatesOverride && readMockFlag(MOCK_EXEMPT_KEY)) {
    dates.add(today);
  }
  return [...dates].filter((date) => date <= today);
}

/**
 * 未登録結果を免除へ置換し、ack 済みなら残高を冪等に復元する（契約 T9）
 * @param {string} date - YYYY-MM-DD
 * @returns {"changed" | "skipped" | "noop"} 処理区分
 */
function convertUnregisteredToExempt(date: string): "changed" | "skipped" | "noop" {
  if (store.gradedDates.has(date) || store.rejectedDates.has(date)) {
    return "skipped";
  }
  if (!store.missedRegistrationDates.has(date)) {
    return "noop";
  }
  if (store.acknowledgedDates.has(date)) {
    const applied =
      store.appliedDeltaByDate.get(date) ?? MISSED_REGISTRATION_PENALTY;
    // ADR-006: balancePoints は負を許容するため0止めしない。
    store.balancePoints = store.balancePoints - applied;
    store.appliedDeltaByDate.delete(date);
  }
  store.missedRegistrationDates.delete(date);
  store.acknowledgedDates.delete(date);
  return "changed";
}

/**
 * 後付け免除の被覆追加（契約 T9・今日以前）
 * @param {Iterable<string>} newlyCoveredDates - 新たに免除へ入った日
 * @returns {{ changedDates: string[]; skippedDates: string[] }} 集計
 */
function applyExemptionCoverage(newlyCoveredDates: Iterable<string>): {
  changedDates: string[];
  skippedDates: string[];
} {
  const today = todayLocal();
  const changedDates: string[] = [];
  const skippedDates: string[] = [];
  for (const date of newlyCoveredDates) {
    if (date > today) continue;
    const outcome = convertUnregisteredToExempt(date);
    if (outcome === "skipped") {
      skippedDates.push(date);
      continue;
    }
    if (outcome === "changed") {
      changedDates.push(date);
      continue;
    }
    // result なし → exempt を results 合成で出す（初回被覆は changed）
    if (
      !store.gradedDates.has(date) &&
      !store.rejectedDates.has(date) &&
      !store.answers.has(date)
    ) {
      changedDates.push(date);
    }
  }
  return { changedDates, skippedDates };
}

/**
 * 免除被覆解除（契約 T9 uncover・今日以前の exempt 相当）
 * @param {Iterable<string>} uncoveredDates - 期間外になった日
 * @returns {{ changedDates: string[]; skippedDates: string[] }} 集計
 */
function applyExemptionUncover(uncoveredDates: Iterable<string>): {
  changedDates: string[];
  skippedDates: string[];
} {
  const today = todayLocal();
  const changedDates: string[] = [];
  const skippedDates: string[] = [];
  for (const date of uncoveredDates) {
    if (date > today) continue;
    if (store.gradedDates.has(date) || store.rejectedDates.has(date)) {
      skippedDates.push(date);
      continue;
    }
    if (store.missedRegistrationDates.has(date)) {
      skippedDates.push(date);
      continue;
    }
    if (store.answers.has(date)) {
      skippedDates.push(date);
      continue;
    }
    if (date === today) {
      // 当日 exempt 取消 → result なし（未登録は作らない）
      changedDates.push(date);
      continue;
    }
    // 過去の exempt（answers 空）→ unregistered へ置換
    store.missedRegistrationDates.add(date);
    store.acknowledgedDates.delete(date);
    store.appliedDeltaByDate.delete(date);
    changedDates.push(date);
  }
  return { changedDates, skippedDates };
}

/**
 * モックの長期休み／免除フラグをテストから設定する
 * @param {object} opts - オプション
 * @param {boolean} [opts.vacationMode] - 長期休み
 * @param {string[]} [opts.exemptDates] - 免除日一覧
 * @returns {void}
 */
export function setMockHomeModeFlags(opts: {
  vacationMode?: boolean;
  exemptDates?: string[];
}): void {
  if (opts.vacationMode !== undefined) {
    store.vacationModeOverride = opts.vacationMode;
  }
  if (opts.exemptDates !== undefined) {
    store.exemptDatesOverride = new Set(opts.exemptDates);
    // 免除へ切り替えた日の stale な未登録ペナルティを削除し、ack 済みなら残高復元
    for (const date of opts.exemptDates) {
      convertUnregisteredToExempt(date);
    }
  }
}

/**
 * モックのホームモードフラグをクリアする
 * @returns {void}
 */
export function clearMockHomeModeFlags(): void {
  store.vacationModeOverride = undefined;
  store.exemptDatesOverride = undefined;
}

/**
 * テスト用: 回答登録後に保存された起床約束を返す
 * @param {string} date - YYYY-MM-DD
 * @returns {WakeUpTime | undefined} 保存値
 */
export function getMockWakeUp(date: string): WakeUpTime | undefined {
  return store.wakeUpByDate.get(date);
}

/**
 * テスト用にモックストアを初期状態へ戻す
 * @returns {void}
 */
export function resetMockStore(): void {
  store.balancePoints = 0;
  store.switchMinutes = 60;
  store.penaltyMinutes = 0;
  store.penaltyTicketCount = 0;
  store.answers.clear();
  store.grades.clear();
  store.gradedDates.clear();
  store.rejectedDates.clear();
  store.acknowledgedDates.clear();
  store.missedRegistrationDates.clear();
  store.appliedDeltaByDate.clear();
  store.bedtimeByDate.clear();
  store.wakeUpByDate.clear();
  store.submittedAtByDate.clear();
  store.adjustmentsByDate.clear();
  store.gradingRevisionByDate.clear();
  store.originalGradedAtByDate.clear();
  store.lastCorrectedAtByDate.clear();
  store.gradeCorrectionLogs.clear();
  store.registrationReopenByDate.clear();
  store.longVacation = { startDate: "", endDate: "", updatedAt: "" };
  store.exemptionPeriods = [];
  store.pointExchangeRequests.clear();
  store.pointExchangeSeq = 0;
  store.rewardVouchers = zeroRewardVouchers();
  store.rewardVoucherRefundRequests.clear();
  store.rewardVoucherRefundSeq = 0;
  store.rewardVoucherConsumptions.clear();
  clearMockHomeModeFlags();
}

/**
 * 日付が期間（両端含む）に含まれるか
 * @param {string} date - YYYY-MM-DD
 * @param {string} start - 開始
 * @param {string} end - 終了
 * @returns {boolean} 含まれるなら true
 */
function isDateInInclusiveRange(date: string, start: string, end: string): boolean {
  if (!start || !end) return false;
  return date >= start && date <= end;
}

/**
 * 未確認件数（requiresAck 対象）を数える
 * @returns {number} unacknowledgedCount
 */
function countUnacknowledged(): number {
  let count = 0;
  for (const date of store.gradedDates) {
    if (!store.acknowledgedDates.has(date) && !resolveMockExemptDay(date)) {
      count += 1;
    }
  }
  for (const date of store.rejectedDates) {
    if (!store.acknowledgedDates.has(date) && !resolveMockExemptDay(date)) {
      count += 1;
    }
  }
  for (const date of store.missedRegistrationDates) {
    if (!store.acknowledgedDates.has(date) && !resolveMockExemptDay(date)) {
      count += 1;
    }
  }
  return count;
}

/**
 * timer ブロック件数（normal / grade_rejected の未 ack のみ）
 * @returns {number} timerBlockCount
 */
function countTimerBlock(): number {
  let count = 0;
  for (const date of store.gradedDates) {
    if (
      !store.acknowledgedDates.has(date) &&
      !resolveMockExemptDay(date) &&
      !store.rejectedDates.has(date)
    ) {
      count += 1;
    }
  }
  for (const date of store.rejectedDates) {
    if (!store.acknowledgedDates.has(date) && !resolveMockExemptDay(date)) {
      count += 1;
    }
  }
  return count;
}

/** @type {number} 定時登録ボーナス（pt・ADR-005） */
const REGISTRATION_ON_TIME_BONUS = 5;

/** @type {number} 全達成ボーナス（pt・ADR-005）。bedtime-prep を除く9問すべて達成で加算 */
const FULL_ACHIEVEMENT_BONUS = 50;

/**
 * 就寝時刻 payload が有効か
 * @param {number | undefined} bedtimeHour - 就寝時刻
 * @returns {boolean} 未指定または 21/22/23 なら true
 */
function isValidOptionalBedtimeHour(bedtimeHour: number | undefined): boolean {
  return (
    bedtimeHour === undefined ||
    bedtimeHour === 21 ||
    bedtimeHour === 22 ||
    bedtimeHour === 23
  );
}

/**
 * モック用の定時登録加減点を算出する（クエスト点は未シミュレート）
 * @param {string} date - 対象日
 * @returns {number} 定時登録ボーナスまたは未登録ペナルティ
 */
function calcMockRegistrationTimingAdjustment(
  date: string,
  grades = store.grades.get(date) ?? new Map<string, boolean>(),
): number {
  if (store.missedRegistrationDates.has(date)) {
    return MISSED_REGISTRATION_PENALTY;
  }
  const submittedAt = store.submittedAtByDate.get(date);
  if (!submittedAt) return 0;
  const submitted = new Date(submittedAt);
  const bedtimeHour = store.bedtimeByDate.get(date);
  if (isPastQuestBonusDeadline(date, submitted, bedtimeHour)) return 0;
  return canApplyBedtimePrepRegistrationBonus(mockBedtimePrepEvaluation(date, grades))
    ? REGISTRATION_ON_TIME_BONUS
    : 0;
}

/**
 * モック用の定時登録ボーナス理由文を返す
 * @param {string} date - 対象日
 * @param {number} adjustment - 調整分数
 * @returns {string} 表示理由
 */
function describeMockRegistrationTimingReason(
  date: string,
  adjustment: number,
): string {
  if (adjustment > 0) {
    return `定時登録ボーナス +${adjustment}pt（寝る準備確認済み）`;
  }
  const bedtimePrep = mockBedtimePrepEvaluation(date);
  if (!bedtimePrep) {
    return "定時登録ボーナスなし（寝る準備が未採点です）";
  }
  if (bedtimePrep.childAnswer !== 1) {
    return "定時登録ボーナスなし（寝る準備をできなかったと回答しました）";
  }
  if (!bedtimePrep.actualDone) {
    return "定時登録ボーナスなし（寝る準備が確認できませんでした）";
  }
  return "定時登録ボーナスなし（ボーナス締切を過ぎていました）";
}

/**
 * モック用の寝る準備判定材料を返す
 * @param {string} date - 対象日
 * @returns {{ childAnswer: ChildAnswer; actualDone: boolean } | undefined} 判定材料
 */
function mockBedtimePrepEvaluation(
  date: string,
  grades = store.grades.get(date) ?? new Map<string, boolean>(),
): { childAnswer: ChildAnswer; actualDone: boolean } | undefined {
  const childAnswer = store.answers.get(date)?.get(BEDTIME_PREP_QUEST_ID);
  const actualDone = grades.get(BEDTIME_PREP_QUEST_ID);
  if (childAnswer === undefined || actualDone === undefined) return undefined;
  return { childAnswer, actualDone };
}

/**
 * モック用の寝る準備虚偽ペナルティを算出する
 * @param {string} date - 対象日
 * @returns {number} ペナルティ分数
 */
function calcMockBedtimePrepPenalty(
  date: string,
  grades = store.grades.get(date) ?? new Map<string, boolean>(),
): number {
  return calcBedtimePrepFalseClaimPenalty(mockBedtimePrepEvaluation(date, grades));
}

/**
 * モック用の任意加減点合計を算出する
 * @param {string} date - 対象日
 * @returns {number} bonus は正、penalty は負の合計
 */
function sumMockAdjustments(
  date: string,
  adjustments = store.adjustmentsByDate.get(date) ?? [],
): number {
  return adjustments.reduce((sum, adj) => {
    return sum + (adj.kind === "bonus" ? adj.points : -adj.points);
  }, 0);
}

/**
 * モック用の全達成ボーナスを算出する（ADR-005）
 * @description bedtime-prep を除く設問すべてが不一致なしで達成のとき +50pt。
 *   クエスト点自体は未シミュレートのため、不一致（mismatch）判定を達成基準に使う。
 * @param {string} date - 対象日
 * @returns {number} 全達成なら FULL_ACHIEVEMENT_BONUS、それ以外は 0
 */
function calcMockFullAchievementBonus(
  date: string,
  dayGrades = store.grades.get(date) ?? new Map<string, boolean>(),
): number {
  const dayAnswers = store.answers.get(date);
  if (!dayAnswers) return 0;
  let hasScoredQuest = false;
  for (const [questId, childAnswer] of dayAnswers) {
    if (questId === BEDTIME_PREP_QUEST_ID) continue;
    hasScoredQuest = true;
    const actualDone = dayGrades.get(questId) ?? false;
    if (isMockMismatch(childAnswer, actualDone)) {
      return 0;
    }
  }
  return hasScoredQuest ? FULL_ACHIEVEMENT_BONUS : 0;
}

/**
 * モック用の採点合計点を算出する（クエスト点は未シミュレート）
 * @param {string} date - 対象日
 * @returns {number} totalPoints
 */
function calcMockNonQuestPoints(
  date: string,
  adjustments = store.adjustmentsByDate.get(date) ?? [],
  grades = store.grades.get(date) ?? new Map<string, boolean>(),
): number {
  return (
    calcMockRegistrationTimingAdjustment(date, grades) +
    calcMockBedtimePrepPenalty(date, grades) +
    calcMockFullAchievementBonus(date, grades) +
    sumMockAdjustments(date, adjustments)
  );
}

interface MockQuestStreak {
  success: number;
  failure: number;
}

interface MockGradeOverride {
  date: string;
  resultType: "normal" | "grade_rejected";
  grades: Map<string, boolean>;
  adjustments: GradeAdjustment[];
}

const MOCK_SKIP_QUEST_IDS = new Set([
  "homework-done-today",
  "phone-non-emergency-unused",
]);

interface MockGradeDetail {
  questId: string;
  actualDone: boolean;
  basePoints: number;
  multiplier: number;
  finalPoints: number;
  streakAfter: MockQuestStreak;
  category: "routine" | "reminder";
}

interface MockDayReplay {
  totalPoints: number;
  questPoints: number;
  gradeDetails: MockGradeDetail[];
  signature: string;
}

/** 採点確定順で全通常採点を再生し、ストリーク込みの日別結果を返す。 */
function replayMockTotals(override?: MockGradeOverride): Map<string, MockDayReplay> {
  const streaks = new Map<string, MockQuestStreak>();
  const totals = new Map<string, MockDayReplay>();
  const dates = new Set([...store.gradedDates, ...store.rejectedDates]);
  if (override) dates.add(override.date);
  const ordered = [...dates].sort((left, right) => {
    const leftTime = store.originalGradedAtByDate.get(left) ?? "";
    const rightTime = store.originalGradedAtByDate.get(right) ?? "";
    return leftTime.localeCompare(rightTime) || left.localeCompare(right);
  });

  for (const date of ordered) {
    const resultType = override?.date === date
      ? override.resultType
      : store.rejectedDates.has(date)
        ? "grade_rejected"
        : "normal";
    if (resultType === "grade_rejected") {
      totals.set(date, {
        totalPoints: MISSED_REGISTRATION_PENALTY,
        questPoints: 0,
        gradeDetails: [],
        signature: "grade_rejected",
      });
      continue;
    }
    const answers = store.answers.get(date) ?? new Map<string, ChildAnswer>();
    const grades = override?.date === date
      ? override.grades
      : (store.grades.get(date) ?? new Map<string, boolean>());
    let questPoints = 0;
    const gradeDetails: MockGradeDetail[] = [];
    for (const [questId, childAnswer] of answers) {
      const definition = daily.quests.find((quest) => quest.id === questId);
      if (definition?.scoringRole === "registrationGate") continue;
      const category = definition?.category ?? "routine";
      const actualDone = grades.get(questId) ?? false;
      const isSkip = childAnswer === -1 && MOCK_SKIP_QUEST_IDS.has(questId);
      let basePoints = 0;
      if (!isSkip) {
        if (childAnswer === 1) {
          basePoints = actualDone ? 5 : category === "reminder" ? -20 : -10;
        } else if (childAnswer === 0) {
          basePoints = actualDone ? 5 : category === "reminder" ? -10 : -5;
        } else {
          basePoints = category === "reminder" ? -20 : -10;
        }
      }
      const current = streaks.get(questId) ?? { success: 0, failure: 0 };
      let multiplier = 1;
      if (basePoints > 0) {
        multiplier = Math.min(1 + current.success * 0.25, 2);
        streaks.set(questId, { success: current.success + 1, failure: 0 });
      } else if (basePoints < 0) {
        const step = category === "reminder" ? 0.5 : 0.25;
        const cap = category === "reminder" ? 3 : 2;
        multiplier = Math.min(1 + current.failure * step, cap);
        streaks.set(questId, { success: 0, failure: current.failure + 1 });
      }
      const finalPoints = Math.round((basePoints * multiplier) / 5) * 5;
      questPoints += finalPoints;
      gradeDetails.push({
        questId,
        actualDone,
        basePoints,
        multiplier,
        finalPoints,
        streakAfter: streaks.get(questId) ?? current,
        category,
      });
    }
    const adjustments = override?.date === date
      ? override.adjustments
      : (store.adjustmentsByDate.get(date) ?? []);
    const nonQuestPoints = calcMockNonQuestPoints(date, adjustments, grades);
    totals.set(date, {
      totalPoints: questPoints + nonQuestPoints,
      questPoints,
      gradeDetails,
      signature: JSON.stringify({
        resultType,
        gradeDetails,
        nonQuestPoints,
        adjustments,
      }),
    });
  }
  return totals;
}

function calcMockTotalPoints(date: string): number {
  return replayMockTotals().get(date)?.totalPoints ?? calcMockNonQuestPoints(date);
}

/**
 * モック用の不一致判定を返す
 * @param {ChildAnswer} childAnswer - 子ども回答
 * @param {boolean} actualDone - 保護者判定
 * @returns {boolean} 不一致なら true
 */
function isMockMismatch(childAnswer: ChildAnswer, actualDone: boolean): boolean {
  if (childAnswer === 1) return !actualDone;
  if (childAnswer === 0) return actualDone;
  return !actualDone;
}

/**
 * モック採点 payload を本番 API と同じ要点で検証する
 * @param {string} date - 対象日
 * @param {{ questId: string; actualDone: boolean }[] | undefined} grades - 採点 payload
 */

/**
 * モック用: 子ども回答から採点モードを決める（契約 §3.6・812 行付近）
 * @param {string} questId - クエスト ID
 * @param {ChildAnswer} childAnswer - 子ども回答
 * @returns {import("@/types/api").GradingMode} 採点モード
 */
function mockGradingModeForChildAnswer(
  questId: string,
  childAnswer: ChildAnswer,
): import("@/types/api").GradingMode {
  if (childAnswer === -1) {
    if (
      questId === "homework-done-today" ||
      questId === "phone-non-emergency-unused"
    ) {
      return "skip";
    }
    return "auto_worst";
  }
  if (childAnswer === 0) {
    return "auto_fail";
  }
  return "parent_choice";
}

function validateMockGrades(
  date: string,
  grades: { questId: string; actualDone: boolean }[] | undefined,
): void {
  const dayAnswers = store.answers.get(date);
  if (!dayAnswers) {
    throw new Error("NOT_FOUND: 回答がありません");
  }
  if (!grades) {
    throw new Error("BAD_REQUEST: date と grades が必要です");
  }
  if (!Array.isArray(grades)) {
    throw new Error("BAD_REQUEST: grades は配列である必要があります");
  }
  const seen = new Set<string>();
  for (const g of grades) {
    if (!g || typeof g.questId !== "string") {
      throw new Error("BAD_REQUEST: grade の形式が不正です");
    }
    if (typeof g.actualDone !== "boolean") {
      throw new Error(`BAD_REQUEST: actualDone は boolean である必要があります questId=${g.questId}`);
    }
    if (seen.has(g.questId)) {
      throw new Error(`BAD_REQUEST: questId が重複しています questId=${g.questId}`);
    }
    seen.add(g.questId);
  }
  const gradeMap = new Map(grades.map((g) => [g.questId, g.actualDone]));
  for (const [questId, childAnswer] of dayAnswers) {
    // 契約: parent_choice 相当は肯定回答のみ保護者入力。否定・わからないはサーバ側 auto
    if (childAnswer !== 1) continue;
    if (!gradeMap.has(questId)) {
      throw new Error(`BAD_REQUEST: 未採点 questId=${questId}`);
    }
  }
  for (const g of grades) {
    if (!dayAnswers.has(g.questId)) {
      throw new Error(`BAD_REQUEST: 未知の questId=${g.questId}`);
    }
    const childAnswer = dayAnswers.get(g.questId)!;
    if (childAnswer !== 1) {
      throw new Error(
        `BAD_REQUEST: 肯定回答以外は採点不要 questId=${g.questId}`,
      );
    }
  }
}

/**
 * モック回答 payload を本番 API と同じ要点で検証する
 * @param {{ questId: string; childAnswer: ChildAnswer }[] | undefined} answers - 回答 payload
 */
function validateMockAnswers(
  answers: { questId: string; childAnswer: ChildAnswer }[] | undefined,
): void {
  if (!Array.isArray(answers)) {
    throw new Error("BAD_REQUEST: date と answers が必要です");
  }
  const seen = new Set<string>();
  const questMap = new Map(daily.quests.map((q) => [q.id, q]));
  for (const answer of answers) {
    const quest = questMap.get(answer.questId);
    if (!quest) {
      throw new Error(`BAD_REQUEST: 未知の questId=${answer.questId}`);
    }
    if (seen.has(answer.questId)) {
      throw new Error(`BAD_REQUEST: questId が重複しています questId=${answer.questId}`);
    }
    seen.add(answer.questId);
    if (answer.childAnswer !== 1 && answer.childAnswer !== 0 && answer.childAnswer !== -1) {
      throw new Error(
        `BAD_REQUEST: childAnswer が不正です questId=${answer.questId}`,
      );
    }
    if (quest.answerMode === "binary" && answer.childAnswer === -1) {
      throw new Error(`BAD_REQUEST: 2択クエストに分からないは使えません questId=${answer.questId}`);
    }
  }
  for (const quest of daily.quests) {
    if (quest.conditional?.persistGateAnswer === false) continue;
    if (!seen.has(quest.id)) {
      throw new Error(`BAD_REQUEST: 未回答 questId=${quest.id}`);
    }
  }
}

/**
 * モック retry で registration gate の回答変更を拒否する
 * @param {Map<string, ChildAnswer> | undefined} existingAnswers - 既存回答
 * @param {{ questId: string; childAnswer: ChildAnswer }[]} nextAnswers - 再送回答
 */
function validateMockRetryImmutableAnswers(
  existingAnswers: Map<string, ChildAnswer> | undefined,
  nextAnswers: { questId: string; childAnswer: ChildAnswer }[],
): void {
  const nextMap = new Map(nextAnswers.map((answer) => [answer.questId, answer.childAnswer]));
  const existingAnswer = existingAnswers?.get(BEDTIME_PREP_QUEST_ID);
  if (existingAnswer === undefined) return;
  const nextAnswer = nextMap.get(BEDTIME_PREP_QUEST_ID);
  if (nextAnswer !== undefined && nextAnswer !== existingAnswer) {
    throw new Error(
      `BAD_REQUEST: 回答済みの登録ゲートは変更できません questId=${BEDTIME_PREP_QUEST_ID}`,
    );
  }
}

/**
 * モック任意加減点 payload を検証する
 * @param {GradeAdjustment[]} adjustments - 加減点 payload
 */
function validateMockAdjustments(adjustments: GradeAdjustment[]): void {
  if (!Array.isArray(adjustments)) {
    throw new Error("BAD_REQUEST: adjustments は配列である必要があります");
  }
  const seen = new Set<string>();
  const definitions = new Map(adjustmentDefinitions.items.map((def) => [def.code, def]));
  for (const adj of adjustments) {
    const def = definitions.get(adj.code);
    if (!def) {
      throw new Error(`BAD_REQUEST: 未知の調整項目 code=${adj.code}`);
    }
    if (adj.kind !== "bonus" && adj.kind !== "penalty") {
      throw new Error(`BAD_REQUEST: 不正な kind=${String(adj.kind)} code=${adj.code}`);
    }
    if (def.kind !== adj.kind) {
      throw new Error(`BAD_REQUEST: kind と code の組み合わせが不正 code=${adj.code}`);
    }
    if (typeof adj.points !== "number" || !Number.isFinite(adj.points)) {
      throw new Error(`BAD_REQUEST: points は数値である必要があります code=${adj.code}`);
    }
    if (adj.points < 10 || adj.points > 100 || adj.points % 10 !== 0) {
      throw new Error(`BAD_REQUEST: points は10〜100の10pt刻み code=${adj.code}`);
    }
    const key = `${adj.kind}:${adj.code}`;
    if (seen.has(key)) {
      throw new Error(`BAD_REQUEST: 重複 code=${adj.code}`);
    }
    seen.add(key);
  }
}

/**
 * モック API ハンドラ
 * @param {string} action - action 名
 * @param {RequestInit} [init] - リクエスト
 * @param {Record<string, string>} [query] - クエリ
 * @returns {Promise<T>} レスポンス data
 */
export async function mockApi<T>(
  action: string,
  init?: RequestInit,
  query?: Record<string, string>,
): Promise<T> {
  const today = todayLocal();
  const body = init?.body ? JSON.parse(init.body as string) : {};

  switch (action) {
    case "home": {
      const date = query?.date ?? today;
      const dayAnswers = store.answers.get(date);
      const hasAnswers = !!dayAnswers && dayAnswers.size > 0;
      const isGraded = store.gradedDates.has(date) || store.rejectedDates.has(date);
      const isAcked = store.acknowledgedDates.has(date);
      const isExemptToday = resolveMockExemptDay(date);
      const isLongVacation = resolveMockVacationMode(date);
      const isVacationTransition = resolveMockVacationTransition(date);
      const bedtimeHour = (isVacationTransition
        ? 21
        : store.bedtimeByDate.get(date)) as HomeData["bedtimeHour"];
      const now = Date.now();
      const reopenEarly = store.registrationReopenByDate.get(date);
      const reopenOpenEarly =
        !!reopenEarly &&
        reopenEarly.used &&
        new Date(reopenEarly.endsAt).getTime() > now;
      const pastCutoff = isPastQuestRegistrationCutoff(date, new Date(), bedtimeHour);

      if (isExemptToday) {
        store.missedRegistrationDates.delete(date);
      } else if (reopenOpenEarly) {
        store.missedRegistrationDates.delete(date);
      } else if (
        pastCutoff &&
        !hasAnswers &&
        !store.missedRegistrationDates.has(date)
      ) {
        store.missedRegistrationDates.add(date);
      }

      let todayStatus: HomeData["todayStatus"] = "unanswered";
      let questAction: HomeData["questAction"] = "start";

      if (isExemptToday) {
        todayStatus = "exempt";
        questAction = "none";
      } else if (!hasAnswers) {
        if (reopenOpenEarly) {
          todayStatus = "unanswered";
          questAction = "start";
        } else if (store.missedRegistrationDates.has(date)) {
          todayStatus = isAcked ? "completed" : "pending_ack";
          questAction = "none";
        } else {
          todayStatus = "unanswered";
          questAction = "start";
        }
      } else if (!isGraded) {
        todayStatus = "answered_ungraded";
        questAction = "retry";
      } else if (!isAcked) {
        todayStatus = "pending_ack";
        questAction = "none";
      } else {
        todayStatus = "completed";
        questAction = "none";
      }

      const unacknowledgedCount = countUnacknowledged();
      const timerBlockCount = countTimerBlock();
      const balance = buildBalanceSnapshot();
      const reopen = reopenEarly;
      const registrationReopen = reopen
        ? {
            endsAt: reopen.endsAt,
            setAt: reopen.setAt,
            used: reopen.used,
            isOpen: reopenOpenEarly,
          }
        : null;
      const weekendEve = isWeekendEve(date);
      const childCanEditBedtime =
        !isExemptToday &&
        !isVacationTransition &&
        (weekendEve || isLongVacation) &&
        !hasAnswers &&
        !isGraded;
      const bedtimeEditableUntil = childCanEditBedtime
        ? getChildBedtimeSettingCutoff(date).toISOString()
        : null;

      return {
        ...balance,
        rewardVouchers: normalizeRewardVouchers(store.rewardVouchers),
        today: date,
        todayStatus,
        questAction,
        unacknowledgedCount,
        timerBlockCount,
        canStartTimer:
          balance.displayBalance > 0 &&
          balance.penaltyMinutes === 0 &&
          timerBlockCount === 0,
        bedtimeHour,
        isWeekendEve: weekendEve,
        isLongVacation,
        isVacationTransition,
        vacationPhase: isVacationTransition
          ? "transition"
          : isLongVacation
            ? "active"
            : "none",
        isExemptToday,
        registrationReopen,
        wakePromiseYesterday: null,
        bedtimeEditableUntil,
        questDeadlineAt: null,
        bonusDeadlineAt: null,
        isExemptDay: isExemptToday,
        isVacationMode: isLongVacation,
      } as T;
    }

    case "parentHome": {
      const date = query?.date ?? today;
      const isExemptToday = resolveMockExemptDay(date);
      const isLongVacation = resolveMockVacationMode(date);
      const isVacationTransition = resolveMockVacationTransition(date);
      const bedtimeHour = (isVacationTransition
        ? 21
        : (store.bedtimeByDate.get(date) ?? 21)) as 21 | 22 | 23;
      const hasAnswers = store.answers.has(date);
      const isGraded =
        store.gradedDates.has(date) || store.rejectedDates.has(date);
      const reopen = store.registrationReopenByDate.get(date);
      const now = Date.now();
      const isOpen =
        !!reopen && reopen.used && new Date(reopen.endsAt).getTime() > now;
      const available =
        date === today &&
        !isExemptToday &&
        !hasAnswers &&
        !isGraded &&
        !reopen?.used &&
        isPastQuestRegistrationCutoff(
          date,
          new Date(),
          bedtimeHour,
        );
      let todayRegistrationStatus = "open_unregistered";
      if (isExemptToday) todayRegistrationStatus = "exempt";
      else if (isGraded) todayRegistrationStatus = "graded";
      else if (hasAnswers) todayRegistrationStatus = "registered";
      else if (isOpen) todayRegistrationStatus = "reopen_open";
      else if (
        available ||
        store.missedRegistrationDates.has(date) ||
        isPastQuestRegistrationCutoff(
          date,
          new Date(),
          bedtimeHour,
        )
      ) {
        todayRegistrationStatus = "closed_unregistered";
      }
      return {
        date,
        ungradedCount: [...store.answers.keys()].filter(
          (d) => !store.gradedDates.has(d) && !store.rejectedDates.has(d),
        ).length,
        todayRegistrationStatus,
        registrationReopen: {
          available,
          used: reopen?.used ?? false,
          endsAt: reopen?.endsAt ?? null,
          setAt: reopen?.setAt ?? null,
          isOpen,
        },
        isExemptToday,
        isLongVacation,
        isVacationTransition,
        vacationPhase: isVacationTransition
          ? "transition"
          : isLongVacation
            ? "active"
            : "none",
        longVacation: {
          startDate: store.longVacation.startDate,
          endDate: store.longVacation.endDate,
          active: isLongVacation,
        },
        bedtimeHour,
        canEditBedtimeAsParent:
          !isExemptToday &&
          !isVacationTransition &&
          !hasAnswers &&
          !isGraded &&
          (isWeekendEve(date) || isLongVacation),
        questDeadlineAt: null,
        rewardVouchers: normalizeRewardVouchers(store.rewardVouchers),
        ...buildBalanceSnapshot(),
      } as T;
    }

    case "registrationSetting": {
      const { date, bedtimeHour, actor } = body as {
        date: string;
        bedtimeHour: number;
        actor?: string;
      };
      if (actor !== "child" && actor !== "parent") {
        throw new Error(
          `BAD_REQUEST: actor は child または parent が必須です actor=${String(actor)}`,
        );
      }
      if (!isValidOptionalBedtimeHour(bedtimeHour) || bedtimeHour === undefined) {
        throw new Error(
          `BAD_REQUEST: bedtimeHour が不正です bedtimeHour=${String(bedtimeHour)}`,
        );
      }
      const isExemptDay = resolveMockExemptDay(date);
      const isVacationMode = resolveMockVacationMode(date);
      const isWeekendEveDay = isWeekendEve(date);
      const isTransitionPeriod = resolveMockVacationTransition(date);
      if (isExemptDay) {
        throw new Error("FORBIDDEN_STATE: 免除日は bedtimeHour を設定できません");
      }
      if (isTransitionPeriod) {
        throw new Error(
          "FORBIDDEN_STATE: 移行期間中は就寝時刻が21時固定のため設定できません",
        );
      }
      if (actor === "child") {
        if (!isWeekendEveDay && !isVacationMode) {
          throw new Error(
            "FORBIDDEN_STATE: 休日前日または長期休み（18時まで）のみ bedtimeHour を設定できます",
          );
        }
        if (
          !canChildSaveBedtime({
            isExemptDay,
            isVacationMode,
            isWeekendEveDay,
            date,
          })
        ) {
          throw new Error(
            "FORBIDDEN_STATE: 18時を過ぎているため子どもは bedtimeHour を設定できません",
          );
        }
      }
      if (actor === "parent" && !isWeekendEveDay && !isVacationMode) {
        throw new Error("FORBIDDEN_STATE: 対象日でないため設定できません");
      }
      if (actor === "parent") {
        const now = new Date();
        const hour = now.getHours();
        if (hour >= bedtimeHour - 1) {
          throw new Error(
            `FORBIDDEN_STATE: 保護者は就寝1時間前までしか変更できません bedtimeHour=${bedtimeHour}`,
          );
        }
      }
      if (store.missedRegistrationDates.has(date) || store.gradedDates.has(date)) {
        throw new Error("ALREADY_RESULT: 結果作成済みのため設定できません");
      }
      if (store.answers.has(date) || store.submittedAtByDate.has(date)) {
        throw new Error("ALREADY_ANSWERED: 回答後は就寝時刻を変更できません");
      }
      store.bedtimeByDate.set(date, bedtimeHour);
      const setAt = new Date().toISOString();
      return { date, bedtimeHour, actor, setAt } as T;
    }

    case "registrationReopen": {
      const { date, endsAt } = body as { date: string; endsAt: string };
      if (date !== today) {
        throw new Error("BAD_REQUEST: 再開は当日のみ設定できます");
      }
      if (resolveMockExemptDay(date)) {
        throw new Error("FORBIDDEN_STATE: 免除日は再開できません");
      }
      if (store.registrationReopenByDate.get(date)?.used) {
        throw new Error("ALREADY_USED: 再開 CTA は当日1回です");
      }
      if (store.answers.has(date)) {
        throw new Error("ALREADY_ANSWERED: 回答後は再開できません");
      }
      const setAt = new Date().toISOString();
      store.registrationReopenByDate.set(date, { endsAt, setAt, used: true });
      store.missedRegistrationDates.delete(date);
      return { date, endsAt, setAt, used: true } as T;
    }

    case "answers": {
      const { date, answers, bedtimeHour, wakePromise, wakeUpTime } = body as {
        date: string;
        answers: { questId: string; childAnswer: ChildAnswer }[];
        bedtimeHour?: number;
        wakePromise?: { wakeTime: WakeUpTime };
        wakeUpTime?: WakeUpTime;
      };
      validateMockAnswers(answers);
      if (!isValidOptionalBedtimeHour(bedtimeHour)) {
        throw new Error(
          `BAD_REQUEST: bedtimeHour が不正です bedtimeHour=${String(bedtimeHour)}`,
        );
      }
      if (resolveMockExemptDay(date)) {
        throw new Error("FORBIDDEN_STATE: 免除日は回答を登録できません");
      }
      const isVacationMode = resolveMockVacationMode(date);
      const isTransitionPeriod = resolveMockVacationTransition(date);
      if (
        bedtimeHour !== undefined &&
        bedtimeHour !== 21 &&
        !isWeekendEve(date) &&
        !isVacationMode
      ) {
        throw new Error(
          "BAD_REQUEST: 休日前日・長期休み以外は bedtimeHour を変更できません",
        );
      }
      if (isTransitionPeriod && bedtimeHour !== undefined && bedtimeHour !== 21) {
        throw new Error(
          "BAD_REQUEST: 移行期間中は bedtimeHour を21時以外に変更できません",
        );
      }
      if (store.gradedDates.has(date) || store.rejectedDates.has(date)) {
        throw new Error("ALREADY_GRADED: 採点済みのため上書きできません");
      }
      const savedHour = store.bedtimeByDate.get(date);
      const hour = savedHour ?? bedtimeHour;
      const existingAnswers = store.answers.get(date);
      const isNewRegistration = !existingAnswers;
      const reopen = store.registrationReopenByDate.get(date);
      const reopenOpen =
        !!reopen &&
        reopen.used &&
        new Date(reopen.endsAt).getTime() > Date.now();
      if (isNewRegistration) {
        if (
          (store.missedRegistrationDates.has(date) ||
            store.gradedDates.has(date)) &&
          !reopenOpen
        ) {
          throw new Error(
            "ALREADY_RESULT: 結果作成済みのため回答を保存できません",
          );
        }
        if (!reopenOpen) {
          if (isBeforeQuestRegistrationStart(date, new Date(), hour)) {
            throw new Error(
              "BAD_REQUEST: 登録受付開始前のため回答を保存できません",
            );
          }
          if (isPastQuestRegistrationCutoff(date, new Date(), hour)) {
            throw new Error(
              "BAD_REQUEST: 登録受付締切を過ぎているため回答を保存できません",
            );
          }
        }
      } else {
        validateMockRetryImmutableAnswers(existingAnswers, answers);
      }
      const map = new Map<string, ChildAnswer>();
      for (const a of answers) map.set(a.questId, a.childAnswer);
      const submittedAt =
        store.submittedAtByDate.get(date) ?? new Date().toISOString();
      store.answers.set(date, map);
      store.submittedAtByDate.set(date, submittedAt);
      store.missedRegistrationDates.delete(date);
      store.bedtimeByDate.set(
        date,
        savedHour ?? resolveQuestDeadlineBedtimeHour(date, bedtimeHour),
      );
      const vacationPeriod =
        store.longVacation.startDate && store.longVacation.endDate
          ? {
              startDate: store.longVacation.startDate,
              endDate: store.longVacation.endDate,
            }
          : null;
      const isVacationFinalDayBeforeWeekday = isLongVacationFinalDayBeforeWeekday(
        date,
        vacationPeriod,
      );
      const wake = wakePromise?.wakeTime ?? wakeUpTime;
      if (isVacationFinalDayBeforeWeekday) {
        // Functions と同じ: 最終日（翌日平日）は wakePromise 拒否・07:15 自動設定
        if (wake !== undefined) {
          throw new Error(
            `BAD_REQUEST: 長期休み最終日（翌日平日）は wakePromise を送れません ` +
              `(date=${date}, wakeTime=${String(wake)})`,
          );
        }
        store.wakeUpByDate.set(date, AUTO_WAKE_TIME_VACATION_LAST_DAY);
      } else if (wake) {
        // 移行期間中は 07:00 / 07:30 / 08:00 の3値のみ許可（Issue #36）
        const isVacationTransitionForWrite = isVacationTransitionPeriod(
          date,
          vacationPeriod,
        );
        if (
          isVacationTransitionForWrite &&
          !(resolveWakeUpOptions(true) as string[]).includes(wake)
        ) {
          throw new Error(
            `BAD_REQUEST: 移行期間中の wakePromise.wakeTime が不正です wakeTime=${wake}`,
          );
        }
        store.wakeUpByDate.set(date, wake);
      }
      return {
        submittedAt,
        overwritten: !isNewRegistration,
      } as T;
    }

    case "gradeDates": {
      const dates = new Set<string>([
        ...store.answers.keys(),
        ...store.gradedDates,
        ...store.rejectedDates,
      ]);
      const list = [...dates].sort().reverse().map((date) => {
        const hasAnswers = store.answers.has(date);
        const isExempt = resolveMockExemptDay(date);
        const isRejected = store.rejectedDates.has(date);
        const isGraded = store.gradedDates.has(date) || isRejected;
        return {
          date,
          status: isExempt
            ? ("exempt" as const)
            : !hasAnswers
              ? ("unanswered" as const)
              : isGraded
                ? ("graded" as const)
                : ("ungraded" as const),
          ungradedCount: hasAnswers && !isGraded ? 1 : 0,
          totalPoints: isGraded
            ? isRejected
              ? MISSED_REGISTRATION_PENALTY
              : calcMockTotalPoints(date)
            : null,
          reasonCode: isRejected
            ? ("grade_rejected" as const)
            : isGraded
              ? ("normal" as const)
              : isExempt
                ? ("exempt" as const)
                : null,
          isExempt,
        };
      });
      return { dates: list } as T;
    }

    case "grade": {
      if (init?.method === "POST") {
        const { date, grades, adjustments } = body as {
          date: string;
          grades?: { questId: string; actualDone: boolean }[];
          adjustments?: GradeAdjustment[];
        };
        if (store.gradedDates.has(date) || store.rejectedDates.has(date)) {
          throw new Error("ALREADY_GRADED: 再採点はできません");
        }
        if (resolveMockExemptDay(date)) {
          throw new Error("FORBIDDEN_STATE: 免除日は採点できません");
        }
        validateMockGrades(date, grades);
        validateMockAdjustments(adjustments ?? []);
        store.gradedDates.add(date);
        store.grades.set(
          date,
          new Map((grades ?? []).map((g) => [g.questId, g.actualDone])),
        );
        if (adjustments?.length) {
          store.adjustmentsByDate.set(date, adjustments);
        }
        const gradedAt = new Date().toISOString();
        store.gradingRevisionByDate.set(date, 1);
        store.originalGradedAtByDate.set(date, gradedAt);
        store.lastCorrectedAtByDate.set(date, "");
        return {
          gradedAt,
          totalPoints: calcMockTotalPoints(date),
          reasonCode: "normal",
        } as T;
      }
      const date = query?.date ?? today;
      const dayAnswers = store.answers.get(date);
      if (!dayAnswers) {
        throw new Error("NOT_FOUND: 回答がありません");
      }
      const alreadyGraded =
        store.gradedDates.has(date) || store.rejectedDates.has(date);
      const items = [...dayAnswers.entries()].map(([questId, childAnswer]) => ({
        questId,
        childAnswer,
        actualDone: store.grades.get(date)?.get(questId) ?? null,
        gradingMode: mockGradingModeForChildAnswer(questId, childAnswer),
        autoOutcome: null,
      }));
      const withinBonusWindow = !isPastQuestBonusDeadline(
        date,
        new Date(),
        store.bedtimeByDate.get(date),
      );
      const reasonCode = store.rejectedDates.has(date)
        ? ("grade_rejected" as const)
        : alreadyGraded
          ? ("normal" as const)
          : null;
      return {
        date,
        submittedAt: store.submittedAtByDate.get(date) ?? null,
        withinBonusWindow,
        isExempt: resolveMockExemptDay(date),
        alreadyGraded,
        reasonCode,
        gradingRevision: alreadyGraded
          ? (store.gradingRevisionByDate.get(date) ?? 1)
          : 0,
        originalGradedAt: alreadyGraded
          ? (store.originalGradedAtByDate.get(date) ?? "")
          : "",
        lastCorrectedAt: store.lastCorrectedAtByDate.get(date) ?? "",
        acknowledged: store.acknowledgedDates.has(date),
        canCorrect:
          alreadyGraded &&
          !resolveMockExemptDay(date) &&
          date >= POINTS_CUTOVER_DATE,
        cannotCorrectReason: !alreadyGraded
          ? ("NOT_GRADED" as const)
          : resolveMockExemptDay(date)
            ? ("EXEMPT" as const)
            : date < POINTS_CUTOVER_DATE
              ? ("LEGACY_RESULT" as const)
              : null,
        items,
        adjustments: store.adjustmentsByDate.get(date) ?? [],
        isGraded: alreadyGraded,
        isRejected: store.rejectedDates.has(date),
        withinBonusDeadline: withinBonusWindow,
      } as T;
    }

    case "gradeReject": {
      const { date } = body as { date: string };
      if (!store.answers.has(date)) {
        throw new Error("BAD_REQUEST: 回答がありません");
      }
      if (store.gradedDates.has(date) || store.rejectedDates.has(date)) {
        throw new Error("ALREADY_GRADED: 採点済みです");
      }
      if (resolveMockExemptDay(date)) {
        throw new Error("FORBIDDEN_STATE: 免除日は拒否できません");
      }
      store.rejectedDates.add(date);
      const gradedAt = new Date().toISOString();
      store.gradingRevisionByDate.set(date, 1);
      store.originalGradedAtByDate.set(date, gradedAt);
      store.lastCorrectedAtByDate.set(date, "");
      return {
        reasonCode: "grade_rejected",
        totalPoints: MISSED_REGISTRATION_PENALTY,
        gradedAt,
      } as T;
    }

    case "gradeCorrection": {
      const payload = body as GradeCorrectionPayload;
      const normalizedPayload = normalizeMockGradeCorrectionPayload(payload);
      const prior = store.gradeCorrectionLogs.get(payload.correctionId);
      if (prior) {
        if (prior.normalizedPayload !== normalizedPayload) {
          throw new Error("IDEMPOTENCY_CONFLICT: correctionId が別の修正に使用済みです");
        }
        return prior.response as T;
      }
      if (!UUID_PATTERN.test(payload.correctionId ?? "")) {
        throw new Error("BAD_REQUEST: correctionId は UUID が必要です");
      }
      if (payload.date < POINTS_CUTOVER_DATE) {
        throw new Error("LEGACY_RESULT_NOT_CORRECTABLE: 切替日前の結果は修正できません");
      }
      if (resolveMockExemptDay(payload.date)) {
        throw new Error("FORBIDDEN_STATE: 免除日は修正できません");
      }
      if (!store.gradedDates.has(payload.date) && !store.rejectedDates.has(payload.date)) {
        throw new Error("FORBIDDEN_STATE: 未採点の結果は修正できません");
      }
      const revision = store.gradingRevisionByDate.get(payload.date) ?? 1;
      if (payload.expectedRevision !== revision) {
        throw new Error("STALE_GRADE_REVISION: 採点結果が更新されています");
      }
      if (payload.resultType === "normal") {
        validateMockGrades(payload.date, payload.grades);
        validateMockAdjustments(payload.adjustments ?? []);
      } else if (payload.resultType === "grade_rejected") {
        if (payload.grades !== undefined || payload.adjustments !== undefined) {
          throw new Error("BAD_REQUEST: 採点拒否では grades / adjustments を送信できません");
        }
      } else {
        throw new Error("BAD_REQUEST: resultType が不正です");
      }

      const currentType = store.rejectedDates.has(payload.date)
        ? "grade_rejected"
        : "normal";
      const currentGrades = [...(store.grades.get(payload.date) ?? new Map())].sort(
        ([left], [right]) => left.localeCompare(right),
      );
      const nextGrades = (payload.grades ?? [])
        .map((grade) => [grade.questId, grade.actualDone] as const)
        .sort(([left], [right]) => left.localeCompare(right));
      const currentKnownAdjustments = (store.adjustmentsByDate.get(payload.date) ?? []).filter(
        (adjustment) =>
          adjustmentDefinitions.items.some((definition) => definition.code === adjustment.code),
      ).sort((left, right) => left.code.localeCompare(right.code));
      const nextAdjustments = [...(payload.adjustments ?? [])].sort((left, right) =>
        left.code.localeCompare(right.code),
      );
      if (
        currentType === payload.resultType &&
        JSON.stringify(currentGrades) === JSON.stringify(nextGrades) &&
        JSON.stringify(currentKnownAdjustments) === JSON.stringify(nextAdjustments)
      ) {
        throw new Error("NO_CHANGES: 採点内容に変更がありません");
      }

      const unknownExisting = (store.adjustmentsByDate.get(payload.date) ?? []).filter(
        (adjustment) =>
          !adjustmentDefinitions.items.some(
            (definition) => definition.code === adjustment.code,
          ),
      );
      const nextStoredAdjustments = payload.resultType === "normal"
        ? [...(payload.adjustments ?? []), ...unknownExisting]
        : [];
      const totalsBefore = replayMockTotals();
      const totalsAfter = replayMockTotals({
        date: payload.date,
        resultType: payload.resultType,
        grades: new Map(nextGrades),
        adjustments: nextStoredAdjustments,
      });
      const targetOrder = store.originalGradedAtByDate.get(payload.date) ?? "";
      const affectedDates = [...new Set([...totalsBefore.keys(), ...totalsAfter.keys()])]
        .filter((date) => {
          const order = store.originalGradedAtByDate.get(date) ?? "";
          const isAfterTarget =
            order > targetOrder || (order === targetOrder && date >= payload.date);
          return isAfterTarget &&
            (date === payload.date ||
              totalsBefore.get(date)?.signature !== totalsAfter.get(date)?.signature);
        })
        .sort((left, right) => {
          const leftTime = store.originalGradedAtByDate.get(left) ?? "";
          const rightTime = store.originalGradedAtByDate.get(right) ?? "";
          return leftTime.localeCompare(rightTime) || left.localeCompare(right);
        });
      if (affectedDates.length > 450) {
        throw new Error("CORRECTION_TOO_LARGE: 影響日が450件を超えています");
      }

      const resetAcknowledgementDates: string[] = [];
      for (const date of affectedDates) {
        if (!store.acknowledgedDates.has(date)) continue;
        store.balancePoints -= store.appliedDeltaByDate.get(date) ?? 0;
        store.acknowledgedDates.delete(date);
        store.appliedDeltaByDate.delete(date);
        resetAcknowledgementDates.push(date);
      }
      if (payload.resultType === "grade_rejected") {
        store.gradedDates.delete(payload.date);
        store.rejectedDates.add(payload.date);
        store.grades.delete(payload.date);
        store.adjustmentsByDate.delete(payload.date);
      } else {
        store.rejectedDates.delete(payload.date);
        store.gradedDates.add(payload.date);
        store.grades.set(payload.date, new Map(nextGrades));
        store.adjustmentsByDate.set(payload.date, nextStoredAdjustments);
      }
      const correctedAt = new Date().toISOString();
      const nextRevision = revision + 1;
      store.originalGradedAtByDate.set(
        payload.date,
        store.originalGradedAtByDate.get(payload.date) ?? correctedAt,
      );
      for (const date of affectedDates) {
        store.gradingRevisionByDate.set(
          date,
          (store.gradingRevisionByDate.get(date) ?? 1) + 1,
        );
        store.lastCorrectedAtByDate.set(date, correctedAt);
      }
      const response: GradeCorrectionResult = {
        revision: nextRevision,
        reasonCode: payload.resultType,
        totalPoints:
          payload.resultType === "grade_rejected"
            ? MISSED_REGISTRATION_PENALTY
            : (totalsAfter.get(payload.date)?.totalPoints ??
              calcMockTotalPoints(payload.date)),
        correctedAt,
        affectedDates,
        resetAcknowledgementDates,
        balancePoints: store.balancePoints,
      };
      store.gradeCorrectionLogs.set(payload.correctionId, {
        normalizedPayload,
        response,
      });
      return response as T;
    }

    case "longVacation": {
      if (init?.method === "POST") {
        const { startDate, endDate } = body as {
          startDate: string;
          endDate: string;
        };
        if ((startDate === "") !== (endDate === "")) {
          throw new Error(
            "BAD_REQUEST: startDate/endDate は両方空か両方必須です",
          );
        }
        if (startDate && endDate && startDate > endDate) {
          throw new Error("BAD_REQUEST: startDate > endDate です");
        }
        const updatedAt = new Date().toISOString();
        store.longVacation = { startDate, endDate, updatedAt };
        return {
          startDate,
          endDate,
          updatedAt,
          active:
            !!startDate &&
            !!endDate &&
            isDateInInclusiveRange(today, startDate, endDate),
          vacationPhase: resolveMockVacationPhase(today),
        } as T;
      }
      const { startDate, endDate, updatedAt } = store.longVacation;
      return {
        startDate,
        endDate,
        updatedAt,
        active:
          !!startDate &&
          !!endDate &&
          isDateInInclusiveRange(today, startDate, endDate),
        vacationPhase: resolveMockVacationPhase(today),
      } as T;
    }

    case "questExemptions": {
      if (init?.method === "POST") {
        const op = (body as { op?: string }).op;
        const beforeDates = collectExemptDatesFromPeriods(store.exemptionPeriods);
        if (op === "add") {
          const { startDate, endDate } = body as {
            startDate: string;
            endDate: string;
          };
          const exists = store.exemptionPeriods.some(
            (p) => p.startDate === startDate && p.endDate === endDate,
          );
          if (!exists) {
            store.exemptionPeriods.push({
              startDate,
              endDate,
              createdAt: new Date().toISOString(),
            });
          }
        } else if (op === "remove") {
          const { startDate, endDate } = body as {
            startDate: string;
            endDate: string;
          };
          const before = store.exemptionPeriods.length;
          store.exemptionPeriods = store.exemptionPeriods.filter(
            (p) => !(p.startDate === startDate && p.endDate === endDate),
          );
          if (store.exemptionPeriods.length === before) {
            throw new Error("NOT_FOUND: 免除期間が見つかりません");
          }
        } else if (op === "updateEnd") {
          const { startDate, endDate, newEndDate } = body as {
            startDate: string;
            endDate: string;
            newEndDate: string;
          };
          const target = store.exemptionPeriods.find(
            (p) => p.startDate === startDate && p.endDate === endDate,
          );
          if (!target) {
            throw new Error("NOT_FOUND: 免除期間が見つかりません");
          }
          target.endDate = newEndDate;
        } else if (op === "replace") {
          const { periods } = body as {
            periods: Array<{
              startDate: string;
              endDate: string;
              createdAt?: string;
            }>;
          };
          store.exemptionPeriods = (periods ?? []).map((p) => ({
            startDate: p.startDate,
            endDate: p.endDate,
            createdAt: p.createdAt ?? new Date().toISOString(),
          }));
        } else {
          throw new Error(`BAD_REQUEST: op が不正です op=${String(op)}`);
        }
        const afterDates = collectExemptDatesFromPeriods(store.exemptionPeriods);
        const newlyCovered: string[] = [];
        const uncovered: string[] = [];
        for (const date of afterDates) {
          if (!beforeDates.has(date)) newlyCovered.push(date);
        }
        for (const date of beforeDates) {
          if (!afterDates.has(date)) uncovered.push(date);
        }
        const covered = applyExemptionCoverage(newlyCovered);
        const uncoveredResult = applyExemptionUncover(uncovered);
        return {
          periods: store.exemptionPeriods,
          updatedAt: new Date().toISOString(),
          changedDates: [...covered.changedDates, ...uncoveredResult.changedDates],
          skippedDates: [...covered.skippedDates, ...uncoveredResult.skippedDates],
        } as T;
      }
      return {
        periods: store.exemptionPeriods,
        updatedAt: new Date().toISOString(),
      } as T;
    }

    case "results": {
      const replayed = replayMockTotals();
      const gradedItems = [...store.gradedDates].map((date) => {
        const dayAnswers =
          store.answers.get(date) ?? new Map<string, ChildAnswer>();
        const adjustments = (store.adjustmentsByDate.get(date) ?? []).map(
          (a) => ({
            kind: a.kind,
            code: a.code,
            label: a.code,
            points: a.kind === "bonus" ? a.points : -a.points,
          }),
        );
        const registrationTimingAdjustment =
          calcMockRegistrationTimingAdjustment(date);
        const registrationTimingReason = describeMockRegistrationTimingReason(
          date,
          registrationTimingAdjustment,
        );
        const bedtimePrepPenalty = calcMockBedtimePrepPenalty(date);
        const perfectBonus = calcMockFullAchievementBonus(date);
        const adjustmentsSum = sumMockAdjustments(date);
        const scoring = replayed.get(date);
        const totalPoints = scoring?.totalPoints ?? calcMockTotalPoints(date);
        const details = (scoring?.gradeDetails ?? []).map((detail) => {
            const childAnswer = dayAnswers.get(detail.questId) ?? -1;
            return {
              questId: detail.questId,
              childAnswer,
              actualDone: detail.actualDone,
              finalPoints: detail.finalPoints,
              mismatch: isMockMismatch(childAnswer, detail.actualDone),
              streakMultiplier: detail.multiplier,
              failureStreakAfter: detail.streakAfter.failure,
              category: detail.category,
              gradingMode: mockGradingModeForChildAnswer(
                detail.questId,
                childAnswer,
              ),
            };
          });
        const acknowledged = store.acknowledgedDates.has(date);
        return {
          date,
          totalPoints,
          acknowledged,
          reasonCode: "normal" as const,
          breakdown: {
            questPoints: scoring?.questPoints ?? 0,
            onTimeBonus: Math.max(0, registrationTimingAdjustment),
            perfectBonus,
            adjustmentsSum,
            bedtimePrepPenalty,
          },
          registrationTimingAdjustment,
          registrationTimingReason,
          bedtimePrepPenalty,
          bedtimePrepPenaltyReason:
            bedtimePrepPenalty !== 0
              ? `寝る準備の虚偽ペナルティ ${bedtimePrepPenalty}pt`
              : undefined,
          adjustments,
          details,
          requiresAck: true,
          blocksTimer: !acknowledged,
        };
      });
      const rejectedItems = [...store.rejectedDates].map((date) => ({
        date,
        totalPoints: MISSED_REGISTRATION_PENALTY,
        acknowledged: store.acknowledgedDates.has(date),
        reasonCode: "grade_rejected" as const,
        registrationTimingAdjustment: 0,
        adjustments: [],
        details: [],
        requiresAck: true,
        blocksTimer: !store.acknowledgedDates.has(date),
      }));
      const exemptDateSet = new Set(collectMockExemptDatesForResults());
      const missedItems = [...store.missedRegistrationDates]
        .filter((date) => !exemptDateSet.has(date))
        .map((date) => ({
          date,
          totalPoints: MISSED_REGISTRATION_PENALTY,
          acknowledged: store.acknowledgedDates.has(date),
          reasonCode: "unregistered" as const,
          registrationTimingAdjustment: MISSED_REGISTRATION_PENALTY,
          registrationTimingReason: `登録締切までにクエストを登録しなかったため ${MISSED_REGISTRATION_PENALTY}pt`,
          adjustments: [],
          details: [],
          requiresAck: true,
          blocksTimer: false,
        }));
      const occupied = new Set([
        ...store.gradedDates,
        ...store.rejectedDates,
        ...[...store.missedRegistrationDates].filter(
          (date) => !exemptDateSet.has(date),
        ),
      ]);
      const exemptItems = [...exemptDateSet]
        .filter((date) => !occupied.has(date))
        .map((date) => ({
          date,
          totalPoints: 0,
          acknowledged: true,
          reasonCode: "exempt" as const,
          registrationTimingAdjustment: 0,
          adjustments: [],
          details: [],
          requiresAck: false,
          blocksTimer: false,
        }));
      return {
        items: [...gradedItems, ...rejectedItems, ...missedItems, ...exemptItems],
      } as T;
    }

    case "resultsAck": {
      const { date } = body as { date: string };
      if (resolveMockExemptDay(date)) {
        throw new Error("FORBIDDEN_STATE: 免除日の結果は確認不要です");
      }
      if (
        !store.gradedDates.has(date) &&
        !store.missedRegistrationDates.has(date) &&
        !store.rejectedDates.has(date)
      ) {
        throw new Error("NOT_FOUND: 結果がありません");
      }
      if (store.acknowledgedDates.has(date)) {
        throw new Error("ALREADY_ACKNOWLEDGED: 確認済みです");
      }
      const delta =
        store.rejectedDates.has(date) || store.missedRegistrationDates.has(date)
          ? MISSED_REGISTRATION_PENALTY
          : calcMockTotalPoints(date);
      // ADR-005: resultsAck はポイントだけを更新する（Switch時間・タイマー負債は不変）。
      // ADR-006: balancePoints は負を許容するため0止めしない。
      const pointsBefore = store.balancePoints;
      store.acknowledgedDates.add(date);
      store.balancePoints = store.balancePoints + delta;
      const appliedDelta = store.balancePoints - pointsBefore;
      store.appliedDeltaByDate.set(date, appliedDelta);
      return {
        appliedDelta,
        penaltyOffset: 0,
        ...buildBalanceSnapshot(),
      } as T;
    }

    case "dailyQuests": {
      const date = query?.date;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("BAD_REQUEST: date が必要です（YYYY-MM-DD）");
      }
      return {
        date,
        version: daily.version,
        generationMode: "fixed_seed",
        quests: daily.quests,
      } as T;
    }

    case "timerStop": {
      const { usedMinutes, overrunMinutes } = body as {
        usedMinutes: number;
        overrunMinutes: number;
      };
      // ADR-005: timerStop は switchMinutes とタイマー負債だけを更新する。0未満にはしない。
      store.switchMinutes = Math.max(0, store.switchMinutes - usedMinutes);
      store.penaltyMinutes += Math.max(0, overrunMinutes);
      return buildBalanceSnapshot() as T;
    }

    case "penaltyTicketIssue": {
      const { count, actor } = body as { count?: number; actor?: string };
      if (actor !== "parent") {
        throw new Error(
          `BAD_REQUEST: penaltyTicketIssue.actor は parent が必須です actor=${String(actor)}`,
        );
      }
      if (
        typeof count !== "number" ||
        !Number.isInteger(count) ||
        count < 1
      ) {
        throw new Error(
          `BAD_REQUEST: penaltyTicketIssue.count は1以上の整数が必要です count=${String(count)}`,
        );
      }
      const pointDebtBefore = calcPointDebt(store.balancePoints);
      const issuable = calcIssuableTicketCount(store.balancePoints);
      if (pointDebtBefore < PENALTY_TICKET_POINTS || issuable < 1) {
        throw new Error(
          `FORBIDDEN_STATE: ポイント負債が100pt未満のため発行できません balancePoints=${store.balancePoints}`,
        );
      }
      if (count > issuable) {
        throw new Error(
          `BAD_REQUEST: 発行枚数が発行可能数を超えています count=${count} issuable=${issuable}`,
        );
      }

      const settledPoints = count * PENALTY_TICKET_POINTS;
      store.balancePoints += settledPoints;
      store.penaltyTicketCount += count;

      const after = buildBalanceSnapshot();
      return {
        ticketId: `mock-penalty-ticket-${Date.now()}-${count}`,
        count,
        settledPoints,
        pointDebtBefore,
        pointDebtAfter: calcPointDebt(after.balancePoints),
        balancePoints: after.balancePoints,
        displayBalance: after.displayBalance,
        switchMinutes: after.switchMinutes,
        penaltyMinutes: after.penaltyMinutes,
        issuablePenaltyTicketCount: after.issuablePenaltyTicketCount,
        penaltyTicketCount: after.penaltyTicketCount,
      } as T;
    }

    case "penaltyTicketConsume": {
      const { actor } = body as { actor?: string };
      if (actor !== "parent") {
        throw new Error(
          `BAD_REQUEST: penaltyTicketConsume.actor は parent が必須です actor=${String(actor)}`,
        );
      }
      if (store.penaltyTicketCount < 1) {
        throw new Error(
          `FORBIDDEN_STATE: 在庫チケットがないため消費できません penaltyTicketCount=${store.penaltyTicketCount}`,
        );
      }
      store.penaltyTicketCount -= 1;
      return {
        ticketId: `mock-penalty-ticket-consume-${Date.now()}`,
        penaltyTicketCount: store.penaltyTicketCount,
      } as T;
    }

    case "pointExchangeRequests": {
      if (init?.method === "POST") {
        const { items } = body as {
          items?: { catalogItemId: string; quantity: number }[];
        };
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error("BAD_REQUEST: items は1件以上必要です");
        }
        for (const item of items) {
          if (
            !item ||
            typeof item.catalogItemId !== "string" ||
            typeof item.quantity !== "number" ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1
          ) {
            throw new Error(
              `BAD_REQUEST: items の形式が不正です item=${JSON.stringify(item)}`,
            );
          }
        }
        let totals: ReturnType<typeof calcExchangeTotals>;
        try {
          totals = calcExchangeTotals(items);
        } catch (cause) {
          const reason = cause instanceof Error ? cause.message : String(cause);
          throw new Error(`BAD_REQUEST: ${reason}`);
        }
        const { lineItems, totalPoints, issuedRewardVouchers, consumedPenaltyTickets } =
          totals;
        if (totalPoints <= 0) {
          throw new Error("BAD_REQUEST: totalPoints は1以上が必要です");
        }
        // ADR-006 / 契約 T10a: balancePoints は負を許容するため、申請時点の残高不足だけでは拒否しない。
        store.pointExchangeSeq += 1;
        const id = `pex_mock_${Date.now()}_${store.pointExchangeSeq}`;
        const requestedAt = new Date().toISOString();
        const request: PointExchangeRequest = {
          id,
          status: "pending",
          requestedAt,
          decidedAt: "",
          items: lineItems,
          totalPoints,
          effects: {
            spentPoints: totalPoints,
            issuedRewardVouchers,
            consumedPenaltyTickets,
          },
          rejectReason: "",
        };
        store.pointExchangeRequests.set(id, request);
        return {
          id,
          status: "pending",
          totalPoints,
          balancePoints: store.balancePoints,
        } as T;
      }

      const month = query?.month;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        throw new Error("BAD_REQUEST: month が必要です（YYYY-MM）");
      }
      const statusFilter = query?.status as PointExchangeStatus | undefined;
      if (
        statusFilter !== undefined &&
        statusFilter !== "pending" &&
        statusFilter !== "approved" &&
        statusFilter !== "rejected"
      ) {
        throw new Error(`BAD_REQUEST: status が不正です status=${statusFilter}`);
      }
      const list = [...store.pointExchangeRequests.values()]
        .filter((r) => toMonth(r.requestedAt.slice(0, 10)) === month)
        .filter((r) => !statusFilter || r.status === statusFilter)
        .sort(comparePointExchangeRequests);
      return { month, items: list } as T;
    }

    case "pointExchangeDecision": {
      const { id, decision, rejectReason } = body as {
        id?: string;
        decision?: string;
        rejectReason?: string;
      };
      if (!id) {
        throw new Error("BAD_REQUEST: id が必要です");
      }
      const request = store.pointExchangeRequests.get(id);
      if (!request) {
        throw new Error(`NOT_FOUND: 申請が見つかりません id=${id}`);
      }
      if (request.status !== "pending") {
        throw new Error(
          `FORBIDDEN_STATE: pending 以外は決定できません id=${id}, status=${request.status}`,
        );
      }
      if (decision !== "approve" && decision !== "reject") {
        throw new Error(
          `BAD_REQUEST: decision が不正です decision=${String(decision)}`,
        );
      }
      if (decision === "reject") {
        request.status = "rejected";
        request.decidedAt = new Date().toISOString();
        request.rejectReason = rejectReason ?? "";
        return {
          id,
          status: "rejected",
          balancePoints: store.balancePoints,
        } as T;
      }
      // ADR-006 / 契約 T10b: 承認はポイント不足では拒否しない（負残高化を許容）。
      // penaltyTicketCount 不足だけは承認時点で再検証する。
      if (
        request.effects.consumedPenaltyTickets > 0 &&
        store.penaltyTicketCount < request.effects.consumedPenaltyTickets
      ) {
        throw new Error(
          `FORBIDDEN_STATE: ペナルティチケットの在庫が不足しているため承認できません id=${id}, penaltyTicketCount=${store.penaltyTicketCount}`,
        );
      }
      store.balancePoints -= request.totalPoints;
      for (const [voucherId, quantity] of Object.entries(
        request.effects.issuedRewardVouchers,
      )) {
        if (!quantity) continue;
        const key = voucherId as RewardVoucherCatalogItemId;
        store.rewardVouchers[key] = (store.rewardVouchers[key] ?? 0) + quantity;
      }
      store.penaltyTicketCount -= request.effects.consumedPenaltyTickets;
      request.status = "approved";
      request.decidedAt = new Date().toISOString();
      return {
        id,
        status: "approved",
        spentPoints: request.totalPoints,
        balancePoints: store.balancePoints,
        rewardVouchers: normalizeRewardVouchers(store.rewardVouchers),
        penaltyTicketCount: store.penaltyTicketCount,
      } as T;
    }

    case "switchTicketRedeem": {
      const { catalogItemId } = body as { catalogItemId?: string };
      if (catalogItemId !== "switch-30" && catalogItemId !== "switch-60") {
        throw new Error(
          `BAD_REQUEST: catalogItemId は switch-30 または switch-60 が必要です catalogItemId=${String(catalogItemId)}`,
        );
      }
      const key = catalogItemId as SwitchTicketCatalogItemId;
      if ((store.rewardVouchers[key] ?? 0) < 1) {
        throw new Error(
          `FORBIDDEN_STATE: 対象の券がありません catalogItemId=${catalogItemId}`,
        );
      }
      store.rewardVouchers[key] -= 1;
      const redeemedMinutes = SWITCH_TICKET_MINUTES[key];
      store.switchMinutes += redeemedMinutes;
      return {
        catalogItemId,
        redeemedMinutes,
        switchMinutes: store.switchMinutes,
        rewardVouchers: normalizeRewardVouchers(store.rewardVouchers),
      } as T;
    }

    case "rewardVoucherConsumptions": {
      if (init?.method === "POST") {
        const { operationId, items } = body as {
          operationId?: string;
          items?: Array<{ catalogItemId: string; quantity: number }>;
        };
        if (!operationId || !UUID_V4_PATTERN.test(operationId)) {
          throw new Error("BAD_REQUEST: operationId は小文字 UUID v4 が必要です");
        }
        if (!Array.isArray(items) || items.length < 1 || items.length > 3) {
          throw new Error("BAD_REQUEST: items は1〜3件必要です");
        }
        const seen = new Set<string>();
        for (const item of items) {
          if (
            !item ||
            !(PHYSICAL_REWARD_VOUCHER_IDS as readonly string[]).includes(
              item.catalogItemId,
            ) ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity < 1 ||
            seen.has(item.catalogItemId)
          ) {
            throw new Error("BAD_REQUEST: 物理券の items が不正です");
          }
          seen.add(item.catalogItemId);
        }
        const normalizedItems = PHYSICAL_REWARD_VOUCHER_IDS.flatMap(
          (catalogItemId) => {
            const item = items.find(
              (candidate) => candidate.catalogItemId === catalogItemId,
            );
            return item
              ? [{ catalogItemId, quantity: item.quantity }]
              : [];
          },
        ) as RewardVoucherConsumptionItemInput[];

        const existing = store.rewardVoucherConsumptions.get(operationId);
        if (existing) {
          const existingPayload = existing.items.map(
            ({ catalogItemId, quantity }) => ({ catalogItemId, quantity }),
          );
          if (JSON.stringify(existingPayload) !== JSON.stringify(normalizedItems)) {
            throw new Error(
              "IDEMPOTENCY_CONFLICT: 同じ operationId に異なる内容は使えません",
            );
          }
          return { ...existing, idempotentReplay: true } as T;
        }

        if (!hasEnoughRewardVouchers(store.rewardVouchers, normalizedItems)) {
          throw new Error("FORBIDDEN_STATE: 保有している券が不足しています");
        }
        const consumedAt = new Date().toISOString();
        const log: RewardVoucherConsumption = {
          operationId,
          consumedAt,
          items: normalizedItems.map(({ catalogItemId, quantity }) => {
            const stockBefore = store.rewardVouchers[catalogItemId];
            const stockAfter = stockBefore - quantity;
            store.rewardVouchers[catalogItemId] = stockAfter;
            return {
              catalogItemId,
              label: REWARD_VOUCHER_LABELS[catalogItemId],
              quantity,
              stockBefore,
              stockAfter,
            };
          }),
        };
        store.rewardVoucherConsumptions.set(operationId, log);
        return ({
          ...log,
          idempotentReplay: false,
        } satisfies RewardVoucherConsumptionResult) as T;
      }

      const month = query?.month;
      if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new Error("BAD_REQUEST: month が必要です（YYYY-MM）");
      }
      const catalogItemId = query?.catalogItemId;
      if (
        catalogItemId !== undefined &&
        !(PHYSICAL_REWARD_VOUCHER_IDS as readonly string[]).includes(catalogItemId)
      ) {
        throw new Error("BAD_REQUEST: catalogItemId は物理券3種だけ指定できます");
      }
      const items = [...store.rewardVoucherConsumptions.values()]
        .filter((log) => jstMonthFromIso(log.consumedAt) === month)
        .filter(
          (log) =>
            !catalogItemId ||
            log.items.some((item) => item.catalogItemId === catalogItemId),
        )
        .sort(
          (a, b) =>
            b.consumedAt.localeCompare(a.consumedAt) ||
            a.operationId.localeCompare(b.operationId),
        );
      return { month, items } as T;
    }

    case "rewardVoucherRefundRequests": {
      if (init?.method === "POST") {
        const { items } = body as {
          items?: { catalogItemId: string; quantity: number }[];
        };
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error("BAD_REQUEST: items は1件以上必要です");
        }
        for (const item of items) {
          if (
            !item ||
            typeof item.catalogItemId !== "string" ||
            typeof item.quantity !== "number" ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1
          ) {
            throw new Error(
              `BAD_REQUEST: items の形式が不正です item=${JSON.stringify(item)}`,
            );
          }
          if (!isRewardVoucherCatalogItemId(item.catalogItemId)) {
            throw new Error(
              `BAD_REQUEST: 対象外の catalogItemId です catalogItemId=${item.catalogItemId}`,
            );
          }
        }
        let totals: ReturnType<typeof calcRewardVoucherTotals>;
        try {
          totals = calcRewardVoucherTotals(items);
        } catch (cause) {
          const reason = cause instanceof Error ? cause.message : String(cause);
          throw new Error(`BAD_REQUEST: ${reason}`);
        }
        const validatedItems = items as {
          catalogItemId: RewardVoucherCatalogItemId;
          quantity: number;
        }[];
        if (!hasEnoughRewardVouchers(store.rewardVouchers, validatedItems)) {
          throw new Error(
            "FORBIDDEN_STATE: 保有している券が不足しているため申請できません",
          );
        }
        store.rewardVoucherRefundSeq += 1;
        const id = `rvr_mock_${Date.now()}_${store.rewardVoucherRefundSeq}`;
        const requestedAt = new Date().toISOString();
        const request: RewardVoucherRefundRequest = {
          id,
          status: "pending",
          requestedAt,
          decidedAt: "",
          items: totals.lineItems,
          totalPoints: totals.totalPoints,
          rejectReason: "",
        };
        store.rewardVoucherRefundRequests.set(id, request);
        return {
          id,
          status: "pending",
          totalPoints: totals.totalPoints,
        } as T;
      }

      const month = query?.month;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        throw new Error("BAD_REQUEST: month が必要です（YYYY-MM）");
      }
      const statusFilter = query?.status as RewardVoucherRefundStatus | undefined;
      if (
        statusFilter !== undefined &&
        statusFilter !== "pending" &&
        statusFilter !== "approved" &&
        statusFilter !== "rejected"
      ) {
        throw new Error(`BAD_REQUEST: status が不正です status=${statusFilter}`);
      }
      const list = [...store.rewardVoucherRefundRequests.values()]
        .filter((r) => toMonth(r.requestedAt.slice(0, 10)) === month)
        .filter((r) => !statusFilter || r.status === statusFilter)
        .sort(compareRewardVoucherRefundRequests);
      return { month, items: list } as T;
    }

    case "rewardVoucherRefundDecision": {
      const { id, decision, rejectReason } = body as {
        id?: string;
        decision?: string;
        rejectReason?: string;
      };
      if (!id) {
        throw new Error("BAD_REQUEST: id が必要です");
      }
      const request = store.rewardVoucherRefundRequests.get(id);
      if (!request) {
        throw new Error(`NOT_FOUND: 申請が見つかりません id=${id}`);
      }
      if (request.status !== "pending") {
        throw new Error(
          `FORBIDDEN_STATE: pending 以外は決定できません id=${id}, status=${request.status}`,
        );
      }
      if (decision !== "approve" && decision !== "reject") {
        throw new Error(
          `BAD_REQUEST: decision が不正です decision=${String(decision)}`,
        );
      }
      if (decision === "reject") {
        request.status = "rejected";
        request.decidedAt = new Date().toISOString();
        request.rejectReason = rejectReason ?? "";
        return {
          id,
          status: "rejected",
          balancePoints: store.balancePoints,
        } as T;
      }
      const requiredItems = request.items.map((item) => ({
        catalogItemId: item.catalogItemId,
        quantity: item.quantity,
      }));
      if (!hasEnoughRewardVouchers(store.rewardVouchers, requiredItems)) {
        throw new Error(
          `FORBIDDEN_STATE: 保有している券が不足しているため承認できません id=${id}`,
        );
      }
      for (const item of request.items) {
        store.rewardVouchers[item.catalogItemId] -= item.quantity;
      }
      store.balancePoints += request.totalPoints;
      request.status = "approved";
      request.decidedAt = new Date().toISOString();
      return {
        id,
        status: "approved",
        restoredPoints: request.totalPoints,
        balancePoints: store.balancePoints,
        rewardVouchers: normalizeRewardVouchers(store.rewardVouchers),
      } as T;
    }

    case "pointDebtOffset": {
      const { items } = body as {
        items?: { catalogItemId: string; quantity: number }[];
      };
      if (store.balancePoints >= 0) {
        throw new Error(
          `FORBIDDEN_STATE: 負債がないため穴埋めできません balancePoints=${store.balancePoints}`,
        );
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("BAD_REQUEST: items は1件以上必要です");
      }
      for (const item of items) {
        if (
          !item ||
          typeof item.catalogItemId !== "string" ||
          typeof item.quantity !== "number" ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1
        ) {
          throw new Error(
            `BAD_REQUEST: items の形式が不正です item=${JSON.stringify(item)}`,
          );
        }
        if (!isRewardVoucherCatalogItemId(item.catalogItemId)) {
          throw new Error(
            `BAD_REQUEST: 対象外の catalogItemId です catalogItemId=${item.catalogItemId}`,
          );
        }
      }
      let totals: ReturnType<typeof calcRewardVoucherTotals>;
      try {
        totals = calcRewardVoucherTotals(items);
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        throw new Error(`BAD_REQUEST: ${reason}`);
      }
      if (totals.totalPoints <= 0) {
        throw new Error("BAD_REQUEST: 穴埋め対象の合計が0です");
      }
      const validatedItems = items as {
        catalogItemId: RewardVoucherCatalogItemId;
        quantity: number;
      }[];
      if (!hasEnoughRewardVouchers(store.rewardVouchers, validatedItems)) {
        throw new Error(
          "FORBIDDEN_STATE: 保有している券が不足しているため穴埋めできません",
        );
      }
      for (const item of validatedItems) {
        store.rewardVouchers[item.catalogItemId] -= item.quantity;
      }
      store.balancePoints += totals.totalPoints;
      return {
        offsetPoints: totals.totalPoints,
        balancePoints: store.balancePoints,
        remainingDebtPoints: Math.max(0, -store.balancePoints),
        rewardVouchers: normalizeRewardVouchers(store.rewardVouchers),
      } as T;
    }

    default:
      throw new Error(`mockApi: 未対応 action=${action}`);
  }
}

/** ISO timestamp を JST の YYYY-MM に変換する。 */
function jstMonthFromIso(value: string): string {
  const shifted = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 7);
}

/**
 * モック用: ポイント交換申請の並び順（契約 §3.11.1）。
 * pending を先に requestedAt 昇順、決定済みは decidedAt 降順。
 * @param {PointExchangeRequest} a - 比較対象
 * @param {PointExchangeRequest} b - 比較対象
 * @returns {number} 比較結果（負なら a が先）
 */
function comparePointExchangeRequests(
  a: PointExchangeRequest,
  b: PointExchangeRequest,
): number {
  const aPending = a.status === "pending";
  const bPending = b.status === "pending";
  if (aPending && !bPending) return -1;
  if (!aPending && bPending) return 1;
  if (aPending) {
    return a.requestedAt.localeCompare(b.requestedAt);
  }
  return b.decidedAt.localeCompare(a.decidedAt);
}

/**
 * モック用: 報酬チケット戻し申請の並び順（契約 §3.11.3）。
 * pending を先に requestedAt 昇順、決定済みは decidedAt 降順。
 * @param {RewardVoucherRefundRequest} a - 比較対象
 * @param {RewardVoucherRefundRequest} b - 比較対象
 * @returns {number} 比較結果（負なら a が先）
 */
function compareRewardVoucherRefundRequests(
  a: RewardVoucherRefundRequest,
  b: RewardVoucherRefundRequest,
): number {
  const aPending = a.status === "pending";
  const bPending = b.status === "pending";
  if (aPending && !bPending) return -1;
  if (!aPending && bPending) return 1;
  if (aPending) {
    return a.requestedAt.localeCompare(b.requestedAt);
  }
  return b.decidedAt.localeCompare(a.decidedAt);
}
