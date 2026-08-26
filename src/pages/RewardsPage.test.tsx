/**
 * @file RewardsPage 描画・操作テスト（Issue #38）
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { buildHomeData } from "@/test/fixtures";
import { currentMonth } from "@/lib/month";
import { REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY } from "@/lib/rewardVoucherConsumptionOperation";
import { zeroRewardVouchers } from "@/lib/rewardVouchers";
import { RewardsPage } from "@/pages/RewardsPage";
import type {
  PointExchangeRequestsData,
  RewardVoucherConsumptionsData,
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
    postRewardVoucherConsumption: vi.fn(async (payload: {
      operationId: string;
      items: Array<{ catalogItemId: "snack-10" | "cash-100" | "dining-1000"; quantity: number }>;
    }) => ({
      operationId: payload.operationId,
      consumedAt: "2026-08-26T01:00:00.000Z",
      items: payload.items.map((item) => ({
        ...item,
        label: item.catalogItemId === "cash-100" ? "100円" : item.catalogItemId === "snack-10" ? "おやつ" : "外食",
        stockBefore: 2,
        stockAfter: 2 - item.quantity,
      })),
      idempotentReplay: false,
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

function emptyConsumptionHistory(): RewardVoucherConsumptionsData {
  return { month: currentMonth(), items: [] };
}

/**
 * RewardsPage を描画する
 * @param {object} opts - 初期データ
 * @returns {ReturnType<typeof render>} Testing Library の描画結果
 */
function renderRewards(opts: {
  balancePoints?: number;
  switchMinutes?: number;
  history?: PointExchangeRequestsData;
  refundHistory?: RewardVoucherRefundRequestsData;
  consumptionHistory?: RewardVoucherConsumptionsData;
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
  queryClient.setQueryData(
    queryKeys.rewardVoucherConsumptions(currentMonth()),
    opts.consumptionHistory ?? emptyConsumptionHistory(),
  );
  return render(
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
    localStorage.clear();
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

  it("残高を超えても契約どおり申請でき、承認後負残高の注意を出す", () => {
    renderRewards({ balancePoints: 50 });
    const increment = screen.getByLabelText("100円を1個増やす");
    fireEvent.click(increment);
    expect(screen.getByTestId("rewards-insufficient-balance")).toBeTruthy();
    expect(screen.getByTestId("rewards-submit").hasAttribute("disabled")).toBe(false);
    expect(screen.getByTestId("rewards-insufficient-balance").textContent).toContain(
      "承認されると残高がマイナス",
    );
  });

  it("負残高でも未選択なら不足警告を表示しない", () => {
    renderRewards({ balancePoints: -100 });
    expect(screen.queryByTestId("rewards-insufficient-balance")).toBeNull();
  });

  it("タブを矢印/Home/Endキーで移動し、tabpanelと関連付ける", () => {
    renderRewards({ balancePoints: 1000 });
    const exchange = screen.getByRole("tab", { name: /交換する/ });
    exchange.focus();
    fireEvent.keyDown(exchange, { key: "ArrowRight" });

    const use = screen.getByRole("tab", { name: /使う/ });
    expect(document.activeElement).toBe(use);
    expect(use.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
      use.id,
    );

    fireEvent.keyDown(use, { key: "End" });
    const history = screen.getByRole("tab", { name: /履歴/ });
    expect(document.activeElement).toBe(history);
    expect(history.tabIndex).toBe(0);

    fireEvent.keyDown(history, { key: "Home" });
    expect(document.activeElement).toBe(exchange);
    expect(exchange.tabIndex).toBe(0);
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
    fireEvent.click(screen.getByTestId("rewards-tab-history"));
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

    fireEvent.click(screen.getByTestId("rewards-tab-refund"));
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
    fireEvent.click(screen.getByTestId("rewards-tab-refund"));
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

  it("4タブを表示し、使うタブは在庫0と未選択で使用確認を無効にする", () => {
    renderRewards({ rewardVouchers: {} });
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    fireEvent.click(screen.getByTestId("rewards-tab-use"));
    expect(screen.getByTestId("use-vouchers-empty")).toBeTruthy();
    expect(screen.getByTestId("use-confirm-open").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("使う100円を1個増やす").hasAttribute("disabled")).toBe(true);
  });

  it("物理券を複数種類・保有数まで選択し、確認から選び直せる", () => {
    renderRewards({ rewardVouchers: { "snack-10": 1, "cash-100": 2 } });
    fireEvent.click(screen.getByTestId("rewards-tab-use"));
    fireEvent.click(screen.getByLabelText("使うおやつを1個増やす"));
    const cashPlus = screen.getByLabelText("使う100円を1個増やす");
    fireEvent.click(cashPlus);
    fireEvent.click(cashPlus);
    fireEvent.click(cashPlus);
    expect(screen.getByTestId("use-voucher-quantity-cash-100").textContent).toBe("2");
    expect(cashPlus.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByTestId("use-confirm-open"));
    expect(screen.getByTestId("use-confirm-items").textContent).toContain("おやつ × 1");
    expect(screen.getByTestId("use-confirm-items").textContent).toContain("100円 × 2");
    fireEvent.click(screen.getByTestId("use-confirm-back"));
    expect(screen.getByTestId("use-voucher-quantity-cash-100").textContent).toBe("2");
  });

  it("確認後に保護者承認なしで使用し、完了レシートを表示して未確定recordを消す", async () => {
    const { postRewardVoucherConsumption } = await import("@/api/client");
    renderRewards({ rewardVouchers: { "cash-100": 2 } });
    fireEvent.click(screen.getByTestId("rewards-tab-use"));
    fireEvent.click(screen.getByLabelText("使う100円を1個増やす"));
    fireEvent.click(screen.getByTestId("use-confirm-open"));
    fireEvent.click(screen.getByTestId("use-submit"));

    expect(screen.getByTestId("use-processing")).toBeTruthy();
    expect(screen.getByRole("button", { name: "使用中…" }).hasAttribute("disabled")).toBe(true);
    await waitFor(() => expect(screen.getByTestId("use-complete")).toBeTruthy());
    const payload = vi.mocked(postRewardVoucherConsumption).mock.calls[0][0];
    expect(payload.operationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.items).toEqual([{ catalogItemId: "cash-100", quantity: 1 }]);
    expect(screen.getByTestId("use-complete").textContent).toContain("2枚 → 1枚");
    expect(localStorage.getItem(REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY)).toBeNull();
  });

  it("在庫競合は確定状態としてrecordを消し、最新在庫からの選び直しを促す", async () => {
    const { postRewardVoucherConsumption } = await import("@/api/client");
    vi.mocked(postRewardVoucherConsumption).mockRejectedValueOnce(
      new Error("FORBIDDEN_STATE: 在庫不足"),
    );
    renderRewards({ rewardVouchers: { "cash-100": 1 } });
    fireEvent.click(screen.getByTestId("rewards-tab-use"));
    fireEvent.click(screen.getByLabelText("使う100円を1個増やす"));
    fireEvent.click(screen.getByTestId("use-confirm-open"));
    fireEvent.click(screen.getByTestId("use-submit"));
    await waitFor(() => expect(screen.getByTestId("use-stock-conflict")).toBeTruthy());
    expect(localStorage.getItem(REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY)).toBeNull();
  });

  it("通信結果不明を保存し、再訪後も同じ operationId / payload だけを再送する", async () => {
    const { postRewardVoucherConsumption } = await import("@/api/client");
    const operation = {
      operationId: "550e8400-e29b-41d4-a716-446655440000",
      items: [{ catalogItemId: "cash-100" as const, quantity: 1 }],
    };
    localStorage.setItem(
      REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY,
      JSON.stringify(operation),
    );
    renderRewards({ rewardVouchers: { "cash-100": 1 } });
    expect(screen.getByTestId("rewards-tab-use").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("use-unknown-result").textContent).toContain("100円 × 1");

    fireEvent.click(screen.getByTestId("use-retry"));
    await waitFor(() => expect(screen.getByTestId("use-complete")).toBeTruthy());
    expect(postRewardVoucherConsumption).toHaveBeenCalledWith(operation);
    expect(localStorage.getItem(REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY)).toBeNull();
  });

  it("初回POSTの通信結果不明ではrecordを残し、再確認で新しいIDを発行しない", async () => {
    const { postRewardVoucherConsumption } = await import("@/api/client");
    vi.mocked(postRewardVoucherConsumption)
      .mockRejectedValueOnce(new Error("Failed to fetch"));
    renderRewards({ rewardVouchers: { "cash-100": 1 } });
    fireEvent.click(screen.getByTestId("rewards-tab-use"));
    fireEvent.click(screen.getByLabelText("使う100円を1個増やす"));
    fireEvent.click(screen.getByTestId("use-confirm-open"));
    fireEvent.click(screen.getByTestId("use-submit"));
    await waitFor(() => expect(screen.getByTestId("use-unknown-result")).toBeTruthy());
    const firstPayload = vi.mocked(postRewardVoucherConsumption).mock.calls[0][0];
    expect(JSON.parse(localStorage.getItem(REWARD_VOUCHER_CONSUMPTION_OPERATION_KEY) ?? "null"))
      .toEqual(firstPayload);

    fireEvent.click(screen.getByTestId("use-retry"));
    await waitFor(() => expect(screen.getByTestId("use-complete")).toBeTruthy());
    expect(postRewardVoucherConsumption).toHaveBeenNthCalledWith(2, firstPayload);
  });

  it("処理中は主CTAを無効化し二重送信しない", async () => {
    const { postRewardVoucherConsumption } = await import("@/api/client");
    let resolveRequest!: (value: {
      operationId: string;
      consumedAt: string;
      items: Array<{ catalogItemId: "cash-100"; label: string; quantity: number; stockBefore: number; stockAfter: number }>;
      idempotentReplay: boolean;
    }) => void;
    vi.mocked(postRewardVoucherConsumption).mockImplementationOnce(
      (payload) => new Promise((resolve) => {
        resolveRequest = resolve;
        void payload;
      }),
    );
    renderRewards({ rewardVouchers: { "cash-100": 1 } });
    fireEvent.click(screen.getByTestId("rewards-tab-use"));
    fireEvent.click(screen.getByLabelText("使う100円を1個増やす"));
    fireEvent.click(screen.getByTestId("use-confirm-open"));
    fireEvent.click(screen.getByTestId("use-submit"));
    const processingButton = screen.getByRole("button", { name: "使用中…" });
    await waitFor(() => expect(postRewardVoucherConsumption).toHaveBeenCalledTimes(1));
    fireEvent.click(processingButton);
    expect(processingButton.hasAttribute("disabled")).toBe(true);

    const payload = vi.mocked(postRewardVoucherConsumption).mock.calls[0][0];
    resolveRequest({
      operationId: payload.operationId,
      consumedAt: "2026-08-26T01:00:00.000Z",
      items: [{ catalogItemId: "cash-100", label: "100円", quantity: 1, stockBefore: 1, stockAfter: 0 }],
      idempotentReplay: false,
    });
    await waitFor(() => expect(screen.getByTestId("use-complete")).toBeTruthy());
  });

  it("履歴タブに交換・戻しとは独立した使用履歴を保存済み前後在庫で表示する", () => {
    renderRewards({
      consumptionHistory: {
        month: currentMonth(),
        items: [{
          operationId: "550e8400-e29b-41d4-a716-446655440000",
          consumedAt: "2026-08-26T01:00:00.000Z",
          items: [{
            catalogItemId: "cash-100",
            label: "100円",
            quantity: 2,
            stockBefore: 5,
            stockAfter: 3,
          }],
        }],
      },
    });
    fireEvent.click(screen.getByTestId("rewards-tab-history"));
    const item = screen.getByTestId(
      "rewards-consumption-history-item-550e8400-e29b-41d4-a716-446655440000",
    );
    expect(item.textContent).toContain("100円 × 2");
    expect(item.textContent).toContain("5枚 → 3枚");
  });
  it("使うタブの絵文字は Figma どおり 🎫 を使う", () => {
    renderRewards({ balancePoints: 1000 });
    expect(screen.getByRole("tab", { name: "🎫 使う" })).toBeTruthy();
  });

  it("フッタに合計ポイントと交換後の残りを並記する", () => {
    renderRewards({ balancePoints: 1000 });
    expect(screen.getByTestId("rewards-total-points").textContent).toBe("0pt");
    expect(screen.getByTestId("rewards-remaining-points").textContent).toBe("1000pt");
    fireEvent.click(screen.getByLabelText("100円を1個増やす"));
    expect(screen.getByTestId("rewards-total-points").textContent).toBe("100pt");
    expect(screen.getByTestId("rewards-remaining-points").textContent).toBe("900pt");
  });

  it("交換後の残りがマイナスになる見込みは赤字で示す", () => {
    renderRewards({ balancePoints: 50 });
    fireEvent.click(screen.getByLabelText("100円を1個増やす"));
    const remaining = screen.getByTestId("rewards-remaining-points");
    expect(remaining.textContent).toBe("-50pt");
    expect(remaining.className).toContain("text-danger");
  });

  it("ポイント不足カタログは赤点線とあとNptバッジを表示する", () => {
    renderRewards({ balancePoints: 30 });
    const card = screen.getByTestId("catalog-item-dining-1000");
    expect(card.className).toContain("border-dashed");
    expect(card.className).toContain("border-danger");
    expect(
      within(card).getByTestId("catalog-shortfall-dining-1000").textContent,
    ).toBe("あと970pt");
  });

  it("履歴タブの月ナビはパネル先頭に全履歴の共通として置く", () => {
    renderRewards({ balancePoints: 1000 });
    fireEvent.click(screen.getByTestId("rewards-tab-history"));
    const panel = screen.getByTestId("rewards-history-card").parentElement;
    expect(panel?.firstElementChild?.getAttribute("data-testid")).toBe("rewards-month-nav");
    expect(screen.getByTestId("rewards-month-label").textContent).toBeTruthy();
  });
});
