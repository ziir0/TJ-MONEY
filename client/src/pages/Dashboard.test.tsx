// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

const mocks = vi.hoisted(() => ({
  trades: [
    {
      id: 1,
      broker: "Bybit",
      symbol: "BTCUSD",
      direction: "long",
      entryPrice: "100",
      exitPrice: "110",
      quantity: "1",
      fees: "0",
      pnl: "10",
      tradeDate: "2026-10-02T09:00:00.000Z",
    },
    {
      id: 2,
      broker: "Bybit",
      symbol: "ETHUSD",
      direction: "short",
      entryPrice: "100",
      exitPrice: "95",
      quantity: "1",
      fees: "0",
      pnl: "5",
      tradeDate: "2026-10-01T09:00:00.000Z",
    },
  ],
  movements: [{ id: 1, broker: "Bybit", kind: "deposit", amount: "100", date: "2026-10-01T00:00:00.000Z" }],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    trades: { list: { useQuery: () => ({ data: mocks.trades, isLoading: false }) } },
    account: {
      activeBroker: { useQuery: () => ({ data: "Bybit", isLoading: false }) },
      settings: { useQuery: () => ({ data: { startingBalance: "0" }, isLoading: false }) },
      movements: { useQuery: () => ({ data: mocks.movements, isLoading: false }) },
    },
  },
}));

vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));

vi.mock("recharts", () => {
  const MockChart = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Area: () => null,
    AreaChart: ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>,
    CartesianGrid: () => null,
    Legend: () => null,
    Line: () => null,
    ResponsiveContainer: MockChart,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

describe("Dashboard trading overview", () => {
  afterEach(() => cleanup());

  it("shows nine KPIs, selectable balance ranges, and recent trades", () => {
    const { container } = render(<Dashboard />);

    expect(screen.getByText("Total P&L")).toBeTruthy();
    expect(screen.getByText("Win Rate")).toBeTruthy();
    expect(screen.getByText("Average Win/Loss")).toBeTruthy();
    expect(screen.getByText("Profit Factor")).toBeTruthy();
    expect(screen.getByText("Total Trades")).toBeTruthy();
    expect(screen.getByText("Current Balance")).toBeTruthy();
    expect(screen.getByText("Realized P&L")).toBeTruthy();
    expect(screen.getByText("Net Deposit")).toBeTruthy();
    expect(screen.getByText("Net Cash Flow")).toBeTruthy();

    const periodGroup = screen.getByRole("group", { name: "Balance chart period" });
    expect(within(periodGroup).getByRole("button", { name: "30D" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(periodGroup).getByRole("button", { name: "7D" })).toBeTruthy();
    expect(within(periodGroup).getByRole("button", { name: "90D" })).toBeTruthy();
    expect(screen.getByText("Recent Trades")).toBeTruthy();
    expect(screen.getByText("BTCUSD")).toBeTruthy();
    expect(screen.getByText("ETHUSD")).toBeTruthy();
    expect(container.querySelector(".grid-cols-2.xl\\:grid-cols-3")?.children).toHaveLength(9);
  });
});
