/**
 * @file ParentRewardsPage 描画・操作テスト（Issue #38）
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { currentMonth, shiftMonth } from "@/lib/month";
import { ParentRewardsPage } from "@/pages/ParentRewardsPage";
import { buildParentHomeData } from "@/test/fixtures";
import type {
  PointExchangeRequest,
  PointExchangeRequestsData,
  ParentHomeData,
  RewardVoucherRefundRequest,
  RewardVoucherRefundRequestsData,
  RewardVoucherConsumptionsData,
} from "@/types/api";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return {
    ...actual,
    postPointExchangeDecision: vi.fn(
      async (payload: { id: string; decision: "approve" | "reject"; rejectReason?: string }) =>
        payload.decision === "approve"
          ? {
              id: payload.id,
              status: "approved" as const,
              spentPoints: 500,
              balancePoints: 500,
              penaltyTicketCount: 0,
            }
          : {
              id: payload.id,
              status: "rejected" as const,
              balancePoints: 1000,
            },
    ),
    postRewardVoucherRefundDecision: vi.fn(
      async (payload: { id: string; decision: "approve" | "reject"; rejectReason?: string }) =>
        payload.decision === "approve"
          ? {
              id: payload.id,
              status: "approved" as const,
              restoredPoints: 200,
              balancePoints: 200,
              rewardVouchers: {
                "snack-10": 0,
                "cash-100": 1,
                "dining-1000": 0,
                "switch-30": 0,
                "switch-60": 0,
              },
            }
          : {
              id: payload.id,
              status: "rejected" as const,
              balancePoints: 0,
            },
    ),
  };
});

/** テスト用 戻し pending 申請 */
function buildPendingRefundRequest(
  overrides: Partial<RewardVoucherRefundRequest> = {},
): RewardVoucherRefundRequest {
  return {
    id: "rvr_pending_1",
    status: "pending",
    requestedAt: "2026-08-25T10:00:00+09:00",
    decidedAt: "",
    items: [
      { catalogItemId: "cash-100", label: "100円", quantity: 2, pointValue: 100, subtotalPoints: 200 },
    ],
    totalPoints: 200,
    rejectReason: "",
    ...overrides,
  };
}

/** テスト用 pending 申請 */
function buildPendingRequest(overrides: Partial<PointExchangeRequest> = {}): PointExchangeRequest {
  return {
    id: "pex_pending_1",
    status: "pending",
    requestedAt: "2026-08-25T10:00:00+09:00",
    decidedAt: "",
    items: [
      { catalogItemId: "cash-100", label: "100円", quantity: 5, pointCost: 100, subtotalPoints: 500 },
    ],
    totalPoints: 500,
    effects: {
      spentPoints: 500,
      issuedRewardVouchers: { "cash-100": 5 },
      consumedPenaltyTickets: 0,
    },
    rejectReason: "",
    ...overrides,
  };
}

/**
 * ParentRewardsPage を描画する
 * @param {PointExchangeRequestsData} data - 月次データ
 * @param {RewardVoucherRefundRequestsData} [refundData] - 戻し申請月次データ
 * @returns {void}
 */
function renderParentRewards(
  data: PointExchangeRequestsData,
  refundData: RewardVoucherRefundRequestsData = { month: currentMonth(), items: [] },
  parentHomeOverrides: Partial<ParentHomeData> = {},
  consumptionData: RewardVoucherConsumptionsData = {
    month: currentMonth(),
    items: [],
  },
): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(queryKeys.pointExchangeRequests(currentMonth()), data);
  queryClient.setQueryData(
    queryKeys.rewardVoucherRefundRequests(currentMonth()),
    refundData,
  );
  queryClient.setQueryData(
    queryKeys.rewardVoucherConsumptions(currentMonth()),
    consumptionData,
  );
  queryClient.setQueryData(
    queryKeys.parentHome,
    buildParentHomeData({
      balancePoints: 1000,
      rewardVouchers: {
        "snack-10": 0,
        "cash-100": 3,
        "dining-1000": 0,
        "switch-30": 0,
        "switch-60": 0,
      },
      ...parentHomeOverrides,
    }),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/parent/rewards"]}>
        <Routes>
          <Route path="/parent/rewards" element={<ParentRewardsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("ParentRewardsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("承認待ちが無ければ0件と表示する", () => {
    renderParentRewards({ month: currentMonth(), items: [] });
    expect(screen.getByText("承認待ちの申請はありません")).toBeTruthy();
  });

  it("pending 申請を承認待ちセクションに表示する", () => {
    const request = buildPendingRequest();
    renderParentRewards({ month: currentMonth(), items: [request] });
    const card = screen.getByTestId(`parent-rewards-item-${request.id}`);
    expect(card.textContent).toContain("承認待ち");
    expect(card.textContent).toContain("100円 × 5（500pt）");
    expect(card.textContent).toContain("合計 500pt");
    expect(card.textContent).toContain("承認後残高: 500pt");
    expect(card.textContent).toContain("承認後 100円: 8枚");
  });

  it("承認すると API を呼ぶ", async () => {
    const { postPointExchangeDecision } = await import("@/api/client");
    const request = buildPendingRequest();
    renderParentRewards({ month: currentMonth(), items: [request] });

    fireEvent.click(screen.getByTestId(`parent-rewards-approve-open-${request.id}`));
    fireEvent.click(screen.getByTestId(`parent-rewards-approve-submit-${request.id}`));

    await waitFor(() => {
      expect(postPointExchangeDecision).toHaveBeenCalledWith({
        id: request.id,
        decision: "approve",
      });
    });
  });

  it("ペナルティチケット不足時は見込みを警告して承認を止める", () => {
    const request = buildPendingRequest({
      items: [
        {
          catalogItemId: "penalty-ticket-100",
          label: "ペナルティチケットを1枚消す",
          quantity: 2,
          pointCost: 100,
          subtotalPoints: 200,
        },
      ],
      totalPoints: 200,
      effects: {
        spentPoints: 200,
        issuedRewardVouchers: {},
        consumedPenaltyTickets: 2,
      },
    });
    renderParentRewards(
      { month: currentMonth(), items: [request] },
      undefined,
      { penaltyTicketCount: 1 },
    );

    const card = screen.getByTestId(`parent-rewards-item-${request.id}`);
    expect(card.textContent).toContain("承認後 ペナルティチケット: -1枚");
    expect(card.textContent).toContain("1枚不足しているため承認できません");
    expect(
      screen.getByTestId(`parent-rewards-approve-open-${request.id}`).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("交換の確認パネル表示後に在庫不足へ変わった場合も確定を止める", async () => {
    const request = buildPendingRequest({
      effects: {
        spentPoints: 200,
        issuedRewardVouchers: {},
        consumedPenaltyTickets: 2,
      },
    });
    const queryClient = renderParentRewards(
      { month: currentMonth(), items: [request] },
      undefined,
      { penaltyTicketCount: 2 },
    );
    fireEvent.click(screen.getByTestId(`parent-rewards-approve-open-${request.id}`));

    act(() => {
      queryClient.setQueryData(
        queryKeys.parentHome,
        buildParentHomeData({ penaltyTicketCount: 1 }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByTestId(`parent-rewards-approve-submit-${request.id}`).hasAttribute("disabled"),
      ).toBe(true);
    });
  });

  it("却下すると理由付きで API を呼ぶ", async () => {
    const { postPointExchangeDecision } = await import("@/api/client");
    const request = buildPendingRequest();
    renderParentRewards({ month: currentMonth(), items: [request] });

    fireEvent.click(screen.getByTestId(`parent-rewards-reject-open-${request.id}`));
    fireEvent.change(screen.getByTestId(`parent-rewards-reject-reason-${request.id}`), {
      target: { value: "今日はやめておこう" },
    });
    fireEvent.click(screen.getByTestId(`parent-rewards-reject-submit-${request.id}`));

    await waitFor(() => {
      expect(postPointExchangeDecision).toHaveBeenCalledWith({
        id: request.id,
        decision: "reject",
        rejectReason: "今日はやめておこう",
      });
    });
  });

  it("承認済み・却下済みは月次履歴に表示し、承認待ちには出さない", () => {
    const approved = buildPendingRequest({
      id: "pex_approved_1",
      status: "approved",
      decidedAt: "2026-08-26T10:00:00+09:00",
    });
    renderParentRewards({ month: currentMonth(), items: [approved] });
    expect(screen.getByText("承認待ちの申請はありません")).toBeTruthy();
    expect(screen.getByTestId(`parent-rewards-item-${approved.id}`)).toBeTruthy();
  });

  it("戻し pending 申請を承認待ちセクションに表示し、承認すると API を呼ぶ", async () => {
    const { postRewardVoucherRefundDecision } = await import("@/api/client");
    const request = buildPendingRefundRequest();
    renderParentRewards(
      { month: currentMonth(), items: [] },
      { month: currentMonth(), items: [request] },
    );

    const card = screen.getByTestId(`parent-refund-item-${request.id}`);
    expect(card.textContent).toContain("承認待ち");
    expect(card.textContent).toContain("100円 × 2（200pt）");
    expect(card.textContent).toContain("戻る合計 200pt");
    expect(card.textContent).toContain("承認後残高: 1200pt");
    expect(card.textContent).toContain("承認後 100円: 1枚");

    fireEvent.click(screen.getByTestId(`parent-refund-approve-open-${request.id}`));
    fireEvent.click(screen.getByTestId(`parent-refund-approve-submit-${request.id}`));

    await waitFor(() => {
      expect(postRewardVoucherRefundDecision).toHaveBeenCalledWith({
        id: request.id,
        decision: "approve",
      });
    });
  });

  it("戻し申請を却下すると理由付きで API を呼ぶ", async () => {
    const { postRewardVoucherRefundDecision } = await import("@/api/client");
    const request = buildPendingRefundRequest();
    renderParentRewards(
      { month: currentMonth(), items: [] },
      { month: currentMonth(), items: [request] },
    );

    fireEvent.click(screen.getByTestId(`parent-refund-reject-open-${request.id}`));
    fireEvent.change(screen.getByTestId(`parent-refund-reject-reason-${request.id}`), {
      target: { value: "また今度" },
    });
    fireEvent.click(screen.getByTestId(`parent-refund-reject-submit-${request.id}`));

    await waitFor(() => {
      expect(postRewardVoucherRefundDecision).toHaveBeenCalledWith({
        id: request.id,
        decision: "reject",
        rejectReason: "また今度",
      });
    });
  });

  it("戻し承認時の券不足を丸めず警告し、承認を止める", () => {
    const request = buildPendingRefundRequest();
    renderParentRewards(
      { month: currentMonth(), items: [] },
      { month: currentMonth(), items: [request] },
      {
        rewardVouchers: {
          "snack-10": 0,
          "cash-100": 1,
          "dining-1000": 0,
          "switch-30": 0,
          "switch-60": 0,
        },
      },
    );

    const card = screen.getByTestId(`parent-refund-item-${request.id}`);
    expect(card.textContent).toContain("承認後 100円: -1枚");
    expect(card.textContent).toContain("100円が1枚不足しているため承認できません");
    expect(
      screen.getByTestId(`parent-refund-approve-open-${request.id}`).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("戻しの確認パネル表示後に券不足へ変わった場合も確定を止める", async () => {
    const request = buildPendingRefundRequest();
    const queryClient = renderParentRewards(
      { month: currentMonth(), items: [] },
      { month: currentMonth(), items: [request] },
    );
    fireEvent.click(screen.getByTestId(`parent-refund-approve-open-${request.id}`));

    act(() => {
      queryClient.setQueryData(
        queryKeys.parentHome,
        buildParentHomeData({
          rewardVouchers: {
            "snack-10": 0,
            "cash-100": 1,
            "dining-1000": 0,
            "switch-30": 0,
            "switch-60": 0,
          },
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByTestId(`parent-refund-approve-submit-${request.id}`).hasAttribute("disabled"),
      ).toBe(true);
    });
  });

  it("物理券使用履歴を保存済み在庫スナップショットで新しい順に表示する", () => {
    renderParentRewards(
      { month: currentMonth(), items: [] },
      undefined,
      {},
      {
        month: currentMonth(),
        items: [
          {
            operationId: "older-operation",
            consumedAt: "2026-08-20T01:00:00.000Z",
            items: [
              {
                catalogItemId: "snack-10",
                label: "おやつ",
                quantity: 1,
                stockBefore: 4,
                stockAfter: 3,
              },
            ],
          },
          {
            operationId: "newer-operation",
            consumedAt: "2026-08-25T01:00:00.000Z",
            items: [
              {
                catalogItemId: "cash-100",
                label: "100円",
                quantity: 2,
                stockBefore: 5,
                stockAfter: 3,
              },
            ],
          },
        ],
      },
    );

    const history = screen.getByTestId("parent-consumption-history-card");
    expect(history.textContent).toContain("100円 × 2");
    expect(history.textContent).toContain("5枚 → 3枚");
    const entries = history.querySelectorAll('[data-testid^="parent-consumption-item-"]');
    expect(entries[0]?.getAttribute("data-testid")).toBe(
      "parent-consumption-item-newer-operation",
    );
    expect(entries[1]?.getAttribute("data-testid")).toBe(
      "parent-consumption-item-older-operation",
    );
  });

  it("状態フィルタは交換・戻しだけに適用し、使用履歴と承認待ち件数を変えない", () => {
    const pending = buildPendingRequest();
    const approved = buildPendingRequest({
      id: "pex_approved_filter",
      status: "approved",
      decidedAt: "2026-08-25T11:00:00+09:00",
    });
    renderParentRewards(
      { month: currentMonth(), items: [pending, approved] },
      undefined,
      {},
      {
        month: currentMonth(),
        items: [
          {
            operationId: "consumption-filter-independent",
            consumedAt: "2026-08-25T01:00:00.000Z",
            items: [
              {
                catalogItemId: "dining-1000",
                label: "外食",
                quantity: 1,
                stockBefore: 2,
                stockAfter: 1,
              },
            ],
          },
        ],
      },
    );

    fireEvent.change(screen.getByTestId("parent-rewards-status-filter"), {
      target: { value: "approved" },
    });

    expect(screen.queryByTestId(`parent-rewards-item-${pending.id}`)).toBeNull();
    expect(screen.getByTestId(`parent-rewards-item-${approved.id}`)).toBeTruthy();
    expect(screen.getByText("承認待ち 1件")).toBeTruthy();
    expect(
      screen.getByTestId(
        "parent-consumption-item-consumption-filter-independent",
      ),
    ).toBeTruthy();
  });

  it("月選択を変えると物理券使用履歴も同じ月へ切り替える", async () => {
    const queryClient = renderParentRewards({ month: currentMonth(), items: [] });
    const previousMonth = shiftMonth(currentMonth(), -1);
    queryClient.setQueryData(queryKeys.pointExchangeRequests(previousMonth), {
      month: previousMonth,
      items: [],
    });
    queryClient.setQueryData(queryKeys.rewardVoucherRefundRequests(previousMonth), {
      month: previousMonth,
      items: [],
    });
    queryClient.setQueryData(queryKeys.rewardVoucherConsumptions(previousMonth), {
      month: previousMonth,
      items: [
        {
          operationId: "previous-month-consumption",
          consumedAt: "2026-07-25T01:00:00.000Z",
          items: [
            {
              catalogItemId: "cash-100",
              label: "前月の100円",
              quantity: 1,
              stockBefore: 2,
              stockAfter: 1,
            },
          ],
        },
      ],
    });

    fireEvent.click(screen.getByTestId("parent-rewards-prev-month"));

    await waitFor(() => {
      expect(
        screen.getByTestId("parent-consumption-item-previous-month-consumption"),
      ).toBeTruthy();
    });
  });
});
