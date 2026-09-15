import { describe, expect, it } from "vitest";
import { parseTradeCsv } from "./tradeImport";

describe("parseTradeCsv", () => {
  it("parses valid rows, quoted notes, and optional exit dates", () => {
    const csv = [
      "symbol,direction,entryPrice,exitPrice,quantity,fees,pnl,tradeDate,exitDate,notes",
      'AAPL,long,100,110,2,1,19,2026-08-10T09:30,2026-08-10T10:15,"breakout, held with patience"',
    ].join("\n");

    const result = parseTradeCsv(csv);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      symbol: "AAPL",
      direction: "long",
      entryPrice: "100",
      exitPrice: "110",
      quantity: "2",
      fees: "1",
      pnl: "19",
      notes: "breakout, held with patience",
    });
    expect(result.rows[0]?.tradeDate).toBeInstanceOf(Date);
    expect(result.rows[0]?.exitDate).toBeInstanceOf(Date);
  });

  it("returns row-level validation errors without dropping valid rows", () => {
    const csv = [
      "symbol,direction,entryPrice,exitPrice,quantity,fees,pnl,tradeDate",
      "MSFT,long,400,410,1,0,10,2026-08-10",
      "TSLA,sideways,not-a-number,200,0,0,,not-a-date",
    ].join("\n");

    const result = parseTradeCsv(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.symbol).toBe("MSFT");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.row).toBe(3);
  });

  it("rejects a CSV without data rows", () => {
    expect(() => parseTradeCsv("symbol,direction,pnl")).toThrow(
      "CSV must include a header row and at least one trade row",
    );
  });
});
