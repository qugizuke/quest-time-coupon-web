/**
 * @file PenaltyTicketConsumeSection 描画・境界テスト
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PenaltyTicketConsumeSection } from "@/components/PenaltyTicketConsumeSection";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return {
    ...actual,
    postPenaltyTicketConsume: vi.fn(async () => ({
      ticketId: "mock-ticket-consume-1",
      penaltyTicketCount: 0,
    })),
  };
});

/**
 * セクションを描画する
 * @param {number} penaltyTicketCount - 在庫枚数
 * @returns {void}
 */
function renderSection(penaltyTicketCount: number) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PenaltyTicketConsumeSection penaltyTicketCount={penaltyTicketCount} />
    </QueryClientProvider>,
  );
}

describe("PenaltyTicketConsumeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("在庫0枚は消費ボタン disabled と理由表示", () => {
    renderSection(0);
    expect(screen.getByTestId("consume-disabled-reason").textContent).toContain(
      "在庫チケットがない",
    );
    expect(
      screen.getByTestId("consume-open-confirm").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("在庫1枚以上は確認プレビューへ進める", () => {
    renderSection(2);
    fireEvent.click(screen.getByTestId("consume-open-confirm"));
    expect(screen.getByTestId("consume-confirm-panel").textContent).toContain(
      "残り 1枚",
    );
  });

  it("確認して消費すると API を呼ぶ", async () => {
    const { postPenaltyTicketConsume } = await import("@/api/client");
    renderSection(1);
    fireEvent.click(screen.getByTestId("consume-open-confirm"));
    fireEvent.click(screen.getByTestId("consume-confirm-submit"));
    await waitFor(() => {
      expect(postPenaltyTicketConsume).toHaveBeenCalledWith();
    });
  });
});
