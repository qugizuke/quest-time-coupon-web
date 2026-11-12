/**
 * @file ParentGuard 統合テスト
 * @description 未認証ゲート、TTL 失効、401 通知による再ゲートを検証する。
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ParentGuard } from "./ParentGuard";
import {
  clearParentAuthed,
  PARENT_AUTH_KEY,
  PARENT_UNAUTHORIZED_EVENT,
  setParentSession,
} from "@/lib/parentAuth";

/** 認証有効期限（テスト用60秒） */
const TTL_MS = 60_000;

/**
 * 有効なセッションを保存する
 * @returns {void}
 */
function signIn() {
  setParentSession({
    token: "v1.test.payload",
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
  });
}

/**
 * ParentGuard 付きルートを描画する
 * @returns {ReturnType<typeof render>} 描画結果
 */
function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/parent"]}>
      <Routes>
        <Route path="/parent" element={<ParentGuard />}>
          <Route index element={<div>保護者ホーム本体</div>} />
        </Route>
        <Route path="/" element={<div>子どもホーム</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ParentGuard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T12:00:00+09:00"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    clearParentAuthed();
    sessionStorage.clear();
  });

  it("未認証時はパスワードモーダルのみで本体を描画しない", () => {
    renderGuard();
    expect(screen.getByTestId("parent-password-modal")).toBeTruthy();
    expect(screen.queryByText("保護者ホーム本体")).toBeNull();
  });

  it("認証済みなら本体を描画する", () => {
    signIn();
    renderGuard();
    expect(screen.getByText("保護者ホーム本体")).toBeTruthy();
    expect(screen.queryByTestId("parent-password-modal")).toBeNull();
  });

  it("開いたまま期限を超過すると認証破棄して再ゲートする", () => {
    signIn();
    renderGuard();
    expect(screen.getByText("保護者ホーム本体")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(TTL_MS);
    });

    expect(screen.queryByText("保護者ホーム本体")).toBeNull();
    expect(screen.getByTestId("parent-password-modal")).toBeTruthy();
    expect(sessionStorage.getItem(PARENT_AUTH_KEY)).toBeNull();
  });

  it("401 通知を受けたらセッションを捨てて再ゲートする", () => {
    signIn();
    renderGuard();
    expect(screen.getByText("保護者ホーム本体")).toBeTruthy();

    act(() => {
      clearParentAuthed();
      window.dispatchEvent(new Event(PARENT_UNAUTHORIZED_EVENT));
    });

    expect(screen.queryByText("保護者ホーム本体")).toBeNull();
    expect(screen.getByTestId("parent-password-modal")).toBeTruthy();
  });
});
