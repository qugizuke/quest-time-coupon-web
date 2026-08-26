/**
 * @file BedtimeModal 描画・操作テスト
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BedtimeModal } from "@/components/BedtimeModal";

afterEach(cleanup);

describe("BedtimeModal", () => {
  it.each([21, 22] as const)("%d:00 の選択状態を表示する", (selectedHour) => {
    render(
      <BedtimeModal
        open
        onClose={vi.fn()}
        selectedHour={selectedHour}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "今日の寝る時間を設定する" }),
    ).toBeTruthy();
    expect(screen.getByText("寝る時間を選んでね")).toBeTruthy();
    expect(screen.queryByText(/🛏️|21 \/ 22 \/ 23/)).toBeNull();
    expect(
      screen.getByRole("button", { name: `${selectedHour}:00` }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "閉じる" })).toBeTruthy();
  });

  it("選択しても自動では閉じず、明示的に閉じられる", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <BedtimeModal
        open
        onClose={onClose}
        selectedHour={22}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "21:00" }));
    expect(onSelect).toHaveBeenCalledWith(21);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ["disabled", { disabled: true }],
    ["processing", { processing: true }],
  ] as const)("%s 状態では時刻を変更できない", (_name, state) => {
    render(
      <BedtimeModal
        open
        onClose={vi.fn()}
        selectedHour={21}
        onSelect={vi.fn()}
        {...state}
      />,
    );

    for (const label of ["21:00", "22:00", "23:00"]) {
      expect(
        screen.getByRole("button", { name: label }).hasAttribute("disabled"),
      ).toBe(true);
    }
  });

  it("processing 状態をライブ領域として表示する", () => {
    render(
      <BedtimeModal
        open
        onClose={vi.fn()}
        selectedHour={22}
        onSelect={vi.fn()}
        processing
      />,
    );

    expect(screen.getByTestId("bedtime-modal").getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(screen.getByText("保存しています…")).toBeTruthy();
  });
});
