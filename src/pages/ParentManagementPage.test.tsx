/**
 * @file ParentManagementPage テスト
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { ParentManagementPage } from "@/pages/ParentManagementPage";
import { buildParentHomeData } from "@/test/fixtures";
import type { ParentHomeData } from "@/types/api";

/** ポイント・チケット管理画面を描画する */
function renderManagement(data: ParentHomeData): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.parentHome, data);

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/parent/management"]}>
        <ParentManagementPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ParentManagementPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("ポイント・チケット管理に操作UIを集約する", () => {
    renderManagement(buildParentHomeData());

    expect(
      screen.getByRole("heading", { name: "ポイント・チケット管理" }),
    ).toBeTruthy();
    expect(screen.getByTestId("penalty-ticket-issue-section")).toBeTruthy();
    expect(screen.getByTestId("penalty-ticket-consume-section")).toBeTruthy();
    expect(screen.queryByTestId("point-refill-card")).toBeNull();
  });

  it("負債120分はペナルティチケットを2枚発行できる", () => {
    renderManagement(
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

  it("在庫がない場合はペナルティチケットを消費できない", () => {
    renderManagement(buildParentHomeData({ penaltyTicketCount: 0 }));

    expect(
      screen.getByTestId("consume-open-confirm").hasAttribute("disabled"),
    ).toBe(true);
    expect(screen.getByTestId("consume-disabled-reason")).toBeTruthy();
  });
});
