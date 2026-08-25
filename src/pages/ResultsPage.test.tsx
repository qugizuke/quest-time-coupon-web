/**
 * @file ResultsPage 週 UI / reasonCode 表示テスト
 * @description Issue #17 AC: 週ナビ・免除閲覧・完了 CTA 省略・状態区別。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { ResultsPage } from "@/pages/ResultsPage";
import { TimerPage } from "@/pages/TimerPage";
import type { HomeData, ResultItem } from "@/types/api";

const apiMocks = vi.hoisted(() => ({
  fetchDailyQuests: vi.fn(),
  fetchGrade: vi.fn(),
  fetchGradeDates: vi.fn(),
  fetchHome: vi.fn(),
  fetchLongVacation: vi.fn(),
  fetchParentHome: vi.fn(),
  fetchQuestExemptions: vi.fn(),
  fetchResults: vi.fn(),
  postResultsAck: vi.fn(),
}));

vi.mock("@/api/client", () => apiMocks);

vi.mock("@/lib/date", async () => {
  const actual = await vi.importActual<typeof import("@/lib/date")>("@/lib/date");
  return {
    ...actual,
    todayLocal: () => "2026-07-30",
  };
});

beforeEach(() => {
  apiMocks.fetchDailyQuests.mockResolvedValue({
    date: "2026-07-30",
    version: "test",
    generationMode: "fixed_seed",
    quests: [],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * 最小 HomeData
 * @returns {HomeData} HomeData
 */
function buildHome(): HomeData {
  return {
    displayBalance: 0,
    balancePoints: 0,
    switchMinutes: 0,
    penaltyMinutes: 0,
    debtMinutes: 0,
    issuablePenaltyTicketCount: 0,
    penaltyTicketCount: 0,
    today: "2026-07-30",
    todayStatus: "pending_ack",
    questAction: "none",
    unacknowledgedCount: 1,
    canStartTimer: false,
    timerBlockCount: 1,
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
 * @param {ReactNode} [opts.homeElement] - ack 後の遷移先要素
 * @returns {QueryClient} テスト用 QueryClient
 */
function renderResults(
  items: ResultItem[],
  opts: {
    homeOverrides?: Partial<HomeData>;
    initialPath?: string;
    homeElement?: ReactNode;
  } = {},
): QueryClient {
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
          <Route path="/" element={opts.homeElement ?? <div>home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("ResultsPage reasonCode", () => {
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

  it("home再取得に失敗しても結果確認後の残高をタイマーへ引き継ぐ", async () => {
    const pending = buildResult({
      date: "2026-07-30",
      reasonCode: "normal",
      totalPoints: 45,
      acknowledged: false,
      requiresAck: true,
      blocksTimer: true,
    });
    apiMocks.postResultsAck.mockResolvedValue({
      appliedDelta: 45,
      penaltyOffset: 0,
      balancePoints: 45,
      switchMinutes: 45,
      displayBalance: 45,
      penaltyMinutes: 0,
      debtMinutes: 0,
      issuablePenaltyTicketCount: 0,
    });
    apiMocks.fetchHome.mockRejectedValue(new Error("home refetch failed"));
    apiMocks.fetchResults.mockRejectedValue(new Error("results refetch failed"));

    renderResults([pending], { homeElement: <TimerPage /> });
    fireEvent.click(screen.getByTestId("results-day-2026-07-30"));
    fireEvent.click(screen.getByTestId("results-ack-button"));

    await waitFor(() => {
      expect(screen.getByText("45:00")).toBeTruthy();
    });
    expect(apiMocks.postResultsAck).toHaveBeenCalledWith("2026-07-30");
    expect(
      screen.getByRole("button", { name: /スタート/ }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("未確認が複数ある場合は確認済み分だけ件数を減らす", async () => {
    const first = buildResult({
      date: "2026-07-29",
      reasonCode: "normal",
      totalPoints: 20,
      acknowledged: false,
      requiresAck: true,
      blocksTimer: true,
    });
    const second = buildResult({
      date: "2026-07-30",
      reasonCode: "grade_rejected",
      totalPoints: -60,
      acknowledged: false,
      requiresAck: true,
      blocksTimer: true,
    });
    apiMocks.postResultsAck.mockResolvedValue({
      appliedDelta: 20,
      penaltyOffset: 0,
      balancePoints: 20,
      switchMinutes: 20,
      displayBalance: 20,
      penaltyMinutes: 0,
      debtMinutes: 0,
      issuablePenaltyTicketCount: 0,
    });
    apiMocks.fetchHome.mockRejectedValue(new Error("home refetch failed"));
    apiMocks.fetchResults.mockRejectedValue(new Error("results refetch failed"));

    const queryClient = renderResults([first, second], {
      homeOverrides: {
        unacknowledgedCount: 2,
        timerBlockCount: 2,
      },
    });
    fireEvent.click(screen.getByTestId("results-day-2026-07-29"));
    fireEvent.click(screen.getByTestId("results-ack-button"));

    await waitFor(() => {
      expect(screen.getByTestId("results-week-list")).toBeTruthy();
    });
    const home = queryClient.getQueryData<HomeData>(queryKeys.home);
    expect(home?.displayBalance).toBe(20);
    expect(home?.unacknowledgedCount).toBe(1);
    expect(home?.timerBlockCount).toBe(1);
    expect(home?.canStartTimer).toBe(false);
    expect(screen.getByTestId("results-day-2026-07-30").dataset.unacked).toBe(
      "true",
    );
  });

  it("ack失敗後に別日を開いても前日のエラーを表示しない", async () => {
    const first = buildResult({
      date: "2026-07-29",
      reasonCode: "normal",
      totalPoints: 20,
      acknowledged: false,
      requiresAck: true,
      blocksTimer: true,
    });
    const second = buildResult({
      date: "2026-07-30",
      reasonCode: "normal",
      totalPoints: 10,
      acknowledged: false,
      requiresAck: true,
      blocksTimer: true,
    });
    apiMocks.postResultsAck.mockRejectedValue(new Error("ack failed"));

    renderResults([first, second]);
    fireEvent.click(screen.getByTestId("results-day-2026-07-29"));
    fireEvent.click(screen.getByTestId("results-ack-button"));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "ack failed",
    );

    fireEvent.click(screen.getByTestId("results-back-to-week"));
    fireEvent.click(screen.getByTestId("results-day-2026-07-30"));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
