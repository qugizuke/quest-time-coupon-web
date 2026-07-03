/**
 * @file モック API
 * @description GAS 未接続時の開発用インメモリ API（v5 対応）。
 */
import type { ChildAnswer, GradeAdjustment, HomeData } from "@/types/api";
import { todayLocal } from "@/lib/date";
import {
  isBeforeQuestRegistrationStart,
  isPastQuestBonusDeadline,
  isPastQuestRegistrationCutoff,
  isWeekendEve,
} from "@/lib/deadline";
import {
  BEDTIME_PREP_QUEST_ID,
  calcBedtimePrepFalseClaimPenalty,
  canApplyBedtimePrepRegistrationBonus,
} from "@/lib/registrationBonus";
import { isUnknownChildAnswer } from "@/lib/labels";
import daily from "../../quests/daily.json";
import adjustmentDefinitions from "../../adjustments/grade.json";

interface MockStore {
  balanceMinutes: number;
  penaltyMinutes: number;
  answers: Map<string, Map<string, ChildAnswer>>;
  grades: Map<string, Map<string, boolean>>;
  gradedDates: Set<string>;
  acknowledgedDates: Set<string>;
  missedRegistrationDates: Set<string>;
  bedtimeByDate: Map<string, number>;
  submittedAtByDate: Map<string, string>;
  adjustmentsByDate: Map<string, GradeAdjustment[]>;
}

const store: MockStore = {
  balanceMinutes: 0,
  penaltyMinutes: 0,
  answers: new Map(),
  grades: new Map(),
  gradedDates: new Set(),
  acknowledgedDates: new Set(),
  missedRegistrationDates: new Set(),
  bedtimeByDate: new Map(),
  submittedAtByDate: new Map(),
  adjustmentsByDate: new Map(),
};

/** @type {number} 定時登録ボーナス（分） */
const REGISTRATION_ON_TIME_BONUS = 15;

/** @type {number} 未登録ペナルティ（分） */
const MISSED_REGISTRATION_PENALTY = -60;

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
  const bedtimeHour = store.bedtimeByDate.get(date) ?? 21;
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
    if (isUnknownChildAnswer(childAnswer)) continue;
    if (!gradeMap.has(questId)) {
      throw new Error(`BAD_REQUEST: 未採点 questId=${questId}`);
    }
  }
  for (const g of grades) {
    if (!dayAnswers.has(g.questId)) {
      throw new Error(`BAD_REQUEST: 未知の questId=${g.questId}`);
    }
    if (isUnknownChildAnswer(dayAnswers.get(g.questId)!)) {
      throw new Error(`BAD_REQUEST: 分からない回答は採点不要 questId=${g.questId}`);
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
  const existingAnswer = existingAnswers?.get(BEDTIME_PREP_QUEST_ID);
  if (existingAnswer === undefined) return;
  const nextAnswer = nextAnswers.find((answer) => answer.questId === BEDTIME_PREP_QUEST_ID);
  if (nextAnswer && nextAnswer.childAnswer !== existingAnswer) {
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
      const dayAnswers = store.answers.get(today);
      const hasAnswers = !!dayAnswers && dayAnswers.size > 0;
      const isGraded = store.gradedDates.has(today);
      const isAcked = store.acknowledgedDates.has(today);
      const bedtimeHour = store.bedtimeByDate.get(today) ?? 21;
      const pastCutoff = isPastQuestRegistrationCutoff(today, new Date(), bedtimeHour);

      if (pastCutoff && !hasAnswers && !store.missedRegistrationDates.has(today)) {
        store.missedRegistrationDates.add(today);
      }

      let todayStatus: HomeData["todayStatus"] = "unanswered";
      let questAction: HomeData["questAction"] = "start";

      if (!hasAnswers) {
        if (store.missedRegistrationDates.has(today)) {
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

      const unacknowledgedCount = [
        ...store.gradedDates,
        ...store.missedRegistrationDates,
      ].filter((d) => !store.acknowledgedDates.has(d)).length;

      return {
        displayBalance: Math.max(0, store.balanceMinutes),
        penaltyMinutes: store.penaltyMinutes,
        today,
        todayStatus,
        questAction,
        unacknowledgedCount,
        canStartTimer: store.balanceMinutes > 0,
        bedtimeHour,
        isWeekendEve: isWeekendEve(today),
      } as T;
    }

    case "registrationSetting": {
      const { date, bedtimeHour } = body as { date: string; bedtimeHour: number };
      if (!isValidOptionalBedtimeHour(bedtimeHour)) {
        throw new Error(`BAD_REQUEST: bedtimeHour が不正です bedtimeHour=${String(bedtimeHour)}`);
      }
      if (bedtimeHour !== 21 && !isWeekendEve(date)) {
        throw new Error("BAD_REQUEST: 休日前日以外は bedtimeHour を変更できません");
      }
      if (store.missedRegistrationDates.has(date) || store.gradedDates.has(date)) {
        throw new Error("ALREADY_RESULT: 結果作成済みのため設定できません");
      }
      if (store.answers.has(date) || store.submittedAtByDate.has(date)) {
        throw new Error("ALREADY_ANSWERED: 回答後は就寝時刻を変更できません");
      }
      const currentHour = store.bedtimeByDate.get(date) ?? 21;
      if (isPastQuestRegistrationCutoff(date, new Date(), currentHour)) {
        throw new Error("BAD_REQUEST: 登録受付締切を過ぎているため設定できません");
      }
      if (isPastQuestRegistrationCutoff(date, new Date(), bedtimeHour)) {
        throw new Error("BAD_REQUEST: 変更先の登録受付締切を過ぎているため設定できません");
      }
      store.bedtimeByDate.set(date, bedtimeHour);
      return { date, bedtimeHour } as T;
    }

    case "answers": {
      const { date, answers, bedtimeHour } = body as {
        date: string;
        answers: { questId: string; childAnswer: ChildAnswer }[];
        bedtimeHour?: number;
      };
      validateMockAnswers(answers);
      if (!isValidOptionalBedtimeHour(bedtimeHour)) {
        throw new Error(`BAD_REQUEST: bedtimeHour が不正です bedtimeHour=${String(bedtimeHour)}`);
      }
      if (bedtimeHour !== undefined && bedtimeHour !== 21 && !isWeekendEve(date)) {
        throw new Error("BAD_REQUEST: 休日前日以外は bedtimeHour を変更できません");
      }
      if (store.gradedDates.has(date)) {
        throw new Error("ALREADY_GRADED: 採点済みのため上書きできません");
      }
      const hour = store.bedtimeByDate.get(date) ?? bedtimeHour ?? 21;
      const existingAnswers = store.answers.get(date);
      const isNewRegistration = !existingAnswers;
      if (isNewRegistration) {
        if (store.missedRegistrationDates.has(date) || store.gradedDates.has(date)) {
          throw new Error("ALREADY_RESULT: 結果作成済みのため回答を保存できません");
        }
        if (isBeforeQuestRegistrationStart(date, new Date(), hour)) {
          throw new Error("BAD_REQUEST: 登録受付開始前のため回答を保存できません");
        }
        if (isPastQuestRegistrationCutoff(date, new Date(), hour)) {
          throw new Error("BAD_REQUEST: 登録受付締切を過ぎているため回答を保存できません");
        }
      } else {
        validateMockRetryImmutableAnswers(existingAnswers, answers);
      }
      const map = new Map<string, ChildAnswer>();
      for (const a of answers) map.set(a.questId, a.childAnswer);
      const submittedAt = store.submittedAtByDate.get(date) ?? new Date().toISOString();
      store.answers.set(date, map);
      store.submittedAtByDate.set(date, submittedAt);
      store.missedRegistrationDates.delete(date);
      store.bedtimeByDate.set(date, hour);
      return {
        submittedAt,
        overwritten: !isNewRegistration,
      } as T;
    }

    case "gradeDates": {
      const dates = new Set<string>([
        ...store.answers.keys(),
        ...store.gradedDates,
      ]);
      const list = [...dates].sort().reverse().map((date) => {
        const hasAnswers = store.answers.has(date);
        const isGraded = store.gradedDates.has(date);
        return {
          date,
          status: !hasAnswers
            ? ("unanswered" as const)
            : isGraded
              ? ("graded" as const)
              : ("ungraded" as const),
          ungradedCount: hasAnswers && !isGraded ? 1 : 0,
          totalPoints: isGraded ? calcMockTotalPoints(date) : null,
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
        if (store.gradedDates.has(date)) {
          throw new Error("ALREADY_GRADED: 再採点はできません");
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
        return { gradedAt: new Date().toISOString() } as T;
      }
      const date = query?.date ?? today;
      const dayAnswers = store.answers.get(date);
      const items = dayAnswers
        ? [...dayAnswers.entries()].map(([questId, childAnswer]) => ({
            questId,
            childAnswer,
            actualDone: null,
          }))
        : [];
      return {
        date,
        items,
        adjustments: store.adjustmentsByDate.get(date) ?? [],
      } as T;
    }

    case "results": {
      const gradedItems = [...store.gradedDates]
        .map((date) => {
          const dayAnswers = store.answers.get(date) ?? new Map<string, ChildAnswer>();
          const dayGrades = store.grades.get(date) ?? new Map<string, boolean>();
          const adjustments = (store.adjustmentsByDate.get(date) ?? []).map((a) => ({
            kind: a.kind,
            code: a.code,
            label: a.code,
            minutes: a.kind === "bonus" ? a.minutes : -a.minutes,
          }));
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
              };
            });
          return {
            date,
            totalPoints,
            acknowledged: store.acknowledgedDates.has(date),
            registrationTimingAdjustment,
            registrationTimingReason,
            bedtimePrepPenalty,
            bedtimePrepPenaltyReason:
              bedtimePrepPenalty !== 0
                ? `寝る準備の虚偽ペナルティ ${bedtimePrepPenalty}分`
                : undefined,
            adjustments,
            details,
          };
        });
      const missedItems = [...store.missedRegistrationDates]
        .map((date) => ({
          date,
          totalPoints: MISSED_REGISTRATION_PENALTY,
          acknowledged: store.acknowledgedDates.has(date),
          registrationTimingAdjustment: MISSED_REGISTRATION_PENALTY,
          registrationTimingReason: `登録締切までにクエストを登録しなかったため ${MISSED_REGISTRATION_PENALTY}分`,
          adjustments: [],
          details: [],
        }));
      return { items: [...gradedItems, ...missedItems] } as T;
    }

    case "resultsAck": {
      const { date } = body as { date: string };
      if (
        !store.gradedDates.has(date) &&
        !store.missedRegistrationDates.has(date)
      ) {
        throw new Error("NOT_FOUND: 結果がありません");
      }
      if (store.acknowledgedDates.has(date)) {
        throw new Error("ALREADY_ACKNOWLEDGED: 確認済みです");
      }
      const delta = calcMockTotalPoints(date);
      store.acknowledgedDates.add(date);
      let penaltyOffset = 0;
      if (delta > 0) {
        penaltyOffset = Math.min(store.penaltyMinutes, delta);
        store.penaltyMinutes -= penaltyOffset;
        store.balanceMinutes += delta - penaltyOffset;
      } else if (delta < 0) {
        store.balanceMinutes += delta;
      }
      return {
        appliedDelta: delta - penaltyOffset,
        penaltyOffset,
        displayBalance: Math.max(0, store.balanceMinutes),
        penaltyMinutes: store.penaltyMinutes,
      } as T;
    }

    case "timerStop": {
      const { usedMinutes, overrunMinutes } = body as {
        usedMinutes: number;
        overrunMinutes: number;
      };
      store.balanceMinutes -= usedMinutes;
      store.penaltyMinutes += overrunMinutes;
      return {
        displayBalance: Math.max(0, store.balanceMinutes),
      } as T;
    }

    default:
      throw new Error(`mockApi: 未対応 action=${action}`);
  }
}
