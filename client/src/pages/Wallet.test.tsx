// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Wallet from "./Wallet";
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
      pnl: "50",
      tradeDate: "2026-10-02T09:00:00.000Z",
    },
  ],
  movements: [
    { id: 1, broker: "Bybit", kind: "deposit", amount: "1000", date: "2026-10-01T00:00:00.000Z", note: "Seed capital" },
    { id: 2, broker: "Bybit", kind: "withdrawal", amount: "200", date: "2026-10-03T00:00:00.000Z", note: "Profit withdrawal" },
  ],
  accountSettings: {
    broker: "Bybit",
    startingBalance: "500",
    startingBalanceDate: "2026-09-01T00:00:00.000Z",
  },
  mutateAddMovement: vi.fn(),
  mutateDeleteMovement: vi.fn(),
  mutateSaveSettings: vi.fn(),
  mutateSaveActiveBroker: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      account: {
        activeBroker: { setData: vi.fn() },
        invalidate: vi.fn(),
        movements: { invalidate: vi.fn() },
        settings: { invalidate: vi.fn() },
        allSettings: { invalidate: vi.fn() },
      },
      trades: { invalidate: vi.fn() },
    }),
    trades: {
      list: { useQuery: () => ({ data: mocks.trades, isLoading: false }) },
    },
    account: {
      activeBroker: {
        useQuery: () => ({ data: "Bybit", isLoading: false }),
      },
      enabledBrokers: {
        useQuery: () => ({ data: ["Bybit", "Pepperstone"], isLoading: false }),
      },
      saveActiveBroker: {
        useMutation: () => ({ mutate: mocks.mutateSaveActiveBroker }),
      },
      movements: {
        useQuery: () => ({ data: mocks.movements, isLoading: false, refetch: vi.fn() }),
      },
      addMovement: {
        useMutation: () => ({ mutate: mocks.mutateAddMovement, isPending: false }),
      },
      deleteMovement: {
        useMutation: () => ({ mutate: mocks.mutateDeleteMovement, isPending: false }),
      },
      settings: {
        useQuery: () => ({ data: mocks.accountSettings, isLoading: false, refetch: vi.fn() }),
      },
      allSettings: {
        useQuery: () => ({ data: [mocks.accountSettings], isLoading: false, refetch: vi.fn() }),
      },
      saveSettings: {
        useMutation: () => ({ mutate: mocks.mutateSaveSettings, isPending: false }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Wallet Page", () => {
  const renderWallet = () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T12:00:00.000Z"));
    const values = new Map<string, string>([
      ["global-trading-date", "2026-10-16"],
      ["global-trading-period", "thisMonth"],
    ]);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    return render(
      <GlobalToolbarProvider>
        <GlobalDateNavigator />
        <Wallet />
      </GlobalToolbarProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders Wallet header and capital KPI cards", () => {
    renderWallet();

    expect(screen.getByRole("heading", { name: /Wallet & Capital/i })).toBeDefined();
    expect(screen.getByText("Net Liquidity")).toBeDefined();
    expect(screen.getByText("Total Deposits")).toBeDefined();
    expect(screen.getByText("Total Withdrawals")).toBeDefined();
    expect(screen.getByText("Net Inflow")).toBeDefined();
    expect(screen.getAllByText("Starting Capital").length).toBeGreaterThanOrEqual(1);

    // Verify deposits and withdrawals rendered
    expect(screen.getAllByText("$1,000.00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$200.00").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the cash movement history table with records", () => {
    renderWallet();

    expect(screen.getByText("Cash Movement History")).toBeDefined();
    expect(screen.getByText("Seed capital")).toBeDefined();
    expect(screen.getByText("Profit withdrawal")).toBeDefined();
  });

  it("opens Deposit dialog when Deposit button is clicked", () => {
    renderWallet();

    const depositButton = screen.getByRole("button", { name: /^Deposit$/i });
    fireEvent.click(depositButton);

    expect(screen.getByRole("heading", { name: "Record Deposit" })).toBeDefined();
    expect(screen.getByLabelText(/Amount \(\$\)/i)).toBeDefined();
  });

  it("opens Withdrawal dialog when Withdraw button is clicked", () => {
    renderWallet();

    const withdrawButton = screen.getByRole("button", { name: /^Withdraw$/i });
    fireEvent.click(withdrawButton);

    expect(screen.getByRole("heading", { name: "Record Withdrawal" })).toBeDefined();
  });

  it("filters cash movements by type when clicking tabs", () => {
    renderWallet();

    // Click "Withdrawals" tab
    const withdrawalsTab = screen.getByRole("button", { name: "Withdrawals" });
    fireEvent.click(withdrawalsTab);

    // Only withdrawal should be shown
    expect(screen.queryByText("Seed capital")).toBeNull();
    expect(screen.getByText("Profit withdrawal")).toBeDefined();

    // Click "Deposits" tab
    const depositsTab = screen.getByRole("button", { name: "Deposits" });
    fireEvent.click(depositsTab);

    expect(screen.getByText("Seed capital")).toBeDefined();
    expect(screen.queryByText("Profit withdrawal")).toBeNull();
  });

  it("filters movement KPIs and history by the global date range", () => {
    renderWallet();
    fireEvent.change(screen.getByLabelText("Selected trading date"), {
      target: { value: "2026-10-01" },
    });

    expect(screen.getByText("Seed capital")).toBeDefined();
    expect(screen.queryByText("Profit withdrawal")).toBeNull();
    expect(
      screen.getByText("Total Withdrawals").parentElement?.parentElement?.textContent,
    ).toContain("0 transactions");
  });

  it("opens Starting Capital dialog when Edit button is clicked", () => {
    renderWallet();

    const editBtn = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(editBtn);

    expect(screen.getByRole("heading", { name: "Configure Starting Capital" })).toBeDefined();
    expect(screen.getByLabelText(/Starting Capital \(\$\)/i)).toBeDefined();

    const saveBtn = screen.getByRole("button", { name: "Save Baseline" });
    fireEvent.click(saveBtn);

    expect(mocks.mutateSaveSettings).toHaveBeenCalled();
  });
});
