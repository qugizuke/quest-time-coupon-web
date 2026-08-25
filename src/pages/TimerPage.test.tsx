/**
 * @file TimerPage 描画テスト
 * @description 未確認・残高0・負債でスタートが disabled になることを検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { TimerPage } from "@/pages/TimerPage";
import { buildHomeData } from "@/test/fixtures";
import type { HomeData } from "@/types/api";

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
      buildHomeData({
        unacknowledgedCount: 1,
        timerBlockCount: 1,
        canStartTimer: false,
        displayBalance: 60,
        switchMinutes: 60,
      }),
    );

    expect(screen.getByText("未確認の採点結果があります。")).toBeTruthy();
    const start = screen.getByRole("button", { name: /スタート/ });
    expect(start.hasAttribute("disabled")).toBe(true);

    const layout = screen.getByTestId("timer-layout");
    const timer = screen.getByTestId("timer-main");
    const alert = screen.getByTestId("timer-unacked-alert");
    expect(layout.className).toContain("flex-col");
    expect(layout.className).not.toContain("grid");
    expect(layout.firstElementChild).toBe(timer);
    expect(timer.nextElementSibling).toBe(alert);
  });

  it("残高0のときスタートは disabled", () => {
    renderTimer(
      buildHomeData({
        displayBalance: 0,
        switchMinutes: 0,
        debtMinutes: 0,
        unacknowledgedCount: 0,
        canStartTimer: false,
      }),
    );

    expect(screen.getByText("残高がないので スタートできません")).toBeTruthy();
    const start = screen.getByRole("button", { name: /スタート/ });
    expect(start.hasAttribute("disabled")).toBe(true);
  });

  it("タイマー超過負債はマイナス表記し、次の加算との相殺を説明する", () => {
    renderTimer(
      buildHomeData({
        displayBalance: 0,
        switchMinutes: 0,
        penaltyMinutes: 15,
        debtMinutes: 15,
        canStartTimer: false,
      }),
    );

    expect(screen.getByText("タイマー超過の負債")).toBeTruthy();
    expect(screen.getByText("-15:00")).toBeTruthy();
    expect(screen.getByText("次のごほうび時間から 15 分を相殺します")).toBeTruthy();
    expect(screen.getByRole("button", { name: /スタート/ }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("残高があってもタイマー超過負債が残っていればスタートできない", () => {
    renderTimer(
      buildHomeData({
        displayBalance: 10,
        switchMinutes: 10,
        penaltyMinutes: 5,
        debtMinutes: 5,
        canStartTimer: true,
      }),
    );

    expect(screen.getByText("-5:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: /スタート/ }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("負残高の負債中はスタート不可と理由を表示する", () => {
    renderTimer(
      buildHomeData({
        displayBalance: -30,
        switchMinutes: -30,
        penaltyMinutes: 0,
        debtMinutes: 30,
        canStartTimer: false,
      }),
    );

    expect(screen.getByTestId("timer-start-block-reason").textContent).toMatch(
      /負債/,
    );
    expect(screen.getByRole("button", { name: /スタート/ }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("未確認なし・残高ありならスタート可能", () => {
    renderTimer(
      buildHomeData({
        displayBalance: 30,
        switchMinutes: 30,
        unacknowledgedCount: 0,
        canStartTimer: true,
      }),
    );

    const start = screen.getByRole("button", { name: /スタート/ });
    expect(start.hasAttribute("disabled")).toBe(false);
  });
});
