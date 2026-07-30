/**
 * @file ResultsPage 週 UI / reasonCode 表示テスト
 * @description Issue #17 AC: 週ナビ・免除閲覧・完了 CTA 省略・状態区別。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { ResultsPage } from "@/pages/ResultsPage";
import type { HomeData, ResultItem } from "@/types/api";

vi.mock("@/lib/date", async () => {
  const actual = await vi.importActual<typeof import("@/lib/date")>("@/lib/date");
  return {
    ...actual,
    todayLocal: () => "2026-07-30",
  };
});

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
 * @param {object} [opts] - オプション
 * @param {Partial<HomeData>} [opts.homeOverrides] - ホーム上書き
 * @param {string} [opts.initialPath] - 初期パス（クエリ含む）
 * @returns {void}
 */
function renderResults(
  items: ResultItem[],
  opts: { homeOverrides?: Partial<HomeData>; initialPath?: string } = {},
): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.results, { items });
  queryClient.setQueryData(queryKeys.home, {
    ...buildHome(),
    ...opts.homeOverrides,
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[opts.initialPath ?? "/results"]}>
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
    fireEvent.click(screen.getByTestId("results-day-2026-07-28"));
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
    fireEvent.click(screen.getByTestId("results-day-2026-07-29"));
    const msg = screen.getByTestId("reason-code-message");
    expect(msg.getAttribute("data-reason-code")).toBe("grade_rejected");
    expect(msg.textContent).toContain("ママが採点を拒否しました");
    expect(msg.textContent).not.toContain("登録されませんでした");
  });
});

describe("ResultsPage week UI (#17)", () => {
  afterEach(() => {
    cleanup();
  });

  it("月曜始まりの週ナビと7日行を表示する", () => {
    renderResults([]);
    expect(screen.getByTestId("results-week-list")).toBeTruthy();
    expect(screen.getByTestId("results-week-label").textContent).toContain("7月27日の週");
    expect(screen.getByTestId("results-day-2026-07-27")).toBeTruthy();
    expect(screen.getByTestId("results-day-2026-08-02")).toBeTruthy();
  });

  it("未確認日は赤枠強調する", () => {
    renderResults([
      buildResult({
        date: "2026-07-28",
        reasonCode: "normal",
        totalPoints: 30,
        acknowledged: false,
        requiresAck: true,
      }),
    ]);
    const row = screen.getByTestId("results-day-2026-07-28");
    expect(row.getAttribute("data-unacked")).toBe("true");
    expect(row.className).toContain("border-danger");
  });

  it("免除日は閲覧でき、確認した CTA を出さない", () => {
    renderResults([
      buildResult({
        date: "2026-07-30",
        reasonCode: "exempt",
        totalPoints: 0,
        acknowledged: true,
        requiresAck: false,
      }),
    ]);
    const row = screen.getByTestId("results-day-2026-07-30");
    expect(row.getAttribute("data-reason-code")).toBe("exempt");
    fireEvent.click(row);
    expect(screen.getByTestId("reason-code-message").textContent).toContain(
      "今日はクエスト免除日でした",
    );
    expect(screen.queryByTestId("results-ack-button")).toBeNull();
    expect(screen.getByTestId("results-back-to-week")).toBeTruthy();
  });

  it("免除日詳細から週一覧に戻り、過去の未確認日を開ける", () => {
    renderResults([
      buildResult({
        date: "2026-07-28",
        reasonCode: "unregistered",
        totalPoints: -60,
        acknowledged: false,
        requiresAck: true,
      }),
      buildResult({
        date: "2026-07-30",
        reasonCode: "exempt",
        totalPoints: 0,
        acknowledged: true,
        requiresAck: false,
      }),
    ]);
    fireEvent.click(screen.getByTestId("results-day-2026-07-30"));
    expect(screen.getByTestId("results-day-detail")).toBeTruthy();
    fireEvent.click(screen.getByTestId("results-back-to-week"));
    fireEvent.click(screen.getByTestId("results-day-2026-07-28"));
    expect(screen.getByTestId("reason-code-message").getAttribute("data-reason-code")).toBe(
      "unregistered",
    );
    expect(screen.getByTestId("results-ack-button")).toBeTruthy();
  });

  it("通常導線は今週を初期表示する（未確認があっても）", () => {
    renderResults([
      buildResult({
        date: "2026-07-21",
        reasonCode: "normal",
        totalPoints: 20,
        acknowledged: false,
        requiresAck: true,
      }),
      buildResult({
        date: "2026-07-29",
        reasonCode: "normal",
        totalPoints: 10,
        acknowledged: false,
        requiresAck: true,
      }),
    ]);
    expect(screen.getByTestId("results-week-label").textContent).toContain("7月27日の週");
    expect(screen.getByTestId("results-day-2026-07-29")).toBeTruthy();
  });

  it("未確認バナー経由（?unacked=1）は最古の未確認日の週を開く", () => {
    renderResults(
      [
        buildResult({
          date: "2026-07-21",
          reasonCode: "normal",
          totalPoints: 20,
          acknowledged: false,
          requiresAck: true,
        }),
        buildResult({
          date: "2026-07-29",
          reasonCode: "normal",
          totalPoints: 10,
          acknowledged: false,
          requiresAck: true,
        }),
      ],
      { initialPath: "/results?unacked=1" },
    );
    expect(screen.getByTestId("results-week-label").textContent).toContain("7月20日の週");
    expect(screen.getByTestId("results-day-2026-07-21")).toBeTruthy();
  });

  it("前週ナビで過去週へ移動できる", () => {
    renderResults([
      buildResult({
        date: "2026-07-21",
        reasonCode: "exempt",
        totalPoints: 0,
        acknowledged: true,
        requiresAck: false,
      }),
    ]);
    // 未確認が無いので今週（7/27）から開始 → 前週へ
    fireEvent.click(screen.getByTestId("results-prev-week"));
    expect(screen.getByTestId("results-week-label").textContent).toContain("7月20日の週");
    const day = screen.getByTestId("results-day-2026-07-21");
    expect(within(day).getByText(/免除/)).toBeTruthy();
  });
});
