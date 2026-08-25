/**
 * @file pointExchangeCatalog の単体テスト
 */
import { describe, expect, it } from "vitest";
import {
  POINT_EXCHANGE_CATALOG,
  calcExchangeTotals,
  findCatalogItem,
} from "./pointExchangeCatalog";

describe("POINT_EXCHANGE_CATALOG", () => {
  it("固定5種を契約 §3.11.1 どおりに定義する", () => {
    expect(POINT_EXCHANGE_CATALOG.map((i) => i.catalogItemId)).toEqual([
      "snack-10",
      "switch-30",
      "switch-60",
      "cash-100",
      "penalty-ticket-100",
    ]);
    expect(findCatalogItem("switch-60")?.pointCost).toBe(100);
    expect(findCatalogItem("switch-60")?.effects.addedSwitchMinutes).toBe(60);
    expect(findCatalogItem("penalty-ticket-100")?.effects.consumedPenaltyTickets).toBe(1);
  });

  it("未知の ID は undefined", () => {
    expect(findCatalogItem("unknown")).toBeUndefined();
  });
});

describe("calcExchangeTotals", () => {
  it("複数種類・複数枚の合計を算出する", () => {
    const result = calcExchangeTotals([
      { catalogItemId: "cash-100", quantity: 5 },
      { catalogItemId: "switch-30", quantity: 1 },
    ]);
    expect(result.totalPoints).toBe(550);
    expect(result.addedSwitchMinutes).toBe(30);
    expect(result.consumedPenaltyTickets).toBe(0);
    expect(result.lineItems).toEqual([
      { catalogItemId: "cash-100", label: "100円", quantity: 5, pointCost: 100, subtotalPoints: 500 },
      { catalogItemId: "switch-30", label: "Switch 30分", quantity: 1, pointCost: 50, subtotalPoints: 50 },
    ]);
  });

  it("quantity 0 の項目は結果から除外する", () => {
    const result = calcExchangeTotals([
      { catalogItemId: "cash-100", quantity: 0 },
      { catalogItemId: "snack-10", quantity: 2 },
    ]);
    expect(result.lineItems).toHaveLength(1);
    expect(result.totalPoints).toBe(20);
  });

  it("penalty-ticket-100 は consumedPenaltyTickets を加算する", () => {
    const result = calcExchangeTotals([
      { catalogItemId: "penalty-ticket-100", quantity: 2 },
    ]);
    expect(result.totalPoints).toBe(200);
    expect(result.consumedPenaltyTickets).toBe(2);
  });

  it("未知の catalogItemId は例外", () => {
    expect(() =>
      calcExchangeTotals([{ catalogItemId: "unknown", quantity: 1 }]),
    ).toThrow();
  });

  it("quantity が負・小数は例外", () => {
    expect(() =>
      calcExchangeTotals([{ catalogItemId: "snack-10", quantity: -1 }]),
    ).toThrow();
    expect(() =>
      calcExchangeTotals([{ catalogItemId: "snack-10", quantity: 1.5 }]),
    ).toThrow();
  });
});
