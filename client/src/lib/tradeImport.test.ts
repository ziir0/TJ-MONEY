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

  it("groups TradingView list-of-trades rows and preserves timestamps", () => {
    const csv = [
      "Trade #,Type,Signal,Symbol,Date and time,Price,Contracts,Profit,Profit %",
      "1,Entry long,Buy,SOLUSD,2026-09-17 10:15:00,100.25,2,,,",
      "1,Exit long,Sell,SOLUSD,2026-09-17 11:45:30,101.75,2,3.00,1.49%",
    ].join("\n");

    const result = parseTradeCsv(csv);

    expect(result.source).toBe("tradingview");
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      symbol: "SOLUSD",
      direction: "long",
      entryPrice: "100.25",
      exitPrice: "101.75",
      quantity: "2",
      pnl: "3",
    });
    expect(result.rows[0]?.tradeDate).toEqual(new Date("2026-09-17T10:15:00"));
    expect(result.rows[0]?.exitDate).toEqual(new Date("2026-09-17T11:45:30"));
  });

  it("requests a symbol override when TradingView omits the symbol", () => {
    const csv = [
      "Trade #,Type,Signal,Date and time,Price,Contracts,Profit",
      "1,Entry short,Sell,2026-09-17 10:15:00,100.25,2,,",
      "1,Exit short,Buy,2026-09-17 11:45:30,99.25,2,2.00",
    ].join("\n");

    const missing = parseTradeCsv(csv);
    expect(missing.requiresSymbol).toBe(true);
    expect(missing.rows).toHaveLength(0);

    const completed = parseTradeCsv(csv, { symbolOverride: "SOLUSD" });
    expect(completed.requiresSymbol).toBe(false);
    expect(completed.errors).toEqual([]);
    expect(completed.rows[0]).toMatchObject({ symbol: "SOLUSD", direction: "short" });
  });

  it("converts Pepperstone entry and executed stop rows into one trade", () => {
    const csv = [
      "Símbolo,Lado,Tipo,Qtde,Qtd. Preenchida,Preço Méd de Preenchimento,Status,Tempo de atualização,Profit,Commission,ID da ordem",
      "USDCAD,Comprar,Mercado,0.02,0.02,1.40911,Executado,2026-09-23 13:44:24,,,390554357",
      "USDCAD,Vender,Stop Loss,0.02,0.02,1.40873,Executado,2026-09-23 13:52:32,-0.68,-0.14,390554482",
      "USDCAD,Vender,Stop Loss,0.02,0.02,1.40873,Executado,2026-09-23 13:52:32,-0.68,-0.14,SL:390554482",
      "USDCAD,Vender,Realização de Lucro,0.02,0,1.40873,Cancelado,2026-09-23 13:52:32,,,TP:390554482",
    ].join("\n");

    const result = parseTradeCsv(csv);

    expect(result.source).toBe("pepperstone");
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      symbol: "USDCAD",
      direction: "long",
      entryPrice: "1.40911",
      exitPrice: "1.40873",
      quantity: "0.02",
      fees: "0.14",
      pnl: "-0.68",
    });
    expect(result.rows[0]?.tradeDate).toEqual(new Date("2026-09-23T13:44:24"));
    expect(result.rows[0]?.exitDate).toEqual(new Date("2026-09-23T13:52:32"));
    expect(result.warnings[0]).toContain("duplicate");
  });
});
