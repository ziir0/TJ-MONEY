// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Calendar from "./Calendar";
import { GlobalToolbarProvider } from "@/contexts/GlobalToolbarContext";
import GlobalTradeControls from "@/components/GlobalTradeControls";

const mocks = vi.hoisted(() => ({
  trades: [{
    id: 1,
    broker: "Bybit",
    symbol: "BTCUSD",
    direction: "long",
    assetType: "crypto",
    quantityUnit: "coins",
    entryPrice: "100",
    exitPrice: "110",
    quantity: "1",
    fees: "0",
    pnl: "10",
    tradeDate: "2026-10-02T09:00:00.000Z",
    exitDate: "2026-10-02T10:00:00.000Z",
    notes: "October trade",
    isInvoluntary: false,
    screenshot1: "users/1/trades/btc.png",
  }, {
    id: 2,
    broker: "Bybit",
    symbol: "ETHUSD",
    direction: "short",
    assetType: "crypto",
    quantityUnit: "coins",
    entryPrice: "100",
    exitPrice: "125",
    quantity: "1",
    fees: "0",
    pnl: "25",
    tradeDate: "2026-10-02T11:00:00.000Z",
    exitDate: "2026-10-02T12:00:00.000Z",
    notes: "Involuntary trade",
    isInvoluntary: true,
  }],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: { activeBroker: { useQuery: () => ({ data: "Bybit" }) } },
    trades: {
      list: { useQuery: () => ({ data: mocks.trades, isLoading: false }) },
      screenshotUrls: {
        useQuery: ({ keys }: { keys: string[] }) => ({
          data: Object.fromEntries(keys.map((key) => [key, `https://storage.test/${key.split("/").pop()}`])),
        }),
      },
      delete: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    useUtils: () => ({
      trades: { list: { invalidate: vi.fn() } },
      stats: { calculate: { invalidate: vi.fn() } },
    }),
  },
}));

vi.mock("@/components/TradeEntryForm", () => ({
  default: () => <button type="button">Edit trade</button>,
}));

describe("responsive Trading Calendar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T12:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const renderCalendar = () => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    return render(
      <GlobalToolbarProvider>
        <GlobalTradeControls />
        <Calendar embedded />
      </GlobalToolbarProvider>,
    );
  };

  it("keeps each London calendar date unique across the daylight-saving transition", () => {
    const { container } = renderCalendar();
    const dayButtons = Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-label^='2026-']"));
    const dateKeys = dayButtons.map((button) => button.getAttribute("aria-label")?.split(",")[0]);

    expect(dayButtons).toHaveLength(35);
    expect(new Set(dateKeys).size).toBe(dateKeys.length);
    expect(screen.getAllByRole("button", { name: /^2026-10-25,/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^2026-10-26,/ })).toHaveLength(1);
  });

  it("provides a compact card layout and a full table for the selected day", () => {
    const { container } = renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: /^2026-10-02,/ }));

    expect(container.querySelector(".xl\\:hidden article")).toBeTruthy();
    expect(container.querySelector("article > .grid-cols-4")?.children).toHaveLength(4);
    expect(container.querySelector(".xl\\:block table")).toBeTruthy();
    expect(screen.getByText("02/10/2026")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Preview note for BTCUSD" })[0]);
    expect(screen.getByText("October trade")).toBeTruthy();
  });

  it("shows a chart action between Note and Actions and opens its screenshot", () => {
    const { container } = renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: /^2026-10-02,/ }));

    const tableHeaders = Array.from(container.querySelectorAll(".xl\\:block thead th"))
      .map((header) => header.textContent?.trim());
    expect(tableHeaders).toEqual(["Time", "Symbol", "Asset", "Direction", "Entry", "Exit", "Qty", "Fees", "P&L", "Note", "Chart", "Actions"]);

    fireEvent.click(screen.getAllByRole("button", { name: "View screenshot for BTCUSD" })[1]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByAltText("Execution chart capture")).toBeTruthy();
  });

  it("recalculates calendar statistics when involuntary trades are excluded", () => {
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: /^2026-10-02,/ }));

    expect(screen.getByText("2 trades · 2 wins · 0 losses")).toBeTruthy();
    expect(screen.getAllByText("$35.00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Open trade filters" }));
    fireEvent.click(screen.getByRole("switch", { name: "Include involuntary trades" }));
    expect(screen.getByText("1 trades · 1 wins · 0 losses")).toBeTruthy();
    expect(screen.getAllByText("$10.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ETHUSD").length).toBeGreaterThan(0);
  });
});