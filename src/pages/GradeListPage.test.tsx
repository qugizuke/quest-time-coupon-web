/**
 * @file GradeListPage テスト
 * @description gradeDates API を正とし、stale localStorage 免除を優先しないことを検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { formatDateJa, todayLocal } from "@/lib/date";
import {
  clearParentLocalSettings,
  setExemptPeriods,
} from "@/lib/parentLocalSettings";
import { GradeListPage } from "@/pages/GradeListPage";
import type { GradeDateItem } from "@/types/api";

/** gradeDates レスポンス形 */
type GradeDatesResponse = { dates: GradeDateItem[] };

/**
 * GradeDateItem を組み立てる
 * @param {Partial<GradeDateItem> & Pick<GradeDateItem, "date" | "status">} partial - 必須＋上書き
 * @returns {GradeDateItem} GradeDateItem
 */
function buildGradeDateItem(
  partial: Partial<GradeDateItem> & Pick<GradeDateItem, "date" | "status">,
): GradeDateItem {
  const isExempt = partial.isExempt ?? partial.status === "exempt";
  return {
    ungradedCount: partial.status === "ungraded" ? 1 : 0,
    totalPoints: partial.status === "graded" ? 10 : null,
    reasonCode: null,
    isExempt,
    ...partial,
  };
}

/**
 * GradeListPage を描画する
 * @param {GradeDatesResponse} gradeDates - gradeDates API データ
 * @returns {void}
 */
function renderGradeList(gradeDates: GradeDatesResponse): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.gradeDates, gradeDates);
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/parent/grades"]}>
        <Routes>
          <Route path="/parent/grades" element={<GradeListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * 日付行の button を取得する
 * @param {string} date - YYYY-MM-DD
 * @returns {HTMLElement} 行ボタン
 */
function getDateRow(date: string): HTMLElement {
  const label = formatDateJa(date);
  const buttons = screen.getAllByRole("button");
  const row = buttons.find((el) => el.textContent?.includes(label));
  if (!row) {
    throw new Error(`getDateRow: 日付行が見つかりません date=${date} label=${label}`);
  }
  return row;
}

describe("GradeListPage gradeDates 正", () => {
  afterEach(() => {
    cleanup();
    clearParentLocalSettings();
  });

  it("API が ungraded なら stale localStorage 免除より採点へ進める", () => {
    const today = todayLocal();
    setExemptPeriods([{ id: "stale", startDate: today, endDate: today }], today);

    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: today,
          status: "ungraded",
          isExempt: false,
          ungradedCount: 2,
        }),
      ],
    });

    const row = getDateRow(today);
    expect(row.hasAttribute("disabled")).toBe(false);
    expect(within(row).getByText("未採点")).toBeTruthy();
    expect(within(row).queryByText("免除")).toBeNull();
  });

  it("API が graded なら stale localStorage 免除より採点画面へ進める", () => {
    const today = todayLocal();
    setExemptPeriods([{ id: "stale", startDate: today, endDate: today }], today);

    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: today,
          status: "graded",
          isExempt: false,
          totalPoints: 15,
        }),
      ],
    });

    const row = getDateRow(today);
    expect(row.hasAttribute("disabled")).toBe(false);
    expect(within(row).getByText("+15分")).toBeTruthy();
    expect(within(row).queryByText("免除")).toBeNull();
  });

  it("API が exempt なら localStorage 未設定でも免除表示で disabled", () => {
    const today = todayLocal();
    clearParentLocalSettings();

    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: today,
          status: "exempt",
          isExempt: true,
        }),
      ],
    });

    const row = getDateRow(today);
    expect(row.hasAttribute("disabled")).toBe(true);
    expect(within(row).getByText("免除")).toBeTruthy();
  });
});
