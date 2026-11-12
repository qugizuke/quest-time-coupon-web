/**
 * @file ParentPasswordModal 描画・操作テスト
 * @description Figma modal-parent-password の 5 状態
 *   （initial / entering / complete / error / processing）と、
 *   サーバ照合（parentLogin）の成功・失敗・試行制限を検証する。
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParentPasswordModal } from "@/components/ParentPasswordModal";
import { ApiError, postParentLogin } from "@/api/client";
import { PARENT_AUTH_KEY } from "@/lib/parentAuth";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();
  return { ...actual, postParentLogin: vi.fn() };
});

const postParentLoginMock = vi.mocked(postParentLogin);

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
 * 入室を押してサーバ応答を待つ
 * @param {string} pin - 入力する PIN
 * @returns {Promise<void>} 完了時に resolve
 */
async function submitPin(pin: string) {
  typePin(pin);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "入室" }));
  });
}

describe("ParentPasswordModal", () => {
  beforeEach(() => {
    sessionStorage.clear();
    postParentLoginMock.mockReset();
  });

  afterEach(() => {
    cleanup();
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
    expect(postParentLoginMock).not.toHaveBeenCalled();
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

    typePin("1234");
    expect(
      (screen.getByRole("button", { name: "入室" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("processing: 応答待ちは文言が変わり操作を受け付けない", async () => {
    let resolveLogin: (value: { token: string; expiresAt: string }) => void =
      () => {};
    postParentLoginMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const { onSuccess, onDismiss } = renderModal();

    typePin("1234");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "入室" }));
    });

    expect(screen.getByText("コードを確認しています…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "確認中…" })).toBeTruthy();

    const cancel = screen.getByRole("button", {
      name: "キャンセル",
    }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    fireEvent.click(cancel);
    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      resolveLogin({
        token: "v1.payload.sig",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("成功: サーバのトークンと期限を保存して onSuccess を呼ぶ", async () => {
    postParentLoginMock.mockResolvedValue({
      token: "v1.payload.sig",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    const { onSuccess, onDismiss } = renderModal();

    await submitPin("1234");

    expect(postParentLoginMock).toHaveBeenCalledWith({ pin: "1234" });
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();
    const saved = sessionStorage.getItem(PARENT_AUTH_KEY);
    expect(saved).toContain("v1.payload.sig");
    expect(saved).not.toContain("1234");
  });

  it("error: 不一致はエラー文言を表示し、再入力で消える", async () => {
    postParentLoginMock.mockRejectedValue(
      new ApiError("INVALID_CREDENTIALS", "パスワードが違います", 401),
    );
    const { onSuccess } = renderModal();

    await submitPin("9999");

    expect(
      screen.getByText("コードが違います。もう一度入力してください"),
    ).toBeTruthy();
    // 誤りコードは4マス分の●のまま見せる
    expect(screen.getAllByText("●")).toHaveLength(4);
    expect(onSuccess).not.toHaveBeenCalled();

    typePin("1");
    expect(
      screen.queryByText("コードが違います。もう一度入力してください"),
    ).toBeNull();
    expect(screen.getAllByText("●")).toHaveLength(1);
  });

  it("error: 429 は待機時間を案内する", async () => {
    postParentLoginMock.mockRejectedValue(
      new ApiError("RATE_LIMITED", "試行回数が上限です", 429, 600),
    );
    const { onSuccess } = renderModal();

    await submitPin("9999");

    expect(
      screen.getByText(
        "試行回数が上限に達しました。約10分後に再度お試しください",
      ),
    ).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("error: 通信・サーバ障害は汎用文言にする", async () => {
    postParentLoginMock.mockRejectedValue(new Error("network down"));
    renderModal();

    await submitPin("9999");

    expect(
      screen.getByText("ログインできませんでした。通信環境を確認してください"),
    ).toBeTruthy();
  });

  it("キャンセル・✕で onDismiss を呼ぶ", () => {
    const { onDismiss } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
