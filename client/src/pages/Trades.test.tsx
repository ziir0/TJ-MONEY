// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Trades from "./Trades";

const mockTrades = [
  {
    id: 1,
    broker: "Bybit",
    symbol: "BTCUSD",
    direction: "long",
    assetType: "crypto",
    quantityUnit: "coins",
    entryPrice: "65000",
    exitPrice: "67000",
    quantity: "0.5",
    fees: "5",
    pnl: "995",
    tradeDate: "2026-10-02T10:00:00.000Z",
    exitDate: "2026-10-02T12:00:00.000Z",
    notes: "Breakout setup on 4H",
    isInvoluntary: false,
  },
  {
    id: 2,
    broker: "Bybit",
    symbol: "ETHUSD",
    direction: "short",
    assetType: "crypto",
    quantityUnit: "coins",
    entryPrice: "3400",
    exitPrice: "3500",
    quantity: "2",
    fees: "4",
    pnl: "-204",
    tradeDate: "2026-10-01T14:30:00.000Z",
    exitDate: "2026-10-01T15:00:00.000Z",
    notes: "Slippage on market stop",
    isInvoluntary: false,
  },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: { activeBroker: { useQuery: () => ({ data: "Bybit" }) } },
    trades: {
      list: { useQuery: () => ({ data: mockTrades, isLoading: false }) },
      screenshotUrls: { useQuery: () => ({ data: {}, isLoading: false }) },
      delete: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    useUtils: () => ({
      trades: { list: { invalidate: vi.fn() } },
      stats: { calculate: { invalidate: vi.fn() } },
    }),
  },
}));

vi.mock("@/components/CSVImport", () => ({
  default: () => <button type="button">Import CSV</button>,
}));

vi.mock("@/components/TradeExport", () => ({
  default: () => <button type="button">Export CSV</button>,
}));

vi.mock("@/components/TradeEntryForm", () => ({
  default: ({ trade }: { trade?: any }) => (
    <button type="button">{trade ? "Edit trade" : "+ New Trade"}</button>
  ),
}));

describe("Trades Log page", () => {
  afterEach(() => cleanup());

  it("renders metrics summary and both trades in the table", () => {
    render(<Trades />);

    expect(screen.getByRole("heading", { name: "Trades Log" })).toBeTruthy();
    expect(screen.getByText("Filtered P&L")).toBeTruthy();
    expect(screen.getByText("Win Rate")).toBeTruthy();

    // Table rows & mobile cards
    expect(screen.getAllByText("BTCUSD")).toHaveLength(2);
    expect(screen.getAllByText("ETHUSD")).toHaveLength(2);
    expect(screen.getAllByText("$995.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("-$204.00").length).toBeGreaterThanOrEqual(1);
  });

  it("filters trades by live search input", () => {
    render(<Trades />);

    const searchInput = screen.getByPlaceholderText(/Search symbol/i);
    fireEvent.change(searchInput, { target: { value: "BTC" } });

    expect(screen.getAllByText("BTCUSD")).toHaveLength(2);
    expect(screen.queryByText("ETHUSD")).toBeNull();
  });
});
