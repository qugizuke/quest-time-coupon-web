/**
 * @file registrationReopen ユーティリティテスト
 * @description タイマー候補と endsAt（+09:00）組み立てを検証する。
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_REOPEN_DURATION_MINUTES,
  buildEndsAtFromDuration,
  buildReopenDurationOptions,
  formatEndsAtJst,
  parseReopenDurationMinutes,
} from "@/lib/registrationReopen";

describe("formatEndsAtJst", () => {
  it("YYYY-MM-DDTHH:mm:ss+09:00 を返す", () => {
    expect(formatEndsAtJst("2026-07-30", 18, 30)).toBe(
      "2026-07-30T18:30:00+09:00",
    );
    expect(formatEndsAtJst("2026-07-30", 18, 30, 45)).toBe(
      "2026-07-30T18:30:45+09:00",
    );
  });
});

describe("buildReopenDurationOptions", () => {
  it("30分刻み・最大2時間の4候補を返す", () => {
    expect(buildReopenDurationOptions()).toEqual([
      { value: "30", label: "30分", minutes: 30 },
      { value: "60", label: "1時間", minutes: 60 },
      { value: "90", label: "1時間30分", minutes: 90 },
      { value: "120", label: "2時間", minutes: 120 },
    ]);
  });

  it("初期選択は1時間", () => {
    expect(DEFAULT_REOPEN_DURATION_MINUTES).toBe(60);
  });
});

describe("parseReopenDurationMinutes", () => {
  it("有効な分数だけ通す", () => {
    expect(parseReopenDurationMinutes("30")).toBe(30);
    expect(parseReopenDurationMinutes("60")).toBe(60);
    expect(parseReopenDurationMinutes("90")).toBe(90);
    expect(parseReopenDurationMinutes("120")).toBe(120);
    expect(parseReopenDurationMinutes("45")).toBeNull();
    expect(parseReopenDurationMinutes("")).toBeNull();
  });
});

describe("buildEndsAtFromDuration", () => {
  it("いまから1時間後の endsAt を +09:00 で返す", () => {
    const endsAt = buildEndsAtFromDuration(
      60,
      new Date("2026-07-30T22:00:00+09:00"),
    );
    expect(endsAt).toBe("2026-07-30T23:00:00+09:00");
  });

  it("日付またぎを許容する", () => {
    const endsAt = buildEndsAtFromDuration(
      90,
      new Date("2026-07-30T23:00:00+09:00"),
    );
    expect(endsAt).toBe("2026-07-31T00:30:00+09:00");
  });

  it("2時間後も正しい", () => {
    const endsAt = buildEndsAtFromDuration(
      120,
      new Date("2026-07-30T20:15:30+09:00"),
    );
    expect(endsAt).toBe("2026-07-30T22:15:30+09:00");
  });
});
