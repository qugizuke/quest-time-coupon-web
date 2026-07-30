/**
 * @file ResultsPage reasonCode 表示テスト
 * @description unregistered と grade_rejected を同一 -60 でも文言分岐する（契約 §6.3）。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { ResultsPage } from "@/pages/ResultsPage";
import type { HomeData, ResultItem } from "@/types/api";

/**
 * 最小 HomeData
 * @returns {HomeData} HomeData
 */
function buildHome(): HomeData {
  return {
    displayBalance: 0,
    penaltyMinutes: 0,
    today: "2026-07-30",
    todayStatus: "pending_ack",
    questAction: "none",
    unacknowledgedCount: 1,
    canStartTimer: false,
    timerBlockCount: 1,
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
  };
}

/**
 * ResultItem を組み立てる
 * @param {Partial<ResultItem>} overrides - 上書き
 * @returns {ResultItem} ResultItem
 */
function buildResult(overrides: Partial<ResultItem>): ResultItem {
  return {
    date: "2026-07-28",
    totalPoints: -60,
    acknowledged: false,
    reasonCode: "unregistered",
    registrationTimingAdjustment: 0,
    details: [],
    requiresAck: true,
    blocksTimer: false,
    ...overrides,
  };
}

/**
 * ResultsPage を描画する
 * @param {ResultItem[]} items - 結果一覧
 * @returns {void}
 */
function renderResults(items: ResultItem[]): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.results, { items });
  queryClient.setQueryData(queryKeys.home, buildHome());
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/results"]}>
        <Routes>
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ResultsPage reasonCode", () => {
  afterEach(() => {
    cleanup();
  });

  it("unregistered は未登録理由文を表示する", () => {
    renderResults([
      buildResult({
        date: "2026-07-28",
        reasonCode: "unregistered",
        blocksTimer: false,
      }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: /7月28日/ }));
    const msg = screen.getByTestId("reason-code-message");
    expect(msg.getAttribute("data-reason-code")).toBe("unregistered");
    expect(msg.textContent).toContain("クエストが登録されませんでした");
    expect(msg.textContent).not.toContain("採点を拒否");
  });

  it("grade_rejected は拒否理由文を表示する", () => {
    renderResults([
      buildResult({
        date: "2026-07-29",
        reasonCode: "grade_rejected",
        blocksTimer: true,
      }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: /7月29日/ }));
    const msg = screen.getByTestId("reason-code-message");
    expect(msg.getAttribute("data-reason-code")).toBe("grade_rejected");
    expect(msg.textContent).toContain("ママが採点を拒否しました");
    expect(msg.textContent).not.toContain("登録されませんでした");
  });
});
