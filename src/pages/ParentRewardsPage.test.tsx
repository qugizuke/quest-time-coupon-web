/**
 * @file ParentRewardsPage 描画・操作テスト（Issue #38）
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { currentMonth } from "@/lib/month";
import { ParentRewardsPage } from "@/pages/ParentRewardsPage";
import type {
  PointExchangeRequest,
  PointExchangeRequestsData,
  RewardVoucherRefundRequest,
  RewardVoucherRefundRequestsData,
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
    effects: { spentPoints: 500, issuedRewardVouchers: {}, consumedPenaltyTickets: 0 },
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
): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(queryKeys.pointExchangeRequests(currentMonth()), data);
  queryClient.setQueryData(
    queryKeys.rewardVoucherRefundRequests(currentMonth()),
    refundData,
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
});
