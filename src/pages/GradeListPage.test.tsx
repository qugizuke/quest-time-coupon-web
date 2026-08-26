/**
 * @file GradeListPage テスト
 * @description gradeDates API を正とし、stale localStorage 免除を優先しないことを検証する。
 *   Figma 寄せ（Issue #76）: サブ見出し・未採点のみフィルタ・今日タグ・pt 単位も検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { formatDateJa } from "@/lib/date";
import {
  clearParentLocalSettings,
  setExemptPeriods,
} from "@/lib/parentLocalSettings";
import { GradeListPage } from "@/pages/GradeListPage";
import type { GradeDateItem } from "@/types/api";

/** gradeDates レスポンス形 */
type GradeDatesResponse = { dates: GradeDateItem[] };

/** テスト用の今日（2026-08-26 水・ポイント切替日 2026-08-25 の翌日） */
const TODAY = "2026-08-26";

vi.mock("@/lib/date", async () => {
  const actual = await vi.importActual<typeof import("@/lib/date")>("@/lib/date");
  return {
    ...actual,
    todayLocal: () => "2026-08-26",
  };
});

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
 * 行日付ラベル（Figma 寄せ: 全角括弧）
 * @param {string} date - YYYY-MM-DD
 * @returns {string} 例: 2026年8月26日（水）
 */
function rowDateLabel(date: string): string {
  return formatDateJa(date).replace("(", "（").replace(")", "）");
}

/**
 * 日付行の button を取得する
 * @param {string} date - YYYY-MM-DD
 * @returns {HTMLElement} 行ボタン
 */
function getDateRow(date: string): HTMLElement {
  const label = rowDateLabel(date);
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
    setExemptPeriods([{ id: "stale", startDate: TODAY, endDate: TODAY }], TODAY);

    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: TODAY,
          status: "ungraded",
          isExempt: false,
          ungradedCount: 2,
        }),
      ],
    });

    const row = getDateRow(TODAY);
    expect(row.hasAttribute("disabled")).toBe(false);
    expect(within(row).getByText("未採点")).toBeTruthy();
    expect(within(row).queryByText("免除")).toBeNull();
  });

  it("API が graded なら stale localStorage 免除より採点画面へ進める", () => {
    setExemptPeriods([{ id: "stale", startDate: TODAY, endDate: TODAY }], TODAY);

    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: TODAY,
          status: "graded",
          isExempt: false,
          totalPoints: 15,
        }),
      ],
    });

    const row = getDateRow(TODAY);
    expect(row.hasAttribute("disabled")).toBe(false);
    expect(within(row).getByText("+15pt")).toBeTruthy();
    expect(within(row).queryByText("免除")).toBeNull();
  });

  it("API が exempt なら localStorage 未設定でも免除表示で disabled", () => {
    clearParentLocalSettings();

    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: TODAY,
          status: "exempt",
          isExempt: true,
        }),
      ],
    });

    const row = getDateRow(TODAY);
    expect(row.hasAttribute("disabled")).toBe(true);
    expect(within(row).getByText("免除")).toBeTruthy();
  });
});

describe("GradeListPage Figma 寄せ (#76)", () => {
  afterEach(() => {
    cleanup();
    clearParentLocalSettings();
  });

  it("タイトルとサブ見出し「未採点の日をタップして採点」を表示する", () => {
    renderGradeList({ dates: [] });

    expect(screen.getByText("採点日一覧")).toBeTruthy();
    expect(screen.getByText("未採点の日をタップして採点")).toBeTruthy();
  });

  it("行日付は全角括弧で、今日の行にのみ今日タグを表示する", () => {
    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: TODAY,
          status: "ungraded",
          isExempt: false,
          ungradedCount: 1,
        }),
      ],
    });

    const row = getDateRow(TODAY);
    expect(row.textContent).toContain("2026年8月26日（水）");
    expect(within(row).getByText("今日")).toBeTruthy();

    const other = getDateRow("2026-08-27");
    expect(other.textContent).toContain("2026年8月27日（木）");
    expect(within(other).queryByText("今日")).toBeNull();
  });

  it("単位は切替日以降 pt・切替日前は 分（旧）", () => {
    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: "2026-08-24",
          status: "graded",
          isExempt: false,
          totalPoints: 15,
        }),
        buildGradeDateItem({
          date: "2026-08-25",
          status: "graded",
          isExempt: false,
          totalPoints: 20,
        }),
        buildGradeDateItem({
          date: TODAY,
          status: "graded",
          isExempt: false,
          totalPoints: 45,
        }),
      ],
    });

    expect(within(getDateRow("2026-08-24")).getByText("+15分（旧）")).toBeTruthy();
    expect(within(getDateRow("2026-08-25")).getByText("+20pt")).toBeTruthy();
    expect(within(getDateRow(TODAY)).getByText("+45pt")).toBeTruthy();
  });

  it("「未採点のみ」チップで未採点行だけに絞り込む", () => {
    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: "2026-08-24",
          status: "graded",
          isExempt: false,
          totalPoints: 15,
        }),
        buildGradeDateItem({
          date: TODAY,
          status: "ungraded",
          isExempt: false,
          ungradedCount: 2,
        }),
        buildGradeDateItem({
          date: "2026-08-27",
          status: "exempt",
          isExempt: true,
        }),
      ],
    });

    const chip = screen.getByTestId("ungraded-only-chip");
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(getDateRow("2026-08-24")).toBeTruthy();
    expect(getDateRow(TODAY)).toBeTruthy();

    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(getDateRow(TODAY)).toBeTruthy();
    expect(screen.queryByText(rowDateLabel("2026-08-24"))).toBeNull();
    expect(screen.queryByText(rowDateLabel("2026-08-27"))).toBeNull();
    expect(screen.queryByText(rowDateLabel("2026-08-28"))).toBeNull();

    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(getDateRow("2026-08-24")).toBeTruthy();
    expect(getDateRow("2026-08-27")).toBeTruthy();
  });

  it("未採点がない週でフィルタ ON のとき空状態を表示する", () => {
    renderGradeList({
      dates: [
        buildGradeDateItem({
          date: TODAY,
          status: "graded",
          isExempt: false,
          totalPoints: 15,
        }),
      ],
    });

    fireEvent.click(screen.getByTestId("ungraded-only-chip"));

    expect(screen.getByTestId("ungraded-empty").textContent).toBe(
      "未採点の日はありません",
    );
    expect(screen.queryByText(rowDateLabel(TODAY))).toBeNull();
  });
});
