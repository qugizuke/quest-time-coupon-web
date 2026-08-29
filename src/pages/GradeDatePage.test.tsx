/**
 * @file GradeDatePage 採点修正テスト
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { GradeDatePage } from "@/pages/GradeDatePage";
import type { DailyQuests, GradeData, GradeDateItem } from "@/types/api";

const apiMocks = vi.hoisted(() => ({
  postGrade: vi.fn(),
  postGradeReject: vi.fn(),
  postGradeCorrection: vi.fn(),
  fetchGrade: vi.fn(),
  fetchDailyQuests: vi.fn(),
  fetchGradeDates: vi.fn(),
}));

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/client")>()),
  ...apiMocks,
}));

const DATE = "2026-08-25";
const CORRECTION_ID = "4ef59ef0-1e40-4c48-9fe3-e88a35d7be24";

const daily: DailyQuests = {
  date: DATE,
  version: 1,
  generationMode: "fixed_seed",
  quests: [
    {
      id: "brush-teeth-gargle-am",
      order: 1,
      title: "歯みがき・うがい",
    },
  ],
};

/**
 * テスト用の採点データを組み立てる
 * @param {Partial<GradeData>} overrides - 上書き
 * @returns {GradeData} 採点データ
 */
function buildGrade(overrides: Partial<GradeData> = {}): GradeData {
  return {
    date: DATE,
    submittedAt: "2026-08-25T20:00:00+09:00",
    withinBonusWindow: true,
    isExempt: false,
    alreadyGraded: true,
    reasonCode: "normal",
    gradingRevision: 1,
    originalGradedAt: "2026-08-25T20:10:00+09:00",
    lastCorrectedAt: "",
    acknowledged: false,
    canCorrect: true,
    cannotCorrectReason: null,
    items: [
      {
        questId: "brush-teeth-gargle-am",
        childAnswer: 1,
        actualDone: true,
        gradingMode: "parent_choice",
        autoOutcome: null,
      },
    ],
    adjustments: [],
    totalPoints: 45,
    isGraded: true,
    isRejected: false,
    withinBonusDeadline: true,
    ...overrides,
  };
}

/**
 * 採点詳細を描画する
 * @param {GradeData} grade - 採点データ
 * @param {{ gradeDates?: GradeDateItem[] }} [opts] - gradeDates キャッシュ
 * @returns {QueryClient} クエリクライアント
 */
function renderPage(
  grade: GradeData,
  opts?: { gradeDates?: GradeDateItem[] },
) {
  apiMocks.fetchGrade.mockResolvedValue(grade);
  apiMocks.fetchDailyQuests.mockResolvedValue(daily);
  apiMocks.fetchGradeDates.mockResolvedValue({ dates: opts?.gradeDates ?? [] });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(queryKeys.grade(DATE), grade);
  queryClient.setQueryData(queryKeys.dailyQuests(DATE), daily);
  queryClient.setQueryData(queryKeys.gradeDates, {
    dates: opts?.gradeDates ?? [],
  });
  queryClient.setQueryData(["gradeAdjustmentDefinitions"], {
    version: 1,
    items: [
      { kind: "bonus", code: "helped", label: "お手伝いをした" },
      { kind: "penalty", code: "lied", label: "嘘をついた" },
    ],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/parent/grades/${DATE}`]}>
        <Routes>
          <Route path="/parent/grades/:date" element={<GradeDatePage />} />
          <Route path="/parent/grades" element={<p>採点一覧</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("GradeDatePage 採点修正", () => {
  beforeEach(() => {
    apiMocks.postGradeCorrection.mockResolvedValue({
      revision: 2,
      reasonCode: "normal",
      totalPoints: 0,
      correctedAt: "2026-08-25T21:00:00+09:00",
      affectedDates: [DATE],
      resetAcknowledgementDates: [],
      balancePoints: 0,
    });
    vi.stubGlobal("crypto", { randomUUID: () => CORRECTION_ID });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("保存値から編集を開始し、確認後にrevision付きで通常採点を修正する", async () => {
    const queryClient = renderPage(buildGrade());

    expect(screen.getByRole("button", { name: "できた（⭕️）" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "採点を修正" }));
    act(() => {
      queryClient.setQueryData(queryKeys.grade(DATE), buildGrade({ gradingRevision: 2 }));
    });
    fireEvent.click(screen.getByRole("button", { name: "できていない（❌）" }));
    fireEvent.click(screen.getByRole("button", { name: "採点を修正して確定" }));

    expect(screen.getByRole("dialog").textContent).toContain("確認済みの結果が未確認に戻る");
    fireEvent.click(screen.getByRole("button", { name: "修正を確定" }));

    await waitFor(() => expect(apiMocks.postGradeCorrection).toHaveBeenCalledTimes(1));
    expect(apiMocks.postGradeCorrection).toHaveBeenCalledWith({
      correctionId: CORRECTION_ID,
      date: DATE,
      expectedRevision: 1,
      resultType: "normal",
      grades: [{ questId: "brush-teeth-gargle-am", actualDone: false }],
      adjustments: [],
    });
  });

  it("キャンセルすると保存済み判定へ戻す", () => {
    renderPage(buildGrade());

    fireEvent.click(screen.getByRole("button", { name: "採点を修正" }));
    fireEvent.click(screen.getByRole("button", { name: "できていない（❌）" }));
    fireEvent.click(screen.getByRole("button", { name: "修正をキャンセル" }));

    expect(
      screen.getByRole("button", { name: "できた（⭕️）" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(apiMocks.postGradeCorrection).not.toHaveBeenCalled();
  });

  it("通常採点を既存の拒否ダイアログから拒否へ修正する", async () => {
    renderPage(buildGrade());

    fireEvent.click(screen.getByRole("button", { name: "採点を修正" }));
    fireEvent.click(screen.getByRole("button", { name: "採点を拒否する" }));
    expect(screen.getByRole("dialog").textContent).toContain("採点拒否に修正");
    fireEvent.click(screen.getByRole("button", { name: "-100ptに修正" }));

    await waitFor(() => expect(apiMocks.postGradeCorrection).toHaveBeenCalledTimes(1));
    expect(apiMocks.postGradeCorrection).toHaveBeenCalledWith({
      correctionId: CORRECTION_ID,
      date: DATE,
      expectedRevision: 1,
      resultType: "grade_rejected",
    });
  });

  it("採点拒否から通常へ戻すときは全採点対象の入力を必須にする", async () => {
    renderPage(
      buildGrade({
        reasonCode: "grade_rejected",
        isRejected: true,
        totalPoints: -100,
        items: [
          {
            questId: "brush-teeth-gargle-am",
            childAnswer: 1,
            actualDone: null,
            gradingMode: "parent_choice",
            autoOutcome: null,
          },
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "採点を修正" }));
    const submit = screen.getByRole("button", { name: "採点を修正して確定" });
    expect(submit.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "できた（⭕️）" }));
    expect(submit.hasAttribute("disabled")).toBe(false);
    fireEvent.click(submit);
    fireEvent.click(screen.getByRole("button", { name: "修正を確定" }));

    await waitFor(() => expect(apiMocks.postGradeCorrection).toHaveBeenCalledTimes(1));
    expect(apiMocks.postGradeCorrection.mock.calls[0][0]).toMatchObject({
      resultType: "normal",
      grades: [{ questId: "brush-teeth-gargle-am", actualDone: true }],
    });
  });
});

describe("GradeDatePage 合計ポイント表示", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("通常採点済みなら合計を pt で表示する", () => {
    renderPage(buildGrade({ totalPoints: 45 }));

    expect(screen.getByTestId("grade-detail-total-points").textContent).toBe(
      "合計 +45pt",
    );
  });

  it("採点拒否なら合計 -100pt を表示する", () => {
    renderPage(
      buildGrade({
        reasonCode: "grade_rejected",
        isRejected: true,
        totalPoints: -100,
      }),
    );

    expect(screen.getByTestId("grade-detail-total-points").textContent).toBe(
      "合計 -100pt",
    );
  });

  it("未採点では合計を出さない", () => {
    renderPage(
      buildGrade({
        alreadyGraded: false,
        isGraded: false,
        reasonCode: null,
        totalPoints: null,
        canCorrect: false,
        cannotCorrectReason: "NOT_GRADED",
        gradingRevision: 0,
        originalGradedAt: "",
        items: [
          {
            questId: "brush-teeth-gargle-am",
            childAnswer: 1,
            actualDone: null,
            gradingMode: "parent_choice",
            autoOutcome: null,
          },
        ],
      }),
    );

    expect(screen.queryByTestId("grade-detail-total-points")).toBeNull();
  });

  it("GET grade に totalPoints が無くても gradeDates から表示する", () => {
    renderPage(buildGrade({ totalPoints: null }), {
      gradeDates: [
        {
          date: DATE,
          status: "graded",
          ungradedCount: 0,
          totalPoints: 30,
          reasonCode: "normal",
          isExempt: false,
        },
      ],
    });

    expect(screen.getByTestId("grade-detail-total-points").textContent).toBe(
      "合計 +30pt",
    );
  });
});
