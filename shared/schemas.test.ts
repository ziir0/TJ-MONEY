import { describe, expect, it } from "vitest";
import { createTradeSchema } from "./schemas";

describe("createTradeSchema", () => {
  const validTrade = {
    symbol: "AAPL",
    direction: "long" as const,
    entryPrice: "100",
    exitPrice: "110",
    quantity: "2",
    fees: "1",
    pnl: "19",
    tradeDate: "2026-08-10T09:30",
  };

  it("accepts valid numeric trade values and converts dates", () => {
    const result = createTradeSchema.safeParse(validTrade);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tradeDate).toBeInstanceOf(Date);
      expect(result.data.quantity).toBe("2");
    }
  });

  it("rejects empty and invalid numeric fields", () => {
    const result = createTradeSchema.safeParse({
      ...validTrade,
      entryPrice: "",
      quantity: "0",
      pnl: "not-a-number",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("rejects an invalid direction and an invalid trade date", () => {
    const result = createTradeSchema.safeParse({
      ...validTrade,
      direction: "sideways",
      tradeDate: "not-a-date",
    });

    expect(result.success).toBe(false);
  });
});
