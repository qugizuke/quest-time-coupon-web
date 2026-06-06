/**
 * @file モック API
 * @description GAS 未接続時の開発用インメモリ API。
 */
import type { ChildAnswer, HomeData } from "@/types/api";
import { todayLocal } from "@/lib/date";

interface MockStore {
  balanceMinutes: number;
  penaltyMinutes: number;
  answers: Map<string, Map<string, ChildAnswer>>;
  gradedDates: Set<string>;
  acknowledgedDates: Set<string>;
}

const store: MockStore = {
  balanceMinutes: 0,
  penaltyMinutes: 0,
  answers: new Map(),
  gradedDates: new Set(),
  acknowledgedDates: new Set(),
};

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

      let todayStatus: HomeData["todayStatus"] = "unanswered";
      let questAction: HomeData["questAction"] = "start";

      if (!hasAnswers) {
        todayStatus = "unanswered";
        questAction = "start";
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

      const unacknowledgedCount = [...store.gradedDates].filter(
        (d) => !store.acknowledgedDates.has(d),
      ).length;

      return {
        displayBalance: Math.max(0, store.balanceMinutes),
        penaltyMinutes: store.penaltyMinutes,
        today,
        todayStatus,
        questAction,
        unacknowledgedCount,
        canStartTimer: store.balanceMinutes > 0,
      } as T;
    }

    case "answers": {
      const { date, answers } = body as {
        date: string;
        answers: { questId: string; childAnswer: ChildAnswer }[];
      };
      if (store.gradedDates.has(date)) {
        throw new Error("ALREADY_GRADED: 採点済みのため上書きできません");
      }
      const map = new Map<string, ChildAnswer>();
      for (const a of answers) map.set(a.questId, a.childAnswer);
      store.answers.set(date, map);
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
        };
      });
      return { dates: list } as T;
    }

    case "grade": {
      if (init?.method === "POST") {
        const { date } = body as { date: string };
        if (store.gradedDates.has(date)) {
          throw new Error("ALREADY_GRADED: 再採点はできません");
        }
        store.gradedDates.add(date);
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
      return { date, items } as T;
    }

    case "results": {
      const items = [...store.gradedDates]
        .filter((d) => !store.acknowledgedDates.has(d))
        .map((date) => ({
          date,
          totalPoints: 15,
          acknowledged: false,
          details: [],
        }));
      return { items } as T;
    }

    case "resultsAck": {
      const { date } = body as { date: string };
      const delta = 15;
      if (delta > 0) {
        const offset = Math.min(store.penaltyMinutes, delta);
        store.penaltyMinutes -= offset;
        store.balanceMinutes += delta - offset;
      }
      store.acknowledgedDates.add(date);
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
