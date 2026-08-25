/**
 * @file BalanceDisplay 描画テスト
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BalanceDisplay } from "@/components/BalanceDisplay";

describe("BalanceDisplay", () => {
  afterEach(() => {
    cleanup();
  });

  it("負残高を丸めずに表示する", () => {
    render(
      <BalanceDisplay
        switchMinutes={-30}
        penaltyMinutes={0}
        debtMinutes={30}
        audience="child"
        compact
      />,
    );
    expect(screen.getByTestId("balance-minutes").textContent).toBe("-30");
    expect(screen.getByTestId("balance-debt-minutes").textContent).toContain(
      "30分",
    );
    expect(screen.getByTestId("balance-child-hint")).toBeTruthy();
  });

  it("タイマー超過と合算負債を区別して表示する", () => {
    render(
      <BalanceDisplay
        switchMinutes={-20}
        penaltyMinutes={40}
        debtMinutes={60}
        audience="parent"
      />,
    );
    expect(screen.getByTestId("balance-penalty-minutes").textContent).toContain(
      "40分",
    );
    expect(screen.getByTestId("balance-debt-minutes").textContent).toContain(
      "60分",
    );
  });

  it("ペナルティチケット在庫を0枚でも常時表示する", () => {
    render(<BalanceDisplay switchMinutes={60} />);
    expect(
      screen.getByTestId("balance-penalty-ticket-count").textContent,
    ).toBe("ペナルティチケット: 0枚");
  });

  it("ペナルティチケット在庫がある場合はその枚数を表示する", () => {
    render(<BalanceDisplay switchMinutes={60} penaltyTicketCount={3} />);
    expect(
      screen.getByTestId("balance-penalty-ticket-count").textContent,
    ).toBe("ペナルティチケット: 3枚");
  });

  it("balancePoints 指定時はポイント残高を分けて表示する（ADR-005 二財布）", () => {
    render(<BalanceDisplay balancePoints={100} switchMinutes={30} />);
    expect(screen.getByTestId("balance-points").textContent).toBe(
      "いまのポイント: 100pt",
    );
    expect(screen.getByTestId("balance-minutes").textContent).toBe("30");
  });

  it("balancePoints 未指定時はポイント表示を出さない", () => {
    render(<BalanceDisplay switchMinutes={30} />);
    expect(screen.queryByTestId("balance-points")).toBeNull();
  });
});
