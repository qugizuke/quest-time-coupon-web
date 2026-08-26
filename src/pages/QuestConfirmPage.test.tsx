/**
 * @file QuestConfirmPage 描画テスト
 * @description 起床 UI の表示条件を検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { setQuestDraft } from "@/lib/sessionStorage";
import { todayLocal } from "@/lib/date";
import { zeroRewardVouchers } from "@/lib/rewardVouchers";
import { QuestConfirmPage } from "@/pages/QuestConfirmPage";
import type { DailyQuests, HomeData, QuestDefinition, QuestDraft } from "@/types/api";
import dailyJson from "../../quests/daily.json";

const daily: DailyQuests = {
  date: todayLocal(),
  version: dailyJson.version,
  generationMode: "fixed_seed",
  quests: dailyJson.quests as QuestDefinition[],
};

/**
 * 確認画面用の完全な下書きを作る（to-be 10問・条件分岐なし）
 * @returns {QuestDraft} 下書き
 */
function buildCompleteDraft(): QuestDraft {
  return {
    index: daily.quests.length,
    answers: [
      { questId: "bedtime-prep", childAnswer: 1 },
      { questId: "sleep-on-time-yesterday", childAnswer: 1 },
      { questId: "wake-on-time", childAnswer: 1 },
      { questId: "brush-teeth-gargle-am", childAnswer: 1 },
      { questId: "wash-hands-gargle-after-school", childAnswer: 1 },
      { questId: "homework-done-today", childAnswer: 1 },
      { questId: "phone-non-emergency-unused", childAnswer: -1 },
      { questId: "save-water-hot-water", childAnswer: 1 },
      { questId: "no-repeated-warnings", childAnswer: 1 },
      { questId: "listen-to-mama-before-warning", childAnswer: 1 },
    ],
  };
}

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
    today: todayLocal(),
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
 * QuestConfirmPage を描画する
 * @param {HomeData} home - ホームデータ
 * @param {{ startDate: string; endDate: string; updatedAt?: string; active?: boolean } | null} [longVacation] - 長期休み期間
 * @returns {void}
 */
function renderConfirm(
  home: HomeData,
  longVacation: {
    startDate: string;
    endDate: string;
    updatedAt?: string;
    active?: boolean;
  } | null = null,
): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  queryClient.setQueryData(queryKeys.home, home);
  queryClient.setQueryData(queryKeys.dailyQuests(todayLocal()), daily);
  queryClient.setQueryData(
    queryKeys.longVacation,
    longVacation
      ? {
          startDate: longVacation.startDate,
          endDate: longVacation.endDate,
          updatedAt: longVacation.updatedAt ?? "2026-07-01T00:00:00+09:00",
          active: longVacation.active ?? true,
        }
      : { startDate: "", endDate: "", updatedAt: "", active: false },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/quest/confirm"]}>
        <Routes>
          <Route path="/quest/confirm" element={<QuestConfirmPage />} />
          <Route path="/" element={<div>home-page</div>} />
          <Route path="/quest" element={<div>quest-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("QuestConfirmPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 金曜 20:30 = 休日前夜・登録受付時間内（既定就寝21時 → 20:00〜21:00）
    vi.setSystemTime(new Date(2026, 6, 31, 20, 30, 0));
    sessionStorage.clear();
    setQuestDraft(todayLocal(), buildCompleteDraft());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("休日前夜は起床 UI を表示する", () => {
    renderConfirm(
      buildHome({
        isVacationMode: false,
      }),
    );

    expect(screen.getByTestId("wake-up-section")).toBeTruthy();
    expect(screen.getByText("明日の起きる時間")).toBeTruthy();
  });

  it("Figma寄せ: サブタイトル・CTA順・起床チップ選択を表示する", () => {
    renderConfirm(
      buildHome({
        isVacationMode: false,
      }),
    );

    expect(screen.getByText("回答のまとめ")).toBeTruthy();
    expect(screen.getByText("登録する前にかくにんしよう")).toBeTruthy();

    const fixBtn = screen.getByRole("button", { name: "修正する" });
    const submitBtn = screen.getByRole("button", { name: "登録する" });
    expect(
      fixBtn.compareDocumentPosition(submitBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const defaultChip = screen.getByRole("button", { name: "8:00" });
    expect(defaultChip.getAttribute("aria-pressed")).toBe("true");

    const otherChip = screen.getByRole("button", { name: "7:00" });
    fireEvent.click(otherChip);
    expect(otherChip.getAttribute("aria-pressed")).toBe("true");
    expect(defaultChip.getAttribute("aria-pressed")).toBe("false");
  });

  it("長期休みの中日は平日でも起床 UI を表示する", () => {
    vi.setSystemTime(new Date(2026, 7, 11, 20, 30, 0)); // 2026-08-11 火曜・受付時間内
    sessionStorage.clear();
    setQuestDraft(todayLocal(), buildCompleteDraft());

    renderConfirm(
      buildHome({
        isVacationMode: true,
        isLongVacation: true,
      }),
      { startDate: "2026-07-25", endDate: "2026-08-31" },
    );

    expect(screen.getByTestId("wake-up-section")).toBeTruthy();
  });

  it("長期休み最終日（翌日平日）は起床 UI を出さない", () => {
    // 2026-08-31 月曜・最終日、翌日 9/1 火曜平日
    vi.setSystemTime(new Date(2026, 7, 31, 20, 30, 0));
    sessionStorage.clear();
    setQuestDraft(todayLocal(), buildCompleteDraft());

    renderConfirm(
      buildHome({
        isVacationMode: true,
        isLongVacation: true,
      }),
      { startDate: "2026-07-25", endDate: "2026-08-31" },
    );

    expect(screen.getByText("回答のまとめ")).toBeTruthy();
    expect(screen.queryByTestId("wake-up-section")).toBeNull();
  });

  it("通常の平日は起床 UI を出さない", () => {
    vi.setSystemTime(new Date(2026, 6, 28, 20, 30, 0)); // 火曜・受付時間内
    sessionStorage.clear();
    setQuestDraft(todayLocal(), buildCompleteDraft());

    renderConfirm(
      buildHome({
        isVacationMode: false,
      }),
    );

    expect(screen.getByText("回答のまとめ")).toBeTruthy();
    expect(screen.queryByTestId("wake-up-section")).toBeNull();
  });

  it("宿題 skip（-1）は確認画面で専用スキップ文言を表示する", () => {
    const draft = buildCompleteDraft();
    const homeworkAnswer = draft.answers.find(
      (a) => a.questId === "homework-done-today",
    );
    if (homeworkAnswer) homeworkAnswer.childAnswer = -1;
    sessionStorage.clear();
    setQuestDraft(todayLocal(), draft);

    renderConfirm(buildHome({ isVacationMode: false }));

    expect(screen.getByText("今日は宿題がなかった")).toBeTruthy();
    expect(screen.queryByText("分からない")).toBeNull();
  });
});
