/**
 * @file ParentHomePage ペナルティチケット発行 UI テスト
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { ParentHomePage } from "@/pages/ParentHomePage";
import { buildParentHomeData } from "@/test/fixtures";
import type { ParentHomeData } from "@/types/api";

/**
 * 保護者ホームを描画する
 * @param {ParentHomeData} data - parentHome
 * @returns {void}
 */
function renderParentHome(data: ParentHomeData): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.parentHome, data);
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
});
