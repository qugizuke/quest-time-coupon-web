/**
 * @file PenaltyTicketIssueSection 描画・境界テスト
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PenaltyTicketIssueSection } from "@/components/PenaltyTicketIssueSection";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return {
    ...actual,
    postPenaltyTicketIssue: vi.fn(async ({ count }: { count: number }) => ({
      ticketId: "mock-ticket-1",
      count,
      settledPoints: count * 100,
      pointDebtBefore: 250,
      pointDebtAfter: 250 - count * 100,
      balancePoints: -250 + count * 100,
      switchMinutes: 30,
      displayBalance: 30,
      penaltyMinutes: 0,
      issuablePenaltyTicketCount: 0,
      penaltyTicketCount: count,
    })),
  };
});

/**
 * セクションを描画する
 * @param {object} props - 残高・負債
 * @returns {void}
 */
function renderSection(props: {
  balancePoints: number;
  issuablePenaltyTicketCount?: number;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PenaltyTicketIssueSection
        balancePoints={props.balancePoints}
        issuablePenaltyTicketCount={props.issuablePenaltyTicketCount}
      />
    </QueryClientProvider>,
  );
}

describe("PenaltyTicketIssueSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("ポイント負債99ptは発行ボタン disabled と理由表示", () => {
    renderSection({
      balancePoints: -99,
      issuablePenaltyTicketCount: 0,
    });
    expect(screen.getByTestId("issue-disabled-reason").textContent).toContain(
      "100pt未満",
    );
    expect(
      screen.getByTestId("issue-open-confirm").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("ポイント負債100ptは1枚発行の確認プレビューへ進める", () => {
    renderSection({
      balancePoints: -100,
      issuablePenaltyTicketCount: 1,
    });
    fireEvent.click(screen.getByTestId("issue-open-confirm"));
    expect(screen.getByTestId("issue-confirm-panel").textContent).toContain(
      "発行後 0pt",
    );
  });

  it("ポイント負債250ptで2枚発行のプレビューは残高-50pt", () => {
    renderSection({
      balancePoints: -250,
      issuablePenaltyTicketCount: 2,
    });
    fireEvent.change(screen.getByTestId("issue-count-select"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("issue-open-confirm"));
    expect(screen.getByTestId("issue-confirm-panel").textContent).toContain(
      "発行後 -50pt",
    );
  });

  it("確認して発行すると API を呼ぶ", async () => {
    const { postPenaltyTicketIssue } = await import("@/api/client");
    renderSection({
      balancePoints: -200,
      issuablePenaltyTicketCount: 2,
    });
    fireEvent.click(screen.getByTestId("issue-open-confirm"));
    fireEvent.click(screen.getByTestId("issue-confirm-submit"));
    await waitFor(() => {
      expect(postPenaltyTicketIssue).toHaveBeenCalledWith({ count: 1 });
    });
  });
});
