/**
 * @file QuestPage ステッパーレイアウトの回帰テスト
 * @description モバイル横溢れ防止のため、ステップ円が幅追従クラスを持つことを検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { zeroRewardVouchers } from "@/lib/rewardVouchers";
import { QuestPage } from "@/pages/QuestPage";
import type { HomeData, QuestDefinition } from "@/types/api";

const quests = Array.from({ length: 10 }, (_, i) => ({
  id: `q${i + 1}`,
  order: i + 1,
  title: `クエスト${i + 1}`,
  choices: ["できた", "できなかった", "わからない"],
})) as QuestDefinition[];

vi.mock("@/hooks/useDailyQuests", () => ({
  useDailyQuests: () => ({
    data: {
      date: "2026-07-30",
      quests,
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useQuestDraft", () => ({
  useQuestDraft: () => ({
    draft: {
      answers: quests.map((q) => ({ questId: q.id, childAnswer: undefined })),
      index: 0,
      gateAnswers: {},
    },
    ready: true,
    setAnswer: vi.fn(),
    goNext: vi.fn(),
    goPrev: vi.fn(),
    currentQuest: quests[0],
    currentAnswer: undefined,
    isFollowUpMode: false,
    canGoNext: false,
    canConfirm: false,
  }),
}));

/**
 * テスト用 HomeData
 * @returns {HomeData} home
 */
function buildHome(): HomeData {
  return {
    displayBalance: 60,
    balancePoints: 0,
    switchMinutes: 60,
    penaltyMinutes: 0,
    debtMinutes: 0,
    issuablePenaltyTicketCount: 0,
    penaltyTicketCount: 0,
    rewardVouchers: zeroRewardVouchers(),
    today: "2026-07-30",
    todayStatus: "unanswered",
    questAction: "start",
    unacknowledgedCount: 0,
    canStartTimer: true,
    timerBlockCount: 0,
    isLongVacation: false,
    isVacationTransition: false,
    isExemptToday: false,
    isWeekendEve: false,
    registrationReopen: null,
    wakePromiseYesterday: null,
    bedtimeEditableUntil: null,
    questDeadlineAt: null,
    bonusDeadlineAt: null,
    isExemptDay: false,
    isVacationMode: false,
    bedtimeHour: 21,
  };
}

describe("QuestPage stepper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 受付時間帯内にしてホームへリダイレクトされないようにする
    vi.setSystemTime(new Date(2026, 6, 30, 20, 15, 0));
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("ステップ円コンテナは幅追従クラスを持ち固定 shrink-0 円を使わない", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(queryKeys.home, buildHome());

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/quest"]}>
          <Routes>
            <Route path="/quest" element={<QuestPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const bar = screen.getByRole("progressbar");
    expect(bar.className).toContain("w-full");
    expect(bar.className).toContain("min-w-0");
    const steps = Array.from(bar.children);
    expect(steps).toHaveLength(10);
    for (const step of steps) {
      expect(step.className).toContain("flex-1");
      expect(step.className).toContain("min-w-0");
      expect(step.className).not.toContain("shrink-0");
      expect(step.className).not.toContain("size-8");
    }
  });
});
