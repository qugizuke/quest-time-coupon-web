/**
 * @file ParentPasswordModal 描画・操作テスト
 * @description Figma modal-parent-password の 5 状態
 *   （initial / entering / complete / error / processing）と認証フローを検証する。
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParentPasswordModal } from "@/components/ParentPasswordModal";

/** processing 表示時間（実装の PROCESSING_MS と同期） */
const PROCESSING_MS = 450;

/**
 * モーダルを描画する
 * @returns {{ onSuccess: ReturnType<typeof vi.fn>, onDismiss: ReturnType<typeof vi.fn> }} spy
 */
function renderModal() {
  const onSuccess = vi.fn();
  const onDismiss = vi.fn();
  render(
    <ParentPasswordModal open onSuccess={onSuccess} onDismiss={onDismiss} />,
  );
  return { onSuccess, onDismiss };
}

/**
 * PIN 入力欄へ値を入れる
 * @param {string} value - 入力値
 * @returns {void}
 */
function typePin(value: string) {
  fireEvent.change(screen.getByLabelText("保護者モードパスワード"), {
    target: { value },
  });
}

/**
 * 入室 → processing を経過させて照合結果まで進める
 * @param {string} pin - 入力する PIN
 * @returns {void}
 */
function submitPin(pin: string) {
  typePin(pin);
  fireEvent.click(screen.getByRole("button", { name: "入室" }));
  act(() => {
    vi.advanceTimersByTime(PROCESSING_MS);
  });
}

describe("ParentPasswordModal", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("initial: タイトル・説明・空の4マス・無効な入室・キャンセル・✕がある", () => {
    renderModal();

    expect(screen.getByRole("heading", { name: "保護者モード" })).toBeTruthy();
    expect(
      screen.getByText("保護者エリアに移動します。4桁のコードを入力してください"),
    ).toBeTruthy();
    expect(screen.getAllByTestId("pin-box")).toHaveLength(4);
    expect(screen.queryAllByText("●")).toHaveLength(0);
    expect(
      (screen.getByRole("button", { name: "入室" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeTruthy();
  });

  it("entering: 数字のみ4桁まで受け付け、入力分だけ●を表示する", () => {
    renderModal();

    typePin("12ab");
    expect(screen.getAllByText("●")).toHaveLength(2);
    expect(
      (screen.getByRole("button", { name: "入室" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    typePin("123456");
    expect(screen.getAllByText("●")).toHaveLength(4);
  });

  it("complete: 4桁入力で入室が有効になる", () => {
    renderModal();

    typePin("0119");
    expect(
      (screen.getByRole("button", { name: "入室" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("processing: 確認中は文言が変わり操作を受け付けない", () => {
    const { onDismiss } = renderModal();

    typePin("0119");
    fireEvent.click(screen.getByRole("button", { name: "入室" }));

    expect(screen.getByText("コードを確認しています…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "確認中…" })).toBeTruthy();

    const cancel = screen.getByRole("button", {
      name: "キャンセル",
    }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    fireEvent.click(cancel);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("正しい PIN で認証を保存して onSuccess を呼ぶ", () => {
    const { onSuccess, onDismiss } = renderModal();

    submitPin("0119");

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("qtc:parentAuth")).toBeTruthy();
  });

  it("error: 誤り PIN でエラー文言と残り回数を表示し、再入力で消える", () => {
    const { onSuccess, onDismiss } = renderModal();

    submitPin("9999");

    expect(
      screen.getByText("コードが違います。もう一度入力してください"),
    ).toBeTruthy();
    expect(screen.getByText("残り 2 回")).toBeTruthy();
    // 誤りコードは4マス分の●のまま見せる
    expect(screen.getAllByText("●")).toHaveLength(4);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();

    typePin("0");
    expect(
      screen.queryByText("コードが違います。もう一度入力してください"),
    ).toBeNull();
    expect(screen.getAllByText("●")).toHaveLength(1);
  });

  it("3回失敗すると onDismiss を呼ぶ", () => {
    const { onDismiss } = renderModal();

    submitPin("0000");
    expect(screen.getByText("残り 2 回")).toBeTruthy();
    submitPin("1111");
    expect(screen.getByText("残り 1 回")).toBeTruthy();
    submitPin("2222");

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("qtc:parentAuth")).toBeNull();
  });

  it("キャンセル・✕で onDismiss を呼ぶ", () => {
    const { onDismiss } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
