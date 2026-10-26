// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";
import { GlobalToolbarProvider } from "@/contexts/GlobalToolbarContext";
import GlobalDateNavigator from "@/components/GlobalDateNavigator";

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
      allSettings: { useQuery: () => ({ data: [], isLoading: false }) },
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
  const setGlobalDate = (date: string, period?: string) => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    window.localStorage.setItem("global-trading-date", date);
    if (period) window.localStorage.setItem("global-trading-period", period);
  };

  const renderDashboard = (period?: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"));
    setGlobalDate("2026-10-02", period);
    return render(
      <GlobalToolbarProvider>
        <GlobalDateNavigator />
        <Dashboard />
      </GlobalToolbarProvider>,
    );
  };

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("defaults to this month and shows its trades and KPIs", () => {
    const { container } = renderDashboard();

    expect(screen.getByText("Total P&L")).toBeTruthy();
    expect(screen.getByText("Win Rate")).toBeTruthy();
    expect(screen.getByText("Average Win/Loss")).toBeTruthy();
    expect(screen.getByText("Profit Factor")).toBeTruthy();
    expect(screen.getByText("Total Trades")).toBeTruthy();
    expect(screen.getByText("Period Net Result")).toBeTruthy();
    expect(screen.getByText("Trading Fees")).toBeTruthy();
    expect(screen.getByText("Deposits")).toBeTruthy();
    expect(screen.getByText("Net Cash Flow")).toBeTruthy();

    expect(screen.queryByRole("group", { name: "Trade date period" })).toBeNull();
    expect(screen.queryByLabelText("Filter by instrument")).toBeNull();
    expect(screen.getByText("Recent Trades")).toBeTruthy();
    expect(screen.getAllByText("BTCUSD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ETHUSD").length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: "Select date range" }).textContent).toContain("This Month");
    expect(screen.getByText("Total P&L").closest('[data-slot="card"]')?.className)
      .toBe(screen.getByText("Win Rate").closest('[data-slot="card"]')?.className);
  });

  it("updates the dashboard when the global date changes", () => {
    renderDashboard("today");
    fireEvent.change(screen.getByLabelText("Selected trading date"), { target: { value: "2026-10-01" } });

    expect(screen.getByText("Total P&L").parentElement?.parentElement?.textContent).toContain("$5.00");
    expect(screen.getByText("Total Trades").parentElement?.parentElement?.textContent).toContain("1");
    expect(screen.getByText("Period Net Result").parentElement?.parentElement?.textContent).toContain("$105.00");
    expect(screen.getAllByText("ETHUSD").length).toBeGreaterThan(0);
    expect(screen.queryByText("BTCUSD")).toBeNull();
  });
});
