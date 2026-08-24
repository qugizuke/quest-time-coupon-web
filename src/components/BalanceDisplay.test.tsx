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
        balanceMinutes={-30}
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
        balanceMinutes={-20}
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
});
