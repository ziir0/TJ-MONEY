import { describe, expect, it } from "vitest";
import {
  buildPerformanceSummaryCsv,
  buildTradesCsv,
  buildEquityCurve,
  calculateBrokerSummary,
  filterTradesByDateRange,
  filterTradesByBroker,
  summarizeTrades,
  type AnalyticsTrade,
} from "./tradingAnalytics";

const trades: AnalyticsTrade[] = [
  {
    id: 2,
    symbol: "MSFT",
    direction: "short",
    entryPrice: "200",
    exitPrice: "190",
    quantity: "1",
    fees: "1",
    pnl: "9",
    tradeDate: "2026-08-11T10:00:00.000Z",
    notes: "second trade, managed well",
  },
  {
    id: 1,
    symbol: "AAPL",
    direction: "long",
    entryPrice: "100",
    exitPrice: "95",
    quantity: "2",
    fees: "1",
    pnl: "-11",
    tradeDate: "2026-08-10T10:00:00.000Z",
  },
];

describe("trading analytics utilities", () => {
  it("sorts trades and accumulates the equity curve", () => {
    const curve = buildEquityCurve(trades);

    expect(curve.map((point) => point.tradeNumber)).toEqual([0, 1, 2]);
    expect(curve.map((point) => point.tradePnl)).toEqual([0, -11, 9]);
    expect(curve.map((point) => point.cumulativePnl)).toEqual([0, -11, -2]);
    expect(curve[0]).toMatchObject({ date: "2026-08-09", isBaseline: true });
  });

  it("aggregates daily, weekly, and monthly periods while keeping the zero baseline", () => {
    const periodTrades: AnalyticsTrade[] = [
      { ...trades[0]!, tradeDate: "2026-08-10T10:00:00.000Z", pnl: "9" },
      { ...trades[1]!, tradeDate: "2026-08-10T15:00:00.000Z", pnl: "-4" },
      { ...trades[0]!, tradeDate: "2026-08-17T10:00:00.000Z", pnl: "6" },
    ];

    expect(buildEquityCurve(periodTrades, "daily").map((point) => point.tradePnl)).toEqual([0, 5, 6]);
    expect(buildEquityCurve(periodTrades, "weekly").map((point) => point.tradePnl)).toEqual([0, 5, 6]);
    expect(buildEquityCurve(periodTrades, "monthly").map((point) => point.tradePnl)).toEqual([0, 11]);
  });

  it("calculates account balance and peak-to-trough drawdown from a starting balance", () => {
    const curve = buildEquityCurve([
      { ...trades[0]!, tradeDate: "2026-08-10T10:00:00.000Z", pnl: "-100" },
      { ...trades[1]!, tradeDate: "2026-08-11T10:00:00.000Z", pnl: "50" },
      { ...trades[0]!, tradeDate: "2026-08-12T10:00:00.000Z", pnl: "150" },
    ], "daily", 1000);

    expect(curve.map((point) => point.accountBalance)).toEqual([1000, 900, 950, 1100]);
    expect(curve.map((point) => point.drawdown)).toEqual([0, -100, -50, 0]);
    expect(curve[1]?.drawdownPercent).toBe(-10);
  });

  it("includes dated deposits and withdrawals in the account balance curve", () => {
    const curve = buildEquityCurve([
      { ...trades[0]!, tradeDate: "2026-10-01T10:00:00.000Z", pnl: "3" },
      { ...trades[1]!, tradeDate: "2026-10-02T10:00:00.000Z", pnl: "-1" },
    ], "daily", 0, [
      { broker: "Bybit", kind: "deposit", amount: 8, date: "2026-10-01T00:00:00.000Z" },
      { broker: "Bybit", kind: "withdrawal", amount: 2, date: "2026-10-02T00:00:00.000Z" },
    ]);

    expect(curve.map((point) => point.tradePnl)).toEqual([0, 3, -1]);
    expect(curve.map((point) => point.cumulativePnl)).toEqual([0, 3, 2]);
    expect(curve.map((point) => point.accountBalance)).toEqual([0, 11, 8]);
  });

  it("filters trades inclusively by custom start and end dates", () => {
    const filtered = filterTradesByDateRange(trades, "2026-08-10", "2026-08-10");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.symbol).toBe("AAPL");
    expect(filterTradesByDateRange(trades, "2026-08-12")).toHaveLength(0);
  });

  it("summarizes wins, losses, fees, and profit factor", () => {
    expect(summarizeTrades(trades)).toMatchObject({
      totalPnl: -2,
      tradeCount: 2,
      winCount: 1,
      lossCount: 1,
      winRate: 50,
      averageWin: 9,
      averageLoss: -11,
      profitFactor: 9 / 11,
      totalFees: 2,
    });
  });

  it("calculates the real broker balance from deposits, withdrawals, and P&L", () => {
    const brokerTrades: AnalyticsTrade[] = [
      { ...trades[0]!, broker: "Bybit", pnl: "-150", tradeDate: "2026-08-10T10:00:00.000Z" },
      { ...trades[1]!, broker: "Bybit", pnl: "120", tradeDate: "2026-08-11T10:00:00.000Z" },
      { ...trades[0]!, broker: "Pepperstone", pnl: "50", tradeDate: "2026-08-12T10:00:00.000Z" },
    ];

    const summary = calculateBrokerSummary({
      trades: brokerTrades,
      broker: "Bybit",
      startingBalance: 1000,
      movements: [
        { id: "dep-1", broker: "Bybit", kind: "deposit", amount: 500, date: "2026-08-01T00:00:00.000Z" },
        { id: "dep-2", broker: "Bybit", kind: "deposit", amount: 300, date: "2026-08-05T00:00:00.000Z" },
        { id: "wit-1", broker: "Bybit", kind: "withdrawal", amount: 200, date: "2026-08-06T00:00:00.000Z" },
      ],
    });

    expect(summary.totalDeposits).toBe(800);
    expect(summary.totalWithdrawals).toBe(200);
    expect(summary.realizedPnl).toBe(-30);
    expect(summary.currentBalance).toBe(1570);
  });

  it("aggregates every broker when All Brokers is selected", () => {
    const brokerTrades: AnalyticsTrade[] = [
      { ...trades[0]!, broker: "Bybit", pnl: "8" },
      { ...trades[1]!, broker: "Pepperstone", pnl: "-3" },
    ];
    const filteredTrades = filterTradesByBroker(brokerTrades, "All Brokers");
    const summary = calculateBrokerSummary({
      trades: filteredTrades,
      broker: "All Brokers",
      movements: [
        { broker: "Bybit", kind: "deposit", amount: 8 },
        { broker: "Pepperstone", kind: "withdrawal", amount: 2 },
      ],
    });

    expect(filteredTrades).toHaveLength(2);
    expect(summary).toMatchObject({ totalDeposits: 8, totalWithdrawals: 2, realizedPnl: 5, currentBalance: 11 });
  });

  it("serializes trade rows and summary metrics as escaped CSV", () => {
    const tradeCsv = buildTradesCsv(trades);
    const summaryCsv = buildPerformanceSummaryCsv(summarizeTrades(trades));

    expect(tradeCsv).toContain("Trade ID,Symbol,Direction");
    expect(tradeCsv).toContain('"second trade, managed well"');
    expect(tradeCsv).toContain("2026-08-11T10:00:00.000Z");
    expect(summaryCsv).toContain("Total P&L,-2.00");
    expect(summaryCsv).toContain("Win Rate,50.00%");
  });
});
