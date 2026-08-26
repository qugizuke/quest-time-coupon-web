/**
 * @file TimerPage 描画テスト
 * @description 未確認・残高0・負債でスタートが disabled になることを検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { TIMER_KEY } from "@/lib/sessionStorage";
import { TimerPage } from "@/pages/TimerPage";
import { buildHomeData } from "@/test/fixtures";
import type { HomeData } from "@/types/api";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return {
    ...actual,
    postSwitchTicketRedeem: vi.fn(async () => ({
      catalogItemId: "switch-30" as const,
      redeemedMinutes: 30,
      switchMinutes: 60,
      rewardVouchers: {
        "snack-10": 0,
        "cash-100": 0,
        "dining-1000": 0,
        "switch-30": 0,
        "switch-60": 0,
      },
    })),
  };
});

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
    vi.clearAllMocks();
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

    expect(screen.getByText("⚠️ 未確認の採点結果があります！")).toBeTruthy();
    expect(screen.getByText("タイマーはロックされています")).toBeTruthy();
    expect(
      screen.getByText(
        "さいてん結果をかくにんしてから、タイマーをつかいましょう。",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /スタート/ })).toBeNull();

    const layout = screen.getByTestId("timer-layout");
    const timer = screen.getByTestId("timer-main");
    const alert = screen.getByTestId("timer-unacked-alert");
    expect(layout.className).toContain("flex-col");
    expect(layout.className).not.toContain("grid");
    expect(layout.firstElementChild).toBe(
      screen.getByTestId("timer-unacked-banner"),
    );
    expect(alert.parentElement).toBe(timer);
    expect(
      screen.getByTestId("switch-ticket-redeem-section").className,
    ).toContain("opacity-60");

    fireEvent.click(screen.getByRole("button", { name: "👀 結果をかくにんする" }));
    expect(screen.getByText("results-page")).toBeTruthy();
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
    expect(screen.getByText("🎮 ゲーム・YouTube共通時間")).toBeTruthy();
    expect(screen.getByText("のこりのゲーム時間")).toBeTruthy();
  });

  it("動作中は安全表示とチケットのロック案内を表示する", () => {
    const now = Date.now();
    sessionStorage.setItem(
      TIMER_KEY,
      JSON.stringify({
        sessionId: "timer-running",
        phase: "running",
        startedAt: now - 15_000,
        initialBalanceMinutes: 30,
        lastTickAt: now,
      }),
    );

    renderTimer(
      buildHomeData({
        displayBalance: 30,
        switchMinutes: 30,
        canStartTimer: true,
      }),
    );

    expect(screen.getByText("⏲️ あんぜんにプレイ中...")).toBeTruthy();
    expect(screen.getByRole("button", { name: "⏸ いちじていし" })).toBeTruthy();
    expect(screen.getByTestId("timer-running-lock").textContent).toContain(
      "タイマー動作中はチケットを使えません",
    );
    expect(screen.queryByTestId("switch-ticket-redeem-section")).toBeNull();
  });

  it("超過中はペナルティ記録の案内を表示する", () => {
    const now = Date.now();
    sessionStorage.setItem(
      TIMER_KEY,
      JSON.stringify({
        sessionId: "timer-penalty",
        phase: "penalty",
        startedAt: now - 75_000,
        initialBalanceMinutes: 1,
        lastTickAt: now,
      }),
    );

    renderTimer(
      buildHomeData({
        displayBalance: 1,
        switchMinutes: 1,
        canStartTimer: true,
      }),
    );

    expect(screen.getByText("⏲️ 超過時間")).toBeTruthy();
    expect(screen.getByText(/\+0:1[45]/)).toBeTruthy();
    expect(
      screen.getByText("超過した時間はペナルティとして記録されます"),
    ).toBeTruthy();
  });

  it("Switch券の保有枚数を表示し、消費すると switchTicketRedeem を呼ぶ", async () => {
    const { postSwitchTicketRedeem } = await import("@/api/client");
    renderTimer(
      buildHomeData({
        displayBalance: 30,
        switchMinutes: 30,
        rewardVouchers: {
          "snack-10": 0,
          "cash-100": 0,
          "dining-1000": 0,
          "switch-30": 2,
          "switch-60": 0,
        },
      }),
    );

    expect(screen.getByTestId("switch-ticket-row-switch-30").textContent).toContain(
      "2枚",
    );
    expect(
      screen.getByTestId("switch-ticket-redeem-switch-60").hasAttribute("disabled"),
    ).toBe(true);

    fireEvent.click(screen.getByTestId("switch-ticket-redeem-switch-30"));

    await waitFor(() => {
      expect(postSwitchTicketRedeem).toHaveBeenCalledWith({
        catalogItemId: "switch-30",
      });
    });
  });
});
