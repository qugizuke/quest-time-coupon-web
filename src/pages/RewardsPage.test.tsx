/**
 * @file RewardsPage 描画・操作テスト（Issue #38）
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { buildHomeData } from "@/test/fixtures";
import { currentMonth } from "@/lib/month";
import { zeroRewardVouchers } from "@/lib/rewardVouchers";
import { RewardsPage } from "@/pages/RewardsPage";
import type {
  PointExchangeRequestsData,
  RewardVoucherRefundRequestsData,
  RewardVouchers,
} from "@/types/api";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return {
    ...actual,
    postPointExchangeRequest: vi.fn(async (payload: { items: { catalogItemId: string; quantity: number }[] }) => ({
      id: "pex_test_1",
      status: "pending" as const,
      totalPoints: payload.items.reduce((sum) => sum + 1, 0) > 0 ? 500 : 0,
      balancePoints: 1000,
    })),
    postRewardVoucherRefundRequest: vi.fn(async () => ({
      id: "rvr_test_1",
      status: "pending" as const,
      totalPoints: 100,
    })),
    postPointDebtOffset: vi.fn(async () => ({
      offsetPoints: 100,
      balancePoints: -20,
      remainingDebtPoints: 20,
      rewardVouchers: {
        "snack-10": 0,
        "cash-100": 0,
        "dining-1000": 0,
        "switch-30": 0,
        "switch-60": 0,
      },
    })),
  };
});

/** 空の月次履歴 */
function emptyHistory(): PointExchangeRequestsData {
  return { month: currentMonth(), items: [] };
}

/** 空の戻し申請月次履歴 */
function emptyRefundHistory(): RewardVoucherRefundRequestsData {
  return { month: currentMonth(), items: [] };
}

/**
 * RewardsPage を描画する
 * @param {object} opts - 初期データ
 * @returns {void}
 */
function renderRewards(opts: {
  balancePoints?: number;
  switchMinutes?: number;
  history?: PointExchangeRequestsData;
  refundHistory?: RewardVoucherRefundRequestsData;
  rewardVouchers?: Partial<RewardVouchers>;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(
    queryKeys.home,
    buildHomeData({
      balancePoints: opts.balancePoints ?? 1000,
      switchMinutes: opts.switchMinutes ?? 10,
      rewardVouchers: { ...zeroRewardVouchers(), ...opts.rewardVouchers },
    }),
  );
  queryClient.setQueryData(
    queryKeys.pointExchangeRequests(currentMonth()),
    opts.history ?? emptyHistory(),
  );
  queryClient.setQueryData(
    queryKeys.rewardVoucherRefundRequests(currentMonth()),
    opts.refundHistory ?? emptyRefundHistory(),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/rewards"]}>
        <Routes>
          <Route path="/rewards" element={<RewardsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RewardsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("残高と交換カタログを表示し、未選択では申請できない", () => {
    renderRewards({ balancePoints: 1000 });
    expect(screen.getByTestId("rewards-balance-points").textContent).toBe("1000pt");
    expect(screen.getByTestId("catalog-item-cash-100")).toBeTruthy();
    expect(screen.getByTestId("rewards-submit").hasAttribute("disabled")).toBe(true);
  });

  it("数量を選ぶと合計が変わり、申請できるようになる", () => {
    renderRewards({ balancePoints: 1000 });
    const increment = screen.getByLabelText("100円を1個増やす");
    fireEvent.click(increment);
    fireEvent.click(increment);
    expect(screen.getByTestId("catalog-quantity-cash-100").textContent).toBe("2");
    expect(screen.getByTestId("rewards-total-points").textContent).toBe("200pt");
    expect(screen.getByTestId("rewards-submit").hasAttribute("disabled")).toBe(false);
  });

  it("残高を超える申請は disabled のまま警告を出す", () => {
    renderRewards({ balancePoints: 50 });
    const increment = screen.getByLabelText("100円を1個増やす");
    fireEvent.click(increment);
    expect(screen.getByTestId("rewards-insufficient-balance")).toBeTruthy();
    expect(screen.getByTestId("rewards-submit").hasAttribute("disabled")).toBe(true);
  });

  it("交換を申請すると API を呼び、数量をリセットする", async () => {
    const { postPointExchangeRequest } = await import("@/api/client");
    renderRewards({ balancePoints: 1000 });
    fireEvent.click(screen.getByLabelText("おやつを1個増やす"));
    fireEvent.click(screen.getByTestId("rewards-submit"));

    await waitFor(() => {
      expect(postPointExchangeRequest).toHaveBeenCalledWith({
        items: [{ catalogItemId: "snack-10", quantity: 1 }],
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("catalog-quantity-snack-10").textContent).toBe("0");
    });
  });

  it("月次履歴に pending / approved / rejected を表示する", () => {
    renderRewards({
      balancePoints: 1000,
      history: {
        month: currentMonth(),
        items: [
          {
            id: "pex_1",
            status: "pending",
            requestedAt: "2026-08-25T10:00:00+09:00",
            decidedAt: "",
            items: [
              { catalogItemId: "cash-100", label: "100円", quantity: 5, pointCost: 100, subtotalPoints: 500 },
            ],
            totalPoints: 500,
            effects: { spentPoints: 500, issuedRewardVouchers: {}, consumedPenaltyTickets: 0 },
            rejectReason: "",
          },
          {
            id: "pex_2",
            status: "approved",
            requestedAt: "2026-08-20T10:00:00+09:00",
            decidedAt: "2026-08-21T10:00:00+09:00",
            items: [
              { catalogItemId: "switch-30", label: "Switch 30分", quantity: 1, pointCost: 50, subtotalPoints: 50 },
            ],
            totalPoints: 50,
            effects: {
              spentPoints: 50,
              issuedRewardVouchers: { "switch-30": 1 },
              consumedPenaltyTickets: 0,
            },
            rejectReason: "",
          },
        ],
      },
    });
    expect(screen.getByTestId("rewards-history-item-pex_1").textContent).toContain(
      "承認待ち",
    );
    expect(screen.getByTestId("rewards-history-item-pex_2").textContent).toContain(
      "承認済み",
    );
    expect(screen.getByTestId("rewards-history-item-pex_2").textContent).toContain(
      "Switch 30分券+1",
    );
  });

  it("保有券を表示し、戻し申請ができる", async () => {
    const { postRewardVoucherRefundRequest } = await import("@/api/client");
    renderRewards({ balancePoints: 1000, rewardVouchers: { "cash-100": 2 } });

    expect(screen.getByTestId("rewards-voucher-stock-cash-100").textContent).toContain(
      "2枚",
    );

    fireEvent.click(screen.getByLabelText("戻す100円を1個増やす"));
    expect(screen.getByTestId("refund-total-points").textContent).toBe("100pt");
    fireEvent.click(screen.getByTestId("refund-submit"));

    await waitFor(() => {
      expect(postRewardVoucherRefundRequest).toHaveBeenCalledWith({
        items: [{ catalogItemId: "cash-100", quantity: 1 }],
      });
    });
  });

  it("戻し申請の数量は保有枚数を超えて選べない", () => {
    renderRewards({ balancePoints: 1000, rewardVouchers: { "cash-100": 1 } });
    const increment = screen.getByLabelText("戻す100円を1個増やす");
    fireEvent.click(increment);
    fireEvent.click(increment);
    expect(screen.getByTestId("refund-voucher-quantity-cash-100").textContent).toBe("1");
  });

  it("balancePoints が負のときだけ負債穴埋めカードを表示し、穴埋めできる", async () => {
    const { postPointDebtOffset } = await import("@/api/client");
    renderRewards({ balancePoints: -100, rewardVouchers: { "cash-100": 1 } });

    expect(screen.getByTestId("rewards-debt-offset-card")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("穴埋めに使う100円を1個増やす"));
    fireEvent.click(screen.getByTestId("offset-submit"));

    await waitFor(() => {
      expect(postPointDebtOffset).toHaveBeenCalledWith({
        items: [{ catalogItemId: "cash-100", quantity: 1 }],
      });
    });
  });

  it("balancePoints が0以上なら負債穴埋めカードを表示しない", () => {
    renderRewards({ balancePoints: 0 });
    expect(screen.queryByTestId("rewards-debt-offset-card")).toBeNull();
  });
});
