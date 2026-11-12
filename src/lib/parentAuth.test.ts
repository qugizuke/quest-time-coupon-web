/**
 * @file parentAuth 単体テスト
 * @description サーバ発行トークンの保存・期限判定・旧形式の拒否を検証する。
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearParentAuthed,
  getParentAuthRemainingMs,
  getParentToken,
  isParentAuthed,
  normalizeExpiresAt,
  PARENT_AUTH_FALLBACK_TTL_MS,
  PARENT_AUTH_KEY,
  setParentSession,
} from "./parentAuth";

/** 期限（ISO）を作る */
function isoIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

describe("parentAuth", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T12:00:00+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("未認証時は false・token なし", () => {
    expect(isParentAuthed()).toBe(false);
    expect(getParentToken()).toBeNull();
    expect(getParentAuthRemainingMs()).toBe(0);
  });

  it("トークン保存後は期限まで true、期限切れで破棄する", () => {
    setParentSession({ token: "v1.payload.sig", expiresAt: isoIn(60_000) });
    expect(isParentAuthed()).toBe(true);
    expect(getParentToken()).toBe("v1.payload.sig");
    expect(getParentAuthRemainingMs()).toBe(60_000);

    vi.advanceTimersByTime(59_999);
    expect(isParentAuthed()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(isParentAuthed()).toBe(false);
    expect(getParentAuthRemainingMs()).toBe(0);
    expect(sessionStorage.getItem(PARENT_AUTH_KEY)).toBeNull();
  });

  it("旧 authedAt だけの保存値は認証として扱わない（固定フラグ廃止）", () => {
    sessionStorage.setItem(
      PARENT_AUTH_KEY,
      JSON.stringify({ authedAt: Date.now() }),
    );
    expect(isParentAuthed()).toBe(false);
    expect(getParentToken()).toBeNull();
    expect(sessionStorage.getItem(PARENT_AUTH_KEY)).toBeNull();
  });

  it("旧 gradeAuth キーは削除する", () => {
    sessionStorage.setItem(
      "qtc:gradeAuth",
      JSON.stringify({ authedAt: Date.now() }),
    );
    setParentSession({ token: "t", expiresAt: isoIn(60_000) });
    expect(sessionStorage.getItem("qtc:gradeAuth")).toBeNull();
    expect(isParentAuthed()).toBe(true);
  });

  it("空トークン・過去期限は保存を拒否する", () => {
    expect(() =>
      setParentSession({ token: "", expiresAt: isoIn(60_000) }),
    ).toThrow(/トークンまたは期限が不正/);
    expect(() =>
      setParentSession({ token: "t", expiresAt: isoIn(-1) }),
    ).toThrow(/トークンまたは期限が不正/);
    expect(isParentAuthed()).toBe(false);
  });

  it("clearParentAuthed で即時破棄する", () => {
    setParentSession({ token: "t", expiresAt: isoIn(60_000) });
    clearParentAuthed();
    expect(isParentAuthed()).toBe(false);
    expect(sessionStorage.getItem(PARENT_AUTH_KEY)).toBeNull();
  });

  it("期限内でも壊れた JSON は破棄する", () => {
    sessionStorage.setItem(PARENT_AUTH_KEY, "{not json");
    expect(isParentAuthed()).toBe(false);
    expect(sessionStorage.getItem(PARENT_AUTH_KEY)).toBeNull();
  });
});

describe("normalizeExpiresAt", () => {
  it("ISO8601 を ms へ変換する", () => {
    expect(normalizeExpiresAt("2026-07-30T12:00:00.000Z")).toBe(
      Date.parse("2026-07-30T12:00:00.000Z"),
    );
  });

  it("epoch 秒・epoch ms の両方を受ける", () => {
    expect(normalizeExpiresAt(1_785_412_800)).toBe(1_785_412_800_000);
    expect(normalizeExpiresAt(1_785_412_800_000)).toBe(1_785_412_800_000);
  });

  it("解釈できない値は 0", () => {
    expect(normalizeExpiresAt("not-a-date")).toBe(0);
    expect(normalizeExpiresAt(-1)).toBe(0);
    expect(normalizeExpiresAt(Number.NaN)).toBe(0);
  });

  it("フォールバック TTL は契約の3600秒", () => {
    expect(PARENT_AUTH_FALLBACK_TTL_MS).toBe(3_600_000);
  });
});
