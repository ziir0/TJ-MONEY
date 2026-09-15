// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TradeExport from "./TradeExport";

const mocks = vi.hoisted(() => ({
  buildTradesCsv: vi.fn(() => "trade-csv"),
  buildPerformanceSummaryCsv: vi.fn(() => "summary-csv"),
  downloadCsv: vi.fn(),
  summarizeTrades: vi.fn(() => ({
    totalPnl: 10,
    tradeCount: 1,
    winCount: 1,
    lossCount: 0,
    breakevenCount: 0,
    winRate: 100,
    averageWin: 10,
    averageLoss: 0,
    profitFactor: Infinity,
    totalFees: 0,
  })),
}));

vi.mock("@/lib/tradingAnalytics", () => ({
  buildTradesCsv: mocks.buildTradesCsv,
  buildPerformanceSummaryCsv: mocks.buildPerformanceSummaryCsv,
  downloadCsv: mocks.downloadCsv,
  summarizeTrades: mocks.summarizeTrades,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

const filteredTrade = {
  id: 1,
  symbol: "AAPL",
  direction: "long" as const,
  entryPrice: "100",
  exitPrice: "110",
  quantity: "1",
  fees: "0",
  pnl: "10",
  tradeDate: new Date("2026-08-10T09:30:00.000Z"),
};

describe("TradeExport", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.buildTradesCsv.mockClear();
    mocks.buildPerformanceSummaryCsv.mockClear();
    mocks.downloadCsv.mockClear();
    mocks.summarizeTrades.mockClear();
  });

  it("exports filtered trades and their performance summary", () => {
    render(<TradeExport trades={[filteredTrade]} />);

    fireEvent.click(screen.getByRole("button", { name: /export 1 filtered trades/i }));
    fireEvent.click(screen.getByRole("button", { name: /export filtered performance summary/i }));

    expect(mocks.buildTradesCsv).toHaveBeenCalledWith([filteredTrade]);
    expect(mocks.summarizeTrades).toHaveBeenCalledWith([filteredTrade]);
    expect(mocks.buildPerformanceSummaryCsv).toHaveBeenCalled();
    expect(mocks.downloadCsv).toHaveBeenCalledTimes(2);
  });

  it("disables exports when there are no filtered trades", () => {
    render(<TradeExport trades={[]} />);

    expect((screen.getByRole("button", { name: /export 0 filtered trades/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /export filtered performance summary/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
