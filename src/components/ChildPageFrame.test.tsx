/**
 * @file ChildPageFrame 統合テスト
 * @description 子ども5ルート相当で保護者モード導線（ヘッダー＋モーダル）があることを検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChildPageFrame } from "./layout/ChildPageFrame";

/** 子ども画面パス（screen-design §5） */
const CHILD_PATHS = ["/", "/quest", "/quest/confirm", "/results", "/timer"] as const;

/**
 * 指定パスで ChildPageFrame を描画する
 * @param {string} path - 初期パス
 * @param {boolean} [vacationMode] - 長期休みモード
 * @returns {void}
 */
function renderAt(path: string, vacationMode = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {CHILD_PATHS.map((childPath) => (
            <Route
              key={childPath}
              path={childPath}
              element={
                <ChildPageFrame
                  showHome={childPath !== "/"}
                  vacationMode={vacationMode}
                >
                  <div>ページ本体:{childPath}</div>
                </ChildPageFrame>
              }
            />
          ))}
          <Route path="/parent" element={<div>保護者ホーム</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ChildPageFrame", () => {
  afterEach(() => {
    cleanup();
  });

  it.each(CHILD_PATHS)(
    "%s で保護者モードボタンと入口モーダルが使える",
    (path) => {
      renderAt(path);
      expect(screen.getByText(`ページ本体:${path}`)).toBeTruthy();

      const entry = screen.getByRole("button", { name: /保護者モード/ });
      fireEvent.click(entry);
      expect(screen.getByTestId("parent-password-modal")).toBeTruthy();
    },
  );

  it("ホーム以外ではヘッダーにホームボタンがある", () => {
    renderAt("/quest");
    expect(screen.getByRole("button", { name: /ホーム/ })).toBeTruthy();
  });

  it("ホームではヘッダーのホームボタンを出さない", () => {
    renderAt("/");
    expect(screen.queryByRole("button", { name: /🏠 ホーム/ })).toBeNull();
  });

  it("長期休みモードではバッジを表示する", () => {
    renderAt("/", true);
    expect(screen.getByText("🏖️ 長期休みモード")).toBeTruthy();
  });
});
