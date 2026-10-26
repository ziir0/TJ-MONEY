// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Analytics from "./Analytics";
import { GlobalToolbarProvider } from "@/contexts/GlobalToolbarContext";
import GlobalDateNavigator from "@/components/GlobalDateNavigator";

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
      tradeDate: "2026-10-03T09:00:00.000Z",
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
      tradeDate: "2026-10-03T09:00:00.000Z",
      screenshot1: "users/1/trades/loss.png",
      screenshot2: null,
    },
    {
      id: 4,
      broker: "Bybit",
      symbol: "SOLUSD",
      direction: "long",
      entryPrice: "140",
      exitPrice: "150",
      quantity: "1",
      pnl: "10",
      tradeDate: "2026-10-02T09:00:00.000Z",
      screenshot1: "users/1/trades/sol.png",
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
  const setGlobalDate = (date: string, period = "today") => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    window.localStorage.setItem("global-trading-date", date);
    window.localStorage.setItem("global-trading-period", period);
  };

  const renderAnalytics = (date = "2026-10-03") => {
    setGlobalDate(date);
    return render(
      <GlobalToolbarProvider>
        <GlobalDateNavigator />
        <Analytics />
      </GlobalToolbarProvider>,
    );
  };

  afterEach(() => {
    cleanup();
    mocks.selectedBroker = "Bybit";
  });

  it("separates wins and losses and opens a screenshot preview", async () => {
    renderAnalytics();

    expect(screen.getByRole("tab", { name: "Wins (1)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Losses (1)" })).toBeTruthy();
    const thumbnail = screen.getByRole("img", { name: "BTCUSD winning trade screenshot 1" });
    expect(thumbnail.getAttribute("src")).toContain("/thumbnail/");
    expect(screen.queryByRole("img", { name: "BTCUSD winning trade screenshot 2" })).toBeNull();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next screenshot for BTCUSD" }));
    expect(screen.getByRole("img", { name: "BTCUSD winning trade screenshot 2" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: "BTCUSD winning trade screenshot 1" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Previous screenshot for BTCUSD" }));
    expect(screen.getByRole("img", { name: "BTCUSD winning trade screenshot 1" })).toBeTruthy();

    const lossesTab = screen.getByRole("tab", { name: "Losses (1)" });
    fireEvent.pointerDown(lossesTab, { button: 0, pointerType: "mouse" });
    fireEvent.click(lossesTab);
    const lossImage = await screen.findByRole("img", { name: "ETHUSD losing trade screenshot 1" });
    expect(lossImage).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View ETHUSD losing trade screenshot 1" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img", { name: "ETHUSD losing trade screenshot 1" }).getAttribute("src")).toContain("/original/");
    expect(within(dialog).getByText("100%")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Zoom in" }));
    expect(within(dialog).getByText("125%")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reset zoom" }));
    expect(within(dialog).getByText("100%")).toBeTruthy();
  });

  it("recalculates Performance Metrics when the selected broker changes", () => {
    const { rerender } = renderAnalytics();
    const getMetricsValues = () => {
      const card = screen.getByText("Performance Metrics").closest("[data-slot='card']") as HTMLElement;
      const content = card.querySelector("[data-slot='card-content']") as HTMLElement;
      return Array.from(content.querySelectorAll("span.font-semibold"), (value) => value.textContent);
    };

    expect(getMetricsValues()).toEqual(["2", "1", "1", "$10.00", "-$10.00"]);

    mocks.selectedBroker = "Pepperstone";
    rerender(
      <GlobalToolbarProvider>
        <GlobalDateNavigator />
        <Analytics />
      </GlobalToolbarProvider>,
    );

    expect(getMetricsValues()).toEqual(["1", "1", "0", "$20.00", "$0.00"]);
  });

  it("filters analytics metrics and screenshot galleries by the globally selected day", () => {
    renderAnalytics();

    fireEvent.change(screen.getByLabelText("Selected trading date"), { target: { value: "2026-10-02" } });

    expect(screen.getByRole("tab", { name: "Wins (1)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Losses (0)" })).toBeTruthy();
    expect(screen.getByText("Trades in Period").parentElement?.parentElement?.textContent).toContain("1");
    expect(screen.queryByRole("img", { name: "BTCUSD winning trade screenshot 1" })).toBeNull();
    expect(screen.getByRole("img", { name: "SOLUSD winning trade screenshot 1" })).toBeTruthy();
  });

  it("offers an all-time range in analytics", async () => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: () => false,
    });
    renderAnalytics();
    const rangeSelect = screen.getByRole("combobox", { name: "Select date range" });
    fireEvent.pointerDown(rangeSelect, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(rangeSelect, { button: 0, pointerType: "mouse" });
    fireEvent.click(rangeSelect);
    const allTimeOption = await screen.findByRole("option", { name: "All Time" });
    fireEvent.pointerMove(allTimeOption, { pointerType: "mouse" });
    fireEvent.pointerUp(allTimeOption, { pointerType: "mouse" });

    expect(screen.getByText("Trades in Period").parentElement?.parentElement?.textContent).toContain("3");
    expect(screen.getByRole("tab", { name: "Wins (2)" })).toBeTruthy();
  });

  it("uses two-column KPI, impact, and screenshot grids on narrow screens", () => {
    const { container } = renderAnalytics();

    expect(container.querySelectorAll('[class~="grid-cols-2"][class~="lg:grid-cols-3"]')).toHaveLength(3);
  });
});