/**
 * @file parentAuth 単体テスト
 * @description Session Storage・TTL・パスワード照合を検証する。
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearParentAuthed,
  isParentAuthed,
  PARENT_AUTH_TTL_MS,
  PARENT_PASSWORD,
  setParentAuthed,
  verifyParentPassword,
} from "./parentAuth";

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

  it("正しいパスワードのみ通す", () => {
    expect(verifyParentPassword(PARENT_PASSWORD)).toBe(true);
    expect(verifyParentPassword("0000")).toBe(false);
    expect(verifyParentPassword("")).toBe(false);
  });

  it("未認証時は false", () => {
    expect(isParentAuthed()).toBe(false);
  });

  it("認証後は TTL 内で true、期限切れで false", () => {
    setParentAuthed();
    expect(isParentAuthed()).toBe(true);

    vi.advanceTimersByTime(PARENT_AUTH_TTL_MS - 1);
    expect(isParentAuthed()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(isParentAuthed()).toBe(false);
    expect(sessionStorage.getItem("qtc:parentAuth")).toBeNull();
  });

  it("clearParentAuthed で即時破棄する", () => {
    setParentAuthed();
    clearParentAuthed();
    expect(isParentAuthed()).toBe(false);
  });

  it("旧 gradeAuth キーを parentAuth へ移行する", () => {
    sessionStorage.setItem(
      "qtc:gradeAuth",
      JSON.stringify({ authedAt: Date.now() }),
    );
    expect(isParentAuthed()).toBe(true);
    expect(sessionStorage.getItem("qtc:parentAuth")).not.toBeNull();
    expect(sessionStorage.getItem("qtc:gradeAuth")).toBeNull();
  });
});
