/**
 * @file 日付ユーティリティのテスト
 * @description JST 時刻表示など画面向けフォーマットを固定する。
 */
import { describe, expect, it } from "vitest";
import { formatJstClockJa } from "@/lib/date";

describe("formatJstClockJa", () => {
  it("UTC ISO を JST の時分表示に変換する", () => {
    expect(formatJstClockJa("2026-08-02T11:30:38.158Z")).toBe("20時30分");
  });

  it("オフセット付き ISO も JST に揃える", () => {
    expect(formatJstClockJa("2026-08-02T20:05:00+09:00")).toBe("20時05分");
  });

  it("欠落・不正値は — を返す", () => {
    expect(formatJstClockJa(null)).toBe("—");
    expect(formatJstClockJa(undefined)).toBe("—");
    expect(formatJstClockJa("")).toBe("—");
    expect(formatJstClockJa("not-a-date")).toBe("—");
  });
});
