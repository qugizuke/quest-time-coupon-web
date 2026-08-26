/**
 * @file ParentHomePage ペナルティチケット発行 UI テスト
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { currentMonth } from "@/lib/month";
import { ParentHomePage } from "@/pages/ParentHomePage";
import { buildParentHomeData } from "@/test/fixtures";
import type {
  ParentHomeData,
  PointExchangeRequestsData,
  RewardVoucherRefundRequestsData,
} from "@/types/api";

/**
 * 保護者ホームを描画する
 * @param {ParentHomeData} data - parentHome
 * @param {PointExchangeRequestsData} [pendingExchange] - 交換承認待ち
 * @param {RewardVoucherRefundRequestsData} [pendingRefund] - 戻し承認待ち
 * @returns {void}
 */
function renderParentHome(
  data: ParentHomeData,
  pendingExchange: PointExchangeRequestsData = {
    month: currentMonth(),
    items: [],
  },
  pendingRefund: RewardVoucherRefundRequestsData = {
    month: currentMonth(),
    items: [],
  },
): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.parentHome, data);
  queryClient.setQueryData(
    queryKeys.pointExchangeRequests(currentMonth(), "pending"),
    pendingExchange,
  );
  queryClient.setQueryData(
    queryKeys.rewardVoucherRefundRequests(currentMonth(), "pending"),
    pendingRefund,
  );
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/parent"]}>
        <Routes>
          <Route path="/parent" element={<ParentHomePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ParentHomePage penalty ticket", () => {
  afterEach(() => {
    cleanup();
  });

  it("発行セクションを表示し、負債59分は disabled", () => {
    renderParentHome(
      buildParentHomeData({
        switchMinutes: -59,
        displayBalance: -59,
        debtMinutes: 59,
        issuablePenaltyTicketCount: 0,
      }),
    );
    expect(screen.getByTestId("penalty-ticket-issue-section")).toBeTruthy();
    expect(screen.getByTestId("issue-disabled-reason").textContent).toContain(
      "60分未満",
    );
  });

  it("負債120分は発行可能2枚を表示する", () => {
    renderParentHome(
      buildParentHomeData({
        switchMinutes: 0,
        displayBalance: 0,
        penaltyMinutes: 120,
        debtMinutes: 120,
        issuablePenaltyTicketCount: 2,
      }),
    );
    expect(screen.getByTestId("issue-issuable-count").textContent).toBe("2枚");
    expect(
      screen.getByTestId("issue-open-confirm").hasAttribute("disabled"),
    ).toBe(false);
  });

  it("消費セクションを表示し、在庫0枚は disabled", () => {
    renderParentHome(buildParentHomeData({ penaltyTicketCount: 0 }));
    expect(screen.getByTestId("penalty-ticket-consume-section")).toBeTruthy();
    expect(
      screen.getByTestId("consume-open-confirm").hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByTestId("consume-disabled-reason")).toBeTruthy();
  });

  it("在庫2枚は消費ボタンが有効", () => {
    renderParentHome(buildParentHomeData({ penaltyTicketCount: 2 }));
    expect(screen.getByTestId("consume-ticket-count").textContent).toBe("2枚");
    expect(
      screen.getByTestId("consume-open-confirm").hasAttribute("disabled"),
    ).toBe(false);
  });

  it("交換・戻し承認待ちが 0 件のとき確認 CTA は disabled", () => {
    renderParentHome(buildParentHomeData());

    const exchangeCard = screen.getByTestId("point-exchange-pending-card");
    const refundCard = screen.getByTestId("return-pending-card");

    expect(
      within(exchangeCard)
        .getByRole("button", { name: "確認 →" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      within(refundCard)
        .getByRole("button", { name: "確認 →" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("交換・戻し承認待ちがあるとき確認 CTA は有効", () => {
    renderParentHome(
      buildParentHomeData(),
      {
        month: currentMonth(),
        items: [
          {
            id: "pex_pending_1",
            status: "pending",
            requestedAt: "2026-08-25T10:00:00+09:00",
            decidedAt: "",
            items: [
              {
                catalogItemId: "cash-100",
                label: "100円",
                quantity: 1,
                pointCost: 100,
                subtotalPoints: 100,
              },
            ],
            totalPoints: 100,
            effects: {
              spentPoints: 100,
              issuedRewardVouchers: { "cash-100": 1 },
              consumedPenaltyTickets: 0,
            },
            rejectReason: "",
          },
        ],
      },
      {
        month: currentMonth(),
        items: [
          {
            id: "rvr_pending_1",
            status: "pending",
            requestedAt: "2026-08-25T10:00:00+09:00",
            decidedAt: "",
            items: [
              {
                catalogItemId: "cash-100",
                label: "100円",
                quantity: 1,
                pointValue: 100,
                subtotalPoints: 100,
              },
            ],
            totalPoints: 100,
            rejectReason: "",
          },
        ],
      },
    );

    const exchangeCard = screen.getByTestId("point-exchange-pending-card");
    const refundCard = screen.getByTestId("return-pending-card");

    expect(
      within(exchangeCard)
        .getByRole("button", { name: "確認 →" })
        .hasAttribute("disabled"),
    ).toBe(false);
    expect(
      within(refundCard)
        .getByRole("button", { name: "確認 →" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("Figma v6 の要対応・設定・管理セクションと主要カードを表示する", () => {
    renderParentHome(buildParentHomeData());

    expect(screen.getByRole("heading", { name: "📋 要対応" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "⚙️ いまの設定" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "🔧 管理・設定" })).toBeTruthy();

    expect(screen.getByText("未採点のクエスト")).toBeTruthy();
    expect(screen.getByText("登録受付の再開")).toBeTruthy();
    expect(screen.getByText("交換承認待ち")).toBeTruthy();
    expect(screen.getByText("戻し承認待ち")).toBeTruthy();
    expect(screen.getByText("長期休みモード")).toBeTruthy();
    expect(screen.getByText("免除期間")).toBeTruthy();
    expect(screen.getByText("本日の目標就寝時刻")).toBeTruthy();
    expect(screen.getByTestId("point-refill-card")).toBeTruthy();
    expect(screen.getByTestId("settings-management-card")).toBeTruthy();
  });
});
