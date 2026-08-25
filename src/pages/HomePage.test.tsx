/**
 * @file HomePage 描画テスト
 * @description ホーム 4 バリアントの導線・就寝 UI・免除メッセージを検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { HomePage } from "@/pages/HomePage";
import type { HomeData } from "@/types/api";

/**
 * テスト用 HomeData を組み立てる
 * @param {Partial<HomeData>} [overrides] - 上書き
 * @returns {HomeData} HomeData
 */
function buildHome(overrides: Partial<HomeData> = {}): HomeData {
  return {
    displayBalance: 60,
    balancePoints: 0,
    switchMinutes: 60,
    penaltyMinutes: 0,
    debtMinutes: 0,
    issuablePenaltyTicketCount: 0,
    penaltyTicketCount: 0,
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
    ...overrides,
  };
}

/**
 * HomePage を描画する
 * @param {HomeData} home - ホームデータ
 * @returns {void}
 */
function renderHome(home: HomeData): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  queryClient.setQueryData(queryKeys.home, home);
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/results" element={<div>results-page</div>} />
          <Route path="/timer" element={<div>timer-page</div>} />
          <Route path="/quest" element={<div>quest-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 就寝設定は18時までのため午前に固定
    vi.setSystemTime(new Date(2026, 6, 30, 10, 0, 0));
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("免除日でも採点結果導線を残す", () => {
    renderHome(
      buildHome({
        isExemptDay: true,
        todayStatus: "completed",
        questAction: "none",
      }),
    );

    expect(screen.getByTestId("home-page").getAttribute("data-home-variant")).toBe(
      "kid-home-exempt",
    );
    expect(screen.getByTestId("exempt-message")).toBeTruthy();
    expect(screen.getByTestId("nav-results")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "⚔️ クエストをはじめる！" }),
    ).toBeNull();
  });

  it("exempt-vacation では就寝 UI を出さない", () => {
    renderHome(
      buildHome({
        isExemptDay: true,
        isVacationMode: true,
        todayStatus: "completed",
        questAction: "none",
      }),
    );

    expect(screen.getByTestId("home-page").getAttribute("data-home-variant")).toBe(
      "kid-home-exempt-vacation",
    );
    expect(screen.queryByTestId("bedtime-entry")).toBeNull();
    expect(screen.queryByTestId("bedtime-display")).toBeNull();
    expect(screen.queryByTestId("bedtime-locked")).toBeNull();
    expect(screen.getByText("🏖️ 長期休みモード")).toBeTruthy();
  });

  it("vacation の未回答では就寝設定入口を出す", () => {
    renderHome(
      buildHome({
        isVacationMode: true,
        todayStatus: "unanswered",
        questAction: "start",
      }),
    );

    expect(screen.getByTestId("home-page").getAttribute("data-home-variant")).toBe(
      "kid-home-vacation",
    );
    expect(screen.getByTestId("bedtime-entry")).toBeTruthy();
  });

  it("受付再開中は締切後でもクエスト開始ボタンを有効にする", () => {
    vi.setSystemTime(new Date(2026, 7, 8, 22, 0, 0));

    renderHome(
      buildHome({
        today: "2026-08-08",
        todayStatus: "unanswered",
        questAction: "start",
        registrationReopen: {
          endsAt: "2026-08-08T22:30:00+09:00",
          setAt: "2026-08-08T21:30:00+09:00",
          used: true,
          isOpen: true,
        },
      }),
    );

    expect(screen.getByTestId("reopen-active-hint")).toBeTruthy();
    const startButton = screen.getByRole("button", {
      name: "⚔️ クエストをはじめる！",
    });
    expect(startButton.hasAttribute("disabled")).toBe(false);
  });

  it("負残高を表示し、発行 UI は出さない", () => {
    renderHome(
      buildHome({
        displayBalance: -30,
        switchMinutes: -30,
        debtMinutes: 30,
        penaltyMinutes: 0,
        issuablePenaltyTicketCount: 0,
        todayStatus: "completed",
        questAction: "none",
      }),
    );

    expect(screen.getByTestId("balance-minutes").textContent).toBe("-30");
    expect(screen.getByTestId("balance-debt-minutes").textContent).toContain(
      "30分",
    );
    expect(screen.getByTestId("balance-child-hint")).toBeTruthy();
    expect(screen.queryByTestId("penalty-ticket-issue-section")).toBeNull();
  });
});
