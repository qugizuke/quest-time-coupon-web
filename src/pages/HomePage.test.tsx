/**
 * @file HomePage 描画テスト
 * @description ホーム 4 バリアントの導線・就寝 UI・免除メッセージを検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { zeroRewardVouchers } from "@/lib/rewardVouchers";
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

  it("免除日は Figma どおり休日バナー・就寝・無効 CTA・各導線を表示する", () => {
    renderHome(
      buildHome({
        isExemptDay: true,
        balancePoints: 120,
        bedtimeHour: 22,
        todayStatus: "exempt",
        questAction: "none",
      }),
    );

    expect(screen.getByTestId("home-page").getAttribute("data-home-variant")).toBe(
      "kid-home-exempt",
    );
    expect(screen.getByTestId("exempt-message").textContent).toBe(
      "今日はクエストお休みです",
    );
    expect(screen.getByTestId("bedtime-display").textContent).toContain("22時");
    const startButton = screen.getByRole("button", {
      name: "🎯 クエストをはじめる！",
    });
    expect(startButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("nav-results")).toBeTruthy();
    expect(screen.getByTestId("nav-rewards")).toBeTruthy();
    expect(screen.getByTestId("nav-timer")).toBeTruthy();
    expect(screen.getByRole("button", { name: "クエストのルール" })).toBeTruthy();
    // 免除日（vacation でない）はヒーローにチケットリンクあり
    expect(screen.getByText("🎫 チケットをみる →")).toBeTruthy();

    const page = screen.getByTestId("home-page");
    const children = Array.from(page.children);
    const sectionIndex = (element: HTMLElement) => {
      let section = element;
      while (section.parentElement && section.parentElement !== page) {
        section = section.parentElement;
      }
      return children.indexOf(section);
    };
    expect(sectionIndex(screen.getByTestId("exempt-message"))).toBeLessThan(
      sectionIndex(screen.getByTestId("balance-display")),
    );
    expect(sectionIndex(screen.getByTestId("balance-display"))).toBeLessThan(
      sectionIndex(screen.getByTestId("bedtime-display")),
    );
    expect(sectionIndex(screen.getByTestId("bedtime-display"))).toBeLessThan(
      sectionIndex(startButton),
    );
  });

  it("exempt-vacation は就寝 UI 固定表示かつ簡略ヒーロー（チケットリンクなし）", () => {
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
    expect(screen.getByTestId("bedtime-locked").textContent).toContain("21時");
    expect(screen.getByText("🏖️ 長期休みモード")).toBeTruthy();
    // 簡略ヒーロー: チケットリンクなし・ポイント表示あり（D2・Issue #66）
    expect(screen.queryByText("🎫 チケットをみる →")).toBeNull();
    expect(screen.getByTestId("balance-display")).toBeTruthy();
    expect(screen.getByTestId("balance-points")).toBeTruthy();
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

  it("移行期間フラグをクエストルールへ渡す", () => {
    renderHome(
      buildHome({
        isVacationMode: true,
        isVacationTransition: true,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "クエストのルール" }));

    expect(screen.getByTestId("quest-rules-vacation-transition")).toBeTruthy();
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
      name: "🎯 クエストをはじめる！",
    });
    expect(startButton.hasAttribute("disabled")).toBe(false);
  });

  it("負残高を表示し、発行 UI は出さない", () => {
    renderHome(
      buildHome({
        balancePoints: -30,
        displayBalance: -30,
        switchMinutes: -30,
        debtMinutes: 30,
        penaltyMinutes: 0,
        issuablePenaltyTicketCount: 0,
        todayStatus: "completed",
        questAction: "none",
      }),
    );

    expect(screen.getByTestId("balance-points").textContent).toBe("-30");
    expect(screen.queryByTestId("balance-minutes")).toBeNull();
    expect(screen.getByTestId("point-debt-banner")).toBeTruthy();
    expect(screen.queryByTestId("penalty-ticket-issue-section")).toBeNull();
  });

  it("通常の平日も固定の就寝時刻をポイント直下に表示する", () => {
    renderHome(buildHome());

    expect(screen.getByTestId("bedtime-locked").textContent).toContain("21時");
    expect(screen.queryByText("きょうの状態")).toBeNull();
    expect(
      screen.getByRole("button", { name: "🎯 クエストをはじめる！" }),
    ).toBeTruthy();
  });

  it("未確認バナーからルールまでを Figma の順番で表示する", () => {
    renderHome(buildHome({ unacknowledgedCount: 1 }));

    const page = screen.getByTestId("home-page");
    const children = Array.from(page.children);
    const indexOfSection = (element: HTMLElement) => {
      let section = element;
      while (section.parentElement && section.parentElement !== page) {
        section = section.parentElement;
      }
      return children.indexOf(section);
    };

    const unread = screen.getByRole("button", {
      name: "採点結果を確認する（未確認あり！）",
    });
    const balance = screen.getByTestId("balance-display");
    const bedtime = screen.getByTestId("bedtime-locked");
    const quest = screen.getByRole("button", {
      name: "🎯 クエストをはじめる！",
    });
    const results = screen.getByTestId("nav-results");
    const rules = screen.getByRole("button", { name: "クエストのルール" });

    expect(indexOfSection(unread)).toBeLessThan(indexOfSection(balance));
    expect(indexOfSection(balance)).toBeLessThan(indexOfSection(bedtime));
    expect(indexOfSection(bedtime)).toBeLessThan(indexOfSection(quest));
    expect(indexOfSection(quest)).toBeLessThan(indexOfSection(results));
    expect(indexOfSection(results)).toBeLessThan(indexOfSection(rules));
  });

  it("vacation 移行期間はオレンジの移行バナーをポイント表示より上に出す", () => {
    renderHome(
      buildHome({ isVacationMode: true, isVacationTransition: true }),
    );

    expect(screen.getByTestId("home-page").getAttribute("data-home-variant")).toBe(
      "kid-home-vacation",
    );
    const banner = screen.getByTestId("vacation-transition-banner");
    expect(banner.textContent).toContain("1週間前");
    expect(banner.textContent).toContain("21時");
    // 移行期間中は就寝は21時固定
    expect(screen.getByTestId("bedtime-locked").textContent).toContain("21時");

    const page = screen.getByTestId("home-page");
    const children = Array.from(page.children);
    const indexOfSection = (element: HTMLElement) => {
      let section = element;
      while (section.parentElement && section.parentElement !== page) {
        section = section.parentElement;
      }
      return children.indexOf(section);
    };
    expect(indexOfSection(banner)).toBeLessThan(
      indexOfSection(screen.getByTestId("balance-display")),
    );
  });

  it("vacation の CTA 順序は quest→results→exchange→timer→rules", () => {
    renderHome(buildHome({ isVacationMode: true }));

    const page = screen.getByTestId("home-page");
    const children = Array.from(page.children);
    const indexOfSection = (element: HTMLElement) => {
      let section = element;
      while (section.parentElement && section.parentElement !== page) {
        section = section.parentElement;
      }
      return children.indexOf(section);
    };
    const indexAmongSiblings = (el: HTMLElement) => {
      const parent = el.parentElement;
      return parent ? Array.from(parent.children).indexOf(el) : -1;
    };

    const quest = screen.getByRole("button", { name: "🎯 クエストをはじめる！" });
    const results = screen.getByTestId("nav-results");
    const exchange = screen.getByTestId("nav-rewards");
    const timer = screen.getByTestId("nav-timer");
    const rules = screen.getByRole("button", { name: "クエストのルール" });

    // quest section before the nav section
    expect(indexOfSection(quest)).toBeLessThan(indexOfSection(results));
    // within the nav section: results -> exchange -> timer
    expect(indexAmongSiblings(results)).toBeLessThan(indexAmongSiblings(exchange));
    expect(indexAmongSiblings(exchange)).toBeLessThan(indexAmongSiblings(timer));
    // nav section before rules
    expect(indexOfSection(timer)).toBeLessThan(indexOfSection(rules));
  });
});
