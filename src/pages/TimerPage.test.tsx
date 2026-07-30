/**
 * @file TimerPage 描画テスト
 * @description 未確認・残高0でスタートが disabled になることを検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { TimerPage } from "@/pages/TimerPage";
import type { HomeData } from "@/types/api";

/**
 * テスト用 HomeData を組み立てる
 * @param {Partial<HomeData>} [overrides] - 上書き
 * @returns {HomeData} HomeData
 */
function buildHome(overrides: Partial<HomeData> = {}): HomeData {
  return {
    displayBalance: 60,
    penaltyMinutes: 0,
    today: "2026-07-30",
    todayStatus: "completed",
    questAction: "none",
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
 * TimerPage を描画する
 * @param {HomeData} home - ホームデータ
 * @returns {void}
 */
function renderTimer(home: HomeData): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  queryClient.setQueryData(queryKeys.home, home);
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/timer"]}>
        <Routes>
          <Route path="/timer" element={<TimerPage />} />
          <Route path="/results" element={<div>results-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TimerPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("未確認があるときスタートは disabled", () => {
    renderTimer(
      buildHome({
        unacknowledgedCount: 1,
        timerBlockCount: 1,
        canStartTimer: false,
        displayBalance: 60,
      }),
    );

    expect(screen.getByText("採点結果を先に確認してね")).toBeTruthy();
    const start = screen.getByRole("button", { name: "スタート" });
    expect(start.hasAttribute("disabled")).toBe(true);
  });

  it("残高0のときスタートは disabled", () => {
    renderTimer(
      buildHome({
        displayBalance: 0,
        unacknowledgedCount: 0,
        canStartTimer: false,
      }),
    );

    expect(screen.getByText("残高がないので スタートできません")).toBeTruthy();
    const start = screen.getByRole("button", { name: "スタート" });
    expect(start.hasAttribute("disabled")).toBe(true);
  });

  it("未確認なし・残高ありならスタート可能", () => {
    renderTimer(
      buildHome({
        displayBalance: 30,
        unacknowledgedCount: 0,
        canStartTimer: true,
      }),
    );

    const start = screen.getByRole("button", { name: "スタート" });
    expect(start.hasAttribute("disabled")).toBe(false);
  });
});
