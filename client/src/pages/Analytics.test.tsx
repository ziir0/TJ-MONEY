// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Analytics from "./Analytics";

const mocks = vi.hoisted(() => ({
  selectedBroker: "Bybit",
  trades: [
    {
      id: 1,
      broker: "Bybit",
      symbol: "BTCUSD",
      direction: "long",
      entryPrice: "100",
      exitPrice: "110",
      quantity: "1",
      pnl: "10",
      tradeDate: "2026-10-01T09:00:00.000Z",
      screenshot1: "users/1/trades/win.png",
      screenshot2: "users/1/trades/win-2.png",
    },
    {
      id: 2,
      broker: "Bybit",
      symbol: "ETHUSD",
      direction: "short",
      entryPrice: "100",
      exitPrice: "110",
      quantity: "1",
      pnl: "-10",
      tradeDate: "2026-10-02T09:00:00.000Z",
      screenshot1: "users/1/trades/loss.png",
      screenshot2: null,
    },
    {
      id: 3,
      broker: "Pepperstone",
      symbol: "EURUSD",
      direction: "long",
      entryPrice: "1.1",
      exitPrice: "1.12",
      quantity: "1",
      pnl: "20",
      tradeDate: "2026-10-03T09:00:00.000Z",
      screenshot1: null,
      screenshot2: null,
    },
  ],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    trades: {
      list: { useQuery: () => ({ data: mocks.trades, isLoading: false }) },
      screenshotUrls: {
        useQuery: ({ keys, variant }: { keys: string[]; variant: string }) => ({
          data: Object.fromEntries(keys.map((key) => [key, `https://storage.test/${variant}/${key.split("/").pop()}`])),
          isLoading: false,
          isError: false,
        }),
      },
    },
    account: {
      activeBroker: { useQuery: () => ({ data: mocks.selectedBroker }) },
      movements: { useQuery: () => ({ data: [], isLoading: false }) },
    },
  },
}));

vi.mock("recharts", () => {
  const MockChart = ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>;
  return {
    AreaChart: MockChart,
    Area: MockChart,
    LineChart: MockChart,
    Line: MockChart,
    BarChart: MockChart,
    Bar: MockChart,
    PieChart: MockChart,
    Pie: MockChart,
    Cell: MockChart,
    XAxis: MockChart,
    YAxis: MockChart,
    CartesianGrid: MockChart,
    Tooltip: MockChart,
    Legend: MockChart,
    ResponsiveContainer: MockChart,
  };
});

describe("Analytics screenshot galleries", () => {
  afterEach(() => {
    cleanup();
    mocks.selectedBroker = "Bybit";
  });

  it("separates wins and losses and opens a screenshot preview", async () => {
    render(<Analytics />);

    expect(screen.getByRole("tab", { name: "Wins (1)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Losses (1)" })).toBeTruthy();
    const thumbnail = screen.getByRole("img", { name: "BTCUSD winning trade screenshot 1" });
    expect(thumbnail.getAttribute("src")).toContain("/thumbnail/");
    expect(screen.getByRole("img", { name: "BTCUSD winning trade screenshot 2" })).toBeTruthy();

    const lossesTab = screen.getByRole("tab", { name: "Losses (1)" });
    fireEvent.pointerDown(lossesTab, { button: 0, pointerType: "mouse" });
    fireEvent.click(lossesTab);
    const lossImage = await screen.findByRole("img", { name: "ETHUSD losing trade screenshot 1" });
    expect(lossImage).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View ETHUSD losing trade screenshot 1" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img", { name: "ETHUSD losing trade screenshot 1" }).getAttribute("src")).toContain("/original/");
  });

  it("recalculates Performance Metrics when the selected broker changes", () => {
    const { rerender } = render(<Analytics />);
    const getMetricsValues = () => {
      const card = screen.getByText("Performance Metrics").closest("[data-slot='card']") as HTMLElement;
      const content = card.querySelector("[data-slot='card-content']") as HTMLElement;
      return Array.from(content.querySelectorAll("span.font-semibold"), (value) => value.textContent);
    };

    expect(getMetricsValues()).toEqual(["2", "1", "1", "$10.00", "-$10.00"]);

    mocks.selectedBroker = "Pepperstone";
    rerender(<Analytics />);

    expect(getMetricsValues()).toEqual(["1", "1", "0", "$20.00", "$0.00"]);
  });

  it("uses two-column KPI, impact, and screenshot grids on narrow screens", () => {
    const { container } = render(<Analytics />);

    expect(container.querySelectorAll('[class~="grid-cols-2"][class~="lg:grid-cols-3"]')).toHaveLength(3);
  });
});