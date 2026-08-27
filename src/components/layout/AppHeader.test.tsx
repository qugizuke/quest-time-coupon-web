/**
 * @file AppHeader 表示テスト
 * @description 保護者モード終了ボタンの狭幅短縮ラベルを検証する。
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppHeader } from "@/components/layout/AppHeader";

describe("AppHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("保護者モードでは狭幅向けに終了短縮ラベルを持つ", () => {
    render(<AppHeader mode="parent" showHome onExitParentMode={() => undefined} />);

    expect(screen.getByText("🔓 終了")).toBeTruthy();
    expect(screen.getByText("🔓 保護者モードを終了")).toBeTruthy();
  });
});
