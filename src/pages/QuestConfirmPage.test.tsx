/**
 * @file QuestConfirmPage 描画テスト
 * @description 起床 UI の表示条件を検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { setQuestDraft } from "@/lib/sessionStorage";
import { todayLocal } from "@/lib/date";
import { QuestConfirmPage } from "@/pages/QuestConfirmPage";
import type { DailyQuests, HomeData, QuestDefinition, QuestDraft } from "@/types/api";
import dailyJson from "../../quests/daily.json";

const daily: DailyQuests = {
  date: todayLocal(),
  version: dailyJson.version,
  generationMode: "fixed_seed",
  quests: dailyJson.quests as QuestDefinition[],
};

/**
 * 確認画面用の完全な下書きを作る（to-be 10問・条件分岐なし）
 * @returns {QuestDraft} 下書き
 */
function buildCompleteDraft(): QuestDraft {
  return {
    index: daily.quests.length,
    answers: [
      { questId: "bedtime-prep", childAnswer: 1 },
      { questId: "sleep-on-time-yesterday", childAnswer: 1 },
      { questId: "wake-on-time", childAnswer: 1 },
      { questId: "brush-teeth-gargle-am", childAnswer: 1 },
      { questId: "wash-hands-gargle-after-school", childAnswer: 1 },
      { questId: "homework-done-today", childAnswer: 1 },
      { questId: "phone-non-emergency-unused", childAnswer: -1 },
      { questId: "save-water-hot-water", childAnswer: 1 },
      { questId: "no-repeated-warnings", childAnswer: 1 },
      { questId: "listen-to-mama-before-warning", childAnswer: 1 },
    ],
  };
}

/**
 * テスト用 HomeData を組み立てる
 * @param {Partial<HomeData>} [overrides] - 上書き
 * @returns {HomeData} HomeData
 */
function buildHome(overrides: Partial<HomeData> = {}): HomeData {
  return {
    displayBalance: 60,
    penaltyMinutes: 0,
    today: todayLocal(),
    todayStatus: "unanswered",
    questAction: "start",
    unacknowledgedCount: 0,
    canStartTimer: true,
    timerBlockCount: 0,
    isLongVacation: false,
    isExemptToday: false,
    isWeekendEve: false,
    registrationReopen: null,
    wakePromiseYesterday: null,
    bedtimeEditableUntil: null,
    questDeadlineAt: null,
    bonusDeadlineAt: null,
    isExemptDay: false,
    isVacationMode: false,
    ...overrides,
  };
}

/**
 * QuestConfirmPage を描画する
 * @param {HomeData} home - ホームデータ
 * @returns {void}
 */
function renderConfirm(home: HomeData): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  queryClient.setQueryData(queryKeys.home, home);
  queryClient.setQueryData(queryKeys.dailyQuests(todayLocal()), daily);
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/quest/confirm"]}>
        <Routes>
          <Route path="/quest/confirm" element={<QuestConfirmPage />} />
          <Route path="/" element={<div>home-page</div>} />
          <Route path="/quest" element={<div>quest-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("QuestConfirmPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 金曜 22:30 = 休日前夜・登録受付時間内（既定就寝23時 → 22:00〜23:00）
    vi.setSystemTime(new Date(2026, 6, 31, 22, 30, 0));
    sessionStorage.clear();
    setQuestDraft(todayLocal(), buildCompleteDraft());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("休日前夜は起床 UI を表示する", () => {
    renderConfirm(
      buildHome({
        isVacationMode: false,
      }),
    );

    expect(screen.getByTestId("wake-up-section")).toBeTruthy();
    expect(screen.getByText("明日の起きる時間")).toBeTruthy();
  });

  it("長期休み中は平日でも起床 UI を表示する", () => {
    vi.setSystemTime(new Date(2026, 6, 28, 20, 30, 0)); // 火曜・受付時間内
    sessionStorage.clear();
    setQuestDraft(todayLocal(), buildCompleteDraft());

    renderConfirm(
      buildHome({
        isVacationMode: true,
      }),
    );

    expect(screen.getByTestId("wake-up-section")).toBeTruthy();
  });

  it("通常の平日は起床 UI を出さない", () => {
    vi.setSystemTime(new Date(2026, 6, 28, 20, 30, 0)); // 火曜・受付時間内
    sessionStorage.clear();
    setQuestDraft(todayLocal(), buildCompleteDraft());

    renderConfirm(
      buildHome({
        isVacationMode: false,
      }),
    );

    expect(screen.getByText("最後の確認")).toBeTruthy();
    expect(screen.queryByTestId("wake-up-section")).toBeNull();
  });
});
