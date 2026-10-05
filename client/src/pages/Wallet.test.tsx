// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Wallet from "./Wallet";

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
    trades: {
      list: { useQuery: () => ({ data: mocks.trades, isLoading: false }) },
    },
    account: {
      activeBroker: {
        useQuery: () => ({ data: "Bybit", isLoading: false }),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders Wallet header and capital KPI cards", () => {
    render(<Wallet />);

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
    render(<Wallet />);

    expect(screen.getByText("Cash Movement History")).toBeDefined();
    expect(screen.getByText("Seed capital")).toBeDefined();
    expect(screen.getByText("Profit withdrawal")).toBeDefined();
  });

  it("opens Deposit dialog when Deposit button is clicked", () => {
    render(<Wallet />);

    const depositButton = screen.getByRole("button", { name: /^Deposit$/i });
    fireEvent.click(depositButton);

    expect(screen.getByRole("heading", { name: "Record Deposit" })).toBeDefined();
    expect(screen.getByLabelText(/Amount \(\$\)/i)).toBeDefined();
  });

  it("opens Withdrawal dialog when Withdraw button is clicked", () => {
    render(<Wallet />);

    const withdrawButton = screen.getByRole("button", { name: /^Withdraw$/i });
    fireEvent.click(withdrawButton);

    expect(screen.getByRole("heading", { name: "Record Withdrawal" })).toBeDefined();
  });

  it("filters cash movements by type when clicking tabs", () => {
    render(<Wallet />);

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
});
