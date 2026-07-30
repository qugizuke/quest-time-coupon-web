/**
 * @file GradeDateRedirect 単体テスト
 * @description date 展開がリテラル `:date` を埋め込まないことを保証する。
 */
import { describe, expect, it } from "vitest";
import { resolveParentGradesPath } from "./GradeDateRedirect";

describe("resolveParentGradesPath", () => {
  it("date 欠落時は一覧へ", () => {
    expect(resolveParentGradesPath(undefined)).toBe("/parent/grades");
  });

  it("date を展開して埋め込む（リテラル :date 禁止）", () => {
    expect(resolveParentGradesPath("2026-07-30")).toBe(
      "/parent/grades/2026-07-30",
    );
    expect(resolveParentGradesPath("2026-07-30")).not.toContain(":date");
  });
});
