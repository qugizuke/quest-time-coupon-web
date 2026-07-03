/**
 * @file モック API
 * @description GAS 未接続時の開発用インメモリ API（v5 対応）。
 */
import type { ChildAnswer, GradeAdjustment, HomeData } from "@/types/api";
import { todayLocal } from "@/lib/date";
import { isBeforeQuestRegistrationStart, isPastQuestRegistrationCutoff, isWeekendEve } from "@/lib/deadline";
import { isBedtimePrepBlockingRegistrationBonus } from "@/lib/registrationBonus";

interface MockStore {
  balanceMinutes: number;
  penaltyMinutes: number;
  answers: Map<string, Map<string, ChildAnswer>>;
  gradedDates: Set<string>;
  acknowledgedDates: Set<string>;
  missedRegistrationDates: Set<string>;
  bedtimeByDate: Map<string, number>;
  adjustmentsByDate: Map<string, GradeAdjustment[]>;
}

const store: MockStore = {
  balanceMinutes: 0,
  penaltyMinutes: 0,
  answers: new Map(),
  gradedDates: new Set(),
  acknowledgedDates: new Set(),
  missedRegistrationDates: new Set(),
  bedtimeByDate: new Map(),
  adjustmentsByDate: new Map(),
};

/** @type {number} 定時登録ボーナス（分） */
const REGISTRATION_ON_TIME_BONUS = 15;

/** @type {number} 未登録ペナルティ（分） */
const MISSED_REGISTRATION_PENALTY = -60;

/**
 * モック用の定時登録加減点を算出する（クエスト点は未シミュレート）
 * @param {string} date - 対象日
 * @returns {number} 定時登録ボーナスまたは未登録ペナルティ
 */
function calcMockRegistrationTimingAdjustment(date: string): number {
  if (store.missedRegistrationDates.has(date)) {
    return MISSED_REGISTRATION_PENALTY;
  }
  const dayAnswers = store.answers.get(date);
  const answers = dayAnswers
    ? [...dayAnswers.entries()].map(([questId, childAnswer]) => ({
        questId,
        childAnswer,
      }))
    : [];
  return isBedtimePrepBlockingRegistrationBonus(answers)
    ? 0
    : REGISTRATION_ON_TIME_BONUS;
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
  return calcMockRegistrationTimingAdjustment(date) + sumMockAdjustments(date);
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
      store.bedtimeByDate.set(date, bedtimeHour);
      return { date, bedtimeHour } as T;
    }

    case "answers": {
      const { date, answers, bedtimeHour } = body as {
        date: string;
        answers: { questId: string; childAnswer: ChildAnswer }[];
        bedtimeHour?: number;
      };
      if (store.gradedDates.has(date)) {
        throw new Error("ALREADY_GRADED: 採点済みのため上書きできません");
      }
      const hour = bedtimeHour ?? store.bedtimeByDate.get(date) ?? 21;
      const isNewRegistration = !store.answers.has(date);
      if (isNewRegistration) {
        if (isBeforeQuestRegistrationStart(date, new Date(), hour)) {
          throw new Error("BAD_REQUEST: 登録受付開始前のため回答を保存できません");
        }
        if (isPastQuestRegistrationCutoff(date, new Date(), hour)) {
          throw new Error("BAD_REQUEST: 登録受付締切を過ぎているため回答を保存できません");
        }
      }
      const map = new Map<string, ChildAnswer>();
      for (const a of answers) map.set(a.questId, a.childAnswer);
      store.answers.set(date, map);
      store.missedRegistrationDates.delete(date);
      if (bedtimeHour != null) {
        store.bedtimeByDate.set(date, bedtimeHour);
      }
      return {
        submittedAt: new Date().toISOString(),
        overwritten: true,
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
          totalPoints: isGraded ? 0 : null,
        };
      });
      return { dates: list } as T;
    }

    case "grade": {
      if (init?.method === "POST") {
        const { date, adjustments } = body as {
          date: string;
          adjustments?: GradeAdjustment[];
        };
        if (store.gradedDates.has(date)) {
          throw new Error("ALREADY_GRADED: 再採点はできません");
        }
        store.gradedDates.add(date);
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
        .filter((d) => !store.acknowledgedDates.has(d))
        .map((date) => {
          const adjustments = (store.adjustmentsByDate.get(date) ?? []).map((a) => ({
            kind: a.kind,
            code: a.code,
            label: a.code,
            minutes: a.kind === "bonus" ? a.minutes : -a.minutes,
          }));
          const registrationTimingAdjustment =
            calcMockRegistrationTimingAdjustment(date);
          const totalPoints = calcMockTotalPoints(date);
          return {
            date,
            totalPoints,
            acknowledged: false,
            registrationTimingAdjustment,
            adjustments,
            details: [],
          };
        });
      const missedItems = [...store.missedRegistrationDates]
        .filter((d) => !store.acknowledgedDates.has(d))
        .map((date) => ({
          date,
          totalPoints: MISSED_REGISTRATION_PENALTY,
          acknowledged: false,
          registrationTimingAdjustment: MISSED_REGISTRATION_PENALTY,
          adjustments: [],
          details: [],
        }));
      return { items: [...gradedItems, ...missedItems] } as T;
    }

    case "resultsAck": {
      const { date } = body as { date: string };
      const delta = calcMockTotalPoints(date);
      store.acknowledgedDates.add(date);
      if (delta > 0) {
        const offset = Math.min(store.penaltyMinutes, delta);
        store.penaltyMinutes -= offset;
        store.balanceMinutes += delta - offset;
      } else if (delta < 0) {
        store.balanceMinutes += delta;
      }
      return {
        appliedDelta: delta,
        penaltyOffset: 0,
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
