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
      settledMinutes: count * 60,
      debtBefore: 120,
      debtAfter: 120 - count * 60,
      balanceMinutes: -30,
      displayBalance: -30,
      penaltyMinutes: 0,
      issuablePenaltyTicketCount: 0,
    })),
  };
});

/**
 * セクションを描画する
 * @param {object} props - 残高・負債
 * @returns {void}
 */
function renderSection(props: {
  balanceMinutes: number;
  penaltyMinutes: number;
  debtMinutes: number;
  issuablePenaltyTicketCount?: number;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PenaltyTicketIssueSection
        balanceMinutes={props.balanceMinutes}
        penaltyMinutes={props.penaltyMinutes}
        debtMinutes={props.debtMinutes}
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

  it("負債59分は発行ボタン disabled と理由表示", () => {
    renderSection({
      balanceMinutes: -59,
      penaltyMinutes: 0,
      debtMinutes: 59,
      issuablePenaltyTicketCount: 0,
    });
    expect(screen.getByTestId("issue-disabled-reason").textContent).toContain(
      "60分未満",
    );
    expect(
      screen.getByTestId("issue-open-confirm").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("負債60分は1枚発行の確認プレビューへ進める", () => {
    renderSection({
      balanceMinutes: -60,
      penaltyMinutes: 0,
      debtMinutes: 60,
      issuablePenaltyTicketCount: 1,
    });
    fireEvent.click(screen.getByTestId("issue-open-confirm"));
    expect(screen.getByTestId("issue-confirm-panel").textContent).toContain(
      "残り負債 0分",
    );
  });

  it("負債150分で2枚発行のプレビューは残り30分", () => {
    renderSection({
      balanceMinutes: -90,
      penaltyMinutes: 60,
      debtMinutes: 150,
      issuablePenaltyTicketCount: 2,
    });
    fireEvent.change(screen.getByTestId("issue-count-select"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByTestId("issue-open-confirm"));
    expect(screen.getByTestId("issue-confirm-panel").textContent).toContain(
      "残り負債 30分",
    );
  });

  it("確認して発行すると API を呼ぶ", async () => {
    const { postPenaltyTicketIssue } = await import("@/api/client");
    renderSection({
      balanceMinutes: -120,
      penaltyMinutes: 0,
      debtMinutes: 120,
      issuablePenaltyTicketCount: 2,
    });
    fireEvent.click(screen.getByTestId("issue-open-confirm"));
    fireEvent.click(screen.getByTestId("issue-confirm-submit"));
    await waitFor(() => {
      expect(postPenaltyTicketIssue).toHaveBeenCalledWith({ count: 1 });
    });
  });
});
