// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Trades from "./Trades";
import { GlobalToolbarProvider } from "@/contexts/GlobalToolbarContext";
import GlobalDateNavigator from "@/components/GlobalDateNavigator";
import GlobalTradeControls from "@/components/GlobalTradeControls";

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
    screenshot1: "users/1/trades/btc.png",
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
    tradeDate: "2026-10-02T14:30:00.000Z",
    exitDate: "2026-10-02T15:00:00.000Z",
    notes: "Slippage on market stop",
    isInvoluntary: false,
  },
];

vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: { activeBroker: { useQuery: () => ({ data: "Bybit" }) } },
    trades: {
      list: { useQuery: () => ({ data: mockTrades, isLoading: false }) },
      screenshotUrls: {
        useQuery: ({ keys }: { keys: string[] }) => ({
          data: Object.fromEntries(keys.map((key) => [key, `https://storage.test/${key.split("/").pop()}`])),
          isLoading: false,
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
  const setGlobalDate = (date: string) => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    window.localStorage.setItem("global-trading-date", date);
    window.localStorage.setItem("global-trading-period", "today");
  };

  const renderTrades = () => {
    setGlobalDate("2026-10-02");
    return render(
      <GlobalToolbarProvider>
        <GlobalTradeControls active />
        <GlobalDateNavigator />
        <Trades />
      </GlobalToolbarProvider>,
    );
  };

  afterEach(() => cleanup());

  it("renders metrics summary and both trades in the table", () => {
    renderTrades();

    expect(screen.getByRole("heading", { name: "Trades Log" })).toBeTruthy();
    expect(screen.getByText("Filtered P&L")).toBeTruthy();
    expect(screen.getByText("Win Rate")).toBeTruthy();

    // Table rows & mobile cards
    expect(screen.getAllByText("BTCUSD")).toHaveLength(2);
    expect(screen.getAllByText("ETHUSD")).toHaveLength(2);
    expect(screen.getAllByText("$995.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("-$204.00").length).toBeGreaterThanOrEqual(1);
  });

  it("defaults to at most nine trades per page", () => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: () => false,
    });
    renderTrades();

    const pageSize = screen.getByText("Per page:").parentElement?.querySelector('[role="combobox"]');
    if (!pageSize) throw new Error("Page-size selector not found.");
    expect(pageSize.textContent).toContain("9");
    fireEvent.pointerDown(pageSize!, { button: 0, pointerType: "mouse" });
    fireEvent.pointerUp(pageSize!, { button: 0, pointerType: "mouse" });
    fireEvent.click(pageSize!);

    expect(screen.getByRole("option", { name: "5" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "9" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "10" })).toBeNull();
  });

  it("filters trades by live search input", () => {
    renderTrades();

    const searchInput = screen.getByPlaceholderText(/Search symbol/i);
    fireEvent.change(searchInput, { target: { value: "BTC" } });

    expect(screen.getAllByText("BTCUSD")).toHaveLength(2);
    expect(screen.queryByText("ETHUSD")).toBeNull();
  });

  it("zooms and resets the screenshot in the trade preview", () => {
    renderTrades();

    fireEvent.click(screen.getAllByRole("button", { name: "View screenshot for BTCUSD" })[0]!);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("img", { name: "Execution chart capture" })).toBeTruthy();
    expect(within(dialog).getByText("100%")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Zoom in" }));
    expect(within(dialog).getByText("125%")).toBeTruthy();
    expect(dialog.className).toContain("h-[90dvh]");
    expect(within(dialog).getByRole("img", { name: "Execution chart capture" }).getAttribute("style")).toContain("scale(1.25)");

    fireEvent.click(within(dialog).getByRole("button", { name: "Reset zoom" }));
    expect(within(dialog).getByText("100%")).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: "Zoom out" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses a two-finger pinch to zoom the screenshot without resizing the modal", () => {
    renderTrades();
    fireEvent.click(screen.getAllByRole("button", { name: "View screenshot for BTCUSD" })[0]!);

    const dialog = screen.getByRole("dialog");
    const originalDialogClass = dialog.className;
    const viewport = within(dialog).getByLabelText("Screenshot viewing area; pinch to zoom and drag to pan");

    fireEvent.pointerDown(viewport, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerDown(viewport, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 2, pointerType: "touch", clientX: 250, clientY: 100 });

    expect(within(dialog).getByText("150%")).toBeTruthy();
    expect(dialog.className).toBe(originalDialogClass);
  });

  it("toggles the screenshot zoom by 50 percent on each double-click", () => {
    renderTrades();
    fireEvent.click(screen.getAllByRole("button", { name: "View screenshot for BTCUSD" })[0]!);

    const dialog = screen.getByRole("dialog");
    const screenshot = within(dialog).getByRole("img", { name: "Execution chart capture" });

    fireEvent.doubleClick(screenshot.parentElement!);
    expect(within(dialog).getByText("150%")).toBeTruthy();

    fireEvent.doubleClick(screenshot.parentElement!);
    expect(within(dialog).getByText("100%")).toBeTruthy();
  });
});
