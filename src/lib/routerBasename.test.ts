/**
 * @file routerBasename 単体テスト
 */
import { describe, expect, it } from "vitest";
import { resolveRouterBasename } from "@/lib/routerBasename";

describe("resolveRouterBasename", () => {
  it("ルート配信時は undefined を返す", () => {
    expect(resolveRouterBasename("/")).toBeUndefined();
  });

  it("repository Pages の BASE_URL から basename を導出する", () => {
    expect(resolveRouterBasename("/quest-time-coupon-web/")).toBe(
      "/quest-time-coupon-web",
    );
  });
});
