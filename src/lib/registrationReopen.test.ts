/**
 * @file registrationReopen ユーティリティテスト
 * @description endsAt が契約の `+09:00` 形式であること・30分刻みを検証する。
 */
import { describe, expect, it } from "vitest";
import {
  buildReopenUntilOptions,
  formatEndsAtJst,
} from "@/lib/registrationReopen";

describe("formatEndsAtJst", () => {
  it("YYYY-MM-DDTHH:mm:ss+09:00 を返す", () => {
    expect(formatEndsAtJst("2026-07-30", 18, 30)).toBe(
      "2026-07-30T18:30:00+09:00",
    );
  });
});

describe("buildReopenUntilOptions", () => {
  it("value はすべて +09:00 固定で Z を使わない", () => {
    const options = buildReopenUntilOptions({
      now: new Date(2026, 6, 30, 20, 5, 0),
      dateYmd: "2026-07-30",
    });
    expect(options.length).toBeGreaterThan(0);
    for (const opt of options) {
      expect(opt.value).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/,
      );
      expect(opt.value).not.toContain("Z");
      expect(opt.value.startsWith("2026-07-30T")).toBe(true);
    }
    expect(options[0]?.value).toBe("2026-07-30T20:30:00+09:00");
    expect(options.at(-1)?.value).toBe("2026-07-30T23:30:00+09:00");
  });

  it("23:30 以降は候補なし", () => {
    const options = buildReopenUntilOptions({
      now: new Date(2026, 6, 30, 23, 30, 0),
      dateYmd: "2026-07-30",
    });
    expect(options).toEqual([]);
  });

  it("dateYmd が JST 当日なら UTC 環境でも候補を返す", () => {
    const options = buildReopenUntilOptions({
      now: new Date("2026-07-31T15:00:00Z"),
      dateYmd: "2026-08-01",
    });
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]?.label).toBe("00:30");
    expect(options[0]?.value).toBe("2026-08-01T00:30:00+09:00");
  });

  it("dateYmd が JST 当日と一致しないと候補なし", () => {
    const options = buildReopenUntilOptions({
      now: new Date("2026-07-31T15:00:00Z"),
      dateYmd: "2026-07-31",
    });
    expect(options).toEqual([]);
  });

  it("ブラウザローカル日付と JST 当日がずれても parentHome.date 基準で候補を返す", () => {
    const options = buildReopenUntilOptions({
      now: new Date("2026-07-31T22:00:00+09:00"),
      dateYmd: "2026-07-31",
    });
    expect(options.map((opt) => opt.label)).toEqual(["22:30", "23:00", "23:30"]);
  });
});
