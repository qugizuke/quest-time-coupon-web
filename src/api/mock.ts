/**
 * @file モック API
 * @description API（Cloud Functions）未接続時の開発用インメモリ API（v5 対応）。
 *   長期休み／免除はローカルフラグ（本接続は Issue F）。
 */
import type {
  ChildAnswer,
  GradeAdjustment,
  HomeData,
  QuestDefinition,
  WakeUpTime,
} from "@/types/api";
import { todayLocal } from "@/lib/date";
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

/** @type {number} 未登録ペナルティ（分） */
const MISSED_REGISTRATION_PENALTY = -60;

interface MockStore {
  balanceMinutes: number;
  penaltyMinutes: number;
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
  /** date → endsAt ISO（再開枠） */
  registrationReopenByDate: Map<string, { endsAt: string; setAt: string; used: boolean }>;
  longVacation: { startDate: string; endDate: string; updatedAt: string };
  exemptionPeriods: Array<{ startDate: string; endDate: string; createdAt: string }>;
  /** テスト用オーバーライド（undefined なら localStorage） */
  vacationModeOverride?: boolean;
  /** テスト用免除日セット（未設定なら localStorage の当日免除） */
  exemptDatesOverride?: Set<string>;
}

const store: MockStore = {
  balanceMinutes: 60,
  penaltyMinutes: 0,
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
  registrationReopenByDate: new Map(),
  longVacation: { startDate: "", endDate: "", updatedAt: "" },
  exemptionPeriods: [],
};

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
    store.balanceMinutes -= applied;
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
  store.balanceMinutes = 60;
  store.penaltyMinutes = 0;
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
  store.registrationReopenByDate.clear();
  store.longVacation = { startDate: "", endDate: "", updatedAt: "" };
  store.exemptionPeriods = [];
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

/** @type {number} 定時登録ボーナス（分） */
const REGISTRATION_ON_TIME_BONUS = 15;

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
function calcMockRegistrationTimingAdjustment(date: string): number {
  if (store.missedRegistrationDates.has(date)) {
    return MISSED_REGISTRATION_PENALTY;
  }
  const submittedAt = store.submittedAtByDate.get(date);
  if (!submittedAt) return 0;
  const submitted = new Date(submittedAt);
  const bedtimeHour = store.bedtimeByDate.get(date);
  if (isPastQuestBonusDeadline(date, submitted, bedtimeHour)) return 0;
  return canApplyBedtimePrepRegistrationBonus(mockBedtimePrepEvaluation(date))
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
    return `定時登録ボーナス +${adjustment}分（寝る準備確認済み）`;
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
): { childAnswer: ChildAnswer; actualDone: boolean } | undefined {
  const childAnswer = store.answers.get(date)?.get(BEDTIME_PREP_QUEST_ID);
  const actualDone = store.grades.get(date)?.get(BEDTIME_PREP_QUEST_ID);
  if (childAnswer === undefined || actualDone === undefined) return undefined;
  return { childAnswer, actualDone };
}

/**
 * モック用の寝る準備虚偽ペナルティを算出する
 * @param {string} date - 対象日
 * @returns {number} ペナルティ分数
 */
function calcMockBedtimePrepPenalty(date: string): number {
  return calcBedtimePrepFalseClaimPenalty(mockBedtimePrepEvaluation(date));
}

/**
 * モック用の任意加減点合計を算出する
 * @param {string} date - 対象日
 * @returns {number} bonus は正、penalty は負の合計
 */
function sumMockAdjustments(date: string): number {
  return (store.adjustmentsByDate.get(date) ?? []).reduce((sum, adj) => {
    return sum + (adj.kind === "bonus" ? adj.minutes : -adj.minutes);
  }, 0);
}

/**
 * モック用の採点合計点を算出する（クエスト点は未シミュレート）
 * @param {string} date - 対象日
 * @returns {number} totalPoints
 */
function calcMockTotalPoints(date: string): number {
  return (
    calcMockRegistrationTimingAdjustment(date) +
    calcMockBedtimePrepPenalty(date) +
    sumMockAdjustments(date)
  );
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
    if (typeof adj.minutes !== "number" || !Number.isFinite(adj.minutes)) {
      throw new Error(`BAD_REQUEST: minutes は数値である必要があります code=${adj.code}`);
    }
    if (adj.minutes < 10 || adj.minutes > 60 || adj.minutes % 10 !== 0) {
      throw new Error(`BAD_REQUEST: minutes は10〜60の10分刻み code=${adj.code}`);
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
      const bedtimeHour = store.bedtimeByDate.get(date) as HomeData["bedtimeHour"];
      const isExemptToday = resolveMockExemptDay(date);
      const isLongVacation = resolveMockVacationMode(date);
      const pastCutoff = isPastQuestRegistrationCutoff(date, new Date(), bedtimeHour);

      if (isExemptToday) {
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
        if (store.missedRegistrationDates.has(date)) {
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
      const displayBalance = Math.max(0, store.balanceMinutes);
      const reopen = store.registrationReopenByDate.get(date);
      const now = Date.now();
      const registrationReopen = reopen
        ? {
            endsAt: reopen.endsAt,
            setAt: reopen.setAt,
            used: reopen.used,
            isOpen: reopen.used && new Date(reopen.endsAt).getTime() > now,
          }
        : null;
      const weekendEve = isWeekendEve(date);
      const childCanEditBedtime =
        !isExemptToday && (weekendEve || isLongVacation) && !hasAnswers && !isGraded;
      const bedtimeEditableUntil = childCanEditBedtime
        ? getChildBedtimeSettingCutoff(date).toISOString()
        : null;

      return {
        displayBalance,
        penaltyMinutes: store.penaltyMinutes,
        today: date,
        todayStatus,
        questAction,
        unacknowledgedCount,
        timerBlockCount,
        canStartTimer:
          displayBalance > 0 && store.penaltyMinutes === 0 && timerBlockCount === 0,
        bedtimeHour,
        isWeekendEve: weekendEve,
        isLongVacation,
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
          store.bedtimeByDate.get(date),
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
          store.bedtimeByDate.get(date),
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
        longVacation: {
          startDate: store.longVacation.startDate,
          endDate: store.longVacation.endDate,
          active: isLongVacation,
        },
        bedtimeHour: (store.bedtimeByDate.get(date) ?? 21) as 21 | 22 | 23,
        canEditBedtimeAsParent:
          !isExemptToday &&
          !hasAnswers &&
          !isGraded &&
          (isWeekendEve(date) || isLongVacation),
        questDeadlineAt: null,
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
      if (isExemptDay) {
        throw new Error("FORBIDDEN_STATE: 免除日は bedtimeHour を設定できません");
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
        return {
          gradedAt: new Date().toISOString(),
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
      return {
        reasonCode: "grade_rejected",
        totalPoints: MISSED_REGISTRATION_PENALTY,
        gradedAt: new Date().toISOString(),
      } as T;
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
      const gradedItems = [...store.gradedDates].map((date) => {
        const dayAnswers =
          store.answers.get(date) ?? new Map<string, ChildAnswer>();
        const dayGrades = store.grades.get(date) ?? new Map<string, boolean>();
        const adjustments = (store.adjustmentsByDate.get(date) ?? []).map(
          (a) => ({
            kind: a.kind,
            code: a.code,
            label: a.code,
            minutes: a.kind === "bonus" ? a.minutes : -a.minutes,
          }),
        );
        const registrationTimingAdjustment =
          calcMockRegistrationTimingAdjustment(date);
        const registrationTimingReason = describeMockRegistrationTimingReason(
          date,
          registrationTimingAdjustment,
        );
        const bedtimePrepPenalty = calcMockBedtimePrepPenalty(date);
        const totalPoints = calcMockTotalPoints(date);
        const details = [...dayAnswers.entries()]
          .filter(([questId]) => questId !== BEDTIME_PREP_QUEST_ID)
          .map(([questId, childAnswer]) => {
            const actualDone = dayGrades.get(questId) ?? false;
            return {
              questId,
              childAnswer,
              actualDone,
              finalPoints: 0,
              mismatch: isMockMismatch(childAnswer, actualDone),
              gradingMode: mockGradingModeForChildAnswer(questId, childAnswer),
            };
          });
        const acknowledged = store.acknowledgedDates.has(date);
        return {
          date,
          totalPoints,
          acknowledged,
          reasonCode: "normal" as const,
          registrationTimingAdjustment,
          registrationTimingReason,
          bedtimePrepPenalty,
          bedtimePrepPenaltyReason:
            bedtimePrepPenalty !== 0
              ? `寝る準備の虚偽ペナルティ ${bedtimePrepPenalty}分`
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
          registrationTimingReason: `登録締切までにクエストを登録しなかったため ${MISSED_REGISTRATION_PENALTY}分`,
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
      const balanceBefore = store.balanceMinutes;
      store.acknowledgedDates.add(date);
      let penaltyOffset = 0;
      if (delta > 0) {
        penaltyOffset = Math.min(store.penaltyMinutes, delta);
        store.penaltyMinutes -= penaltyOffset;
        store.balanceMinutes += delta - penaltyOffset;
      } else if (delta < 0) {
        store.balanceMinutes = Math.max(0, store.balanceMinutes + delta);
      }
      const appliedDelta =
        delta < 0 ? store.balanceMinutes - balanceBefore : delta - penaltyOffset;
      store.appliedDeltaByDate.set(date, appliedDelta);
      return {
        appliedDelta,
        penaltyOffset,
        displayBalance: Math.max(0, store.balanceMinutes),
        penaltyMinutes: store.penaltyMinutes,
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
      store.balanceMinutes = Math.max(0, store.balanceMinutes - usedMinutes);
      store.penaltyMinutes += overrunMinutes;
      return {
        displayBalance: Math.max(0, store.balanceMinutes),
        penaltyMinutes: store.penaltyMinutes,
      } as T;
    }

    default:
      throw new Error(`mockApi: 未対応 action=${action}`);
  }
}
