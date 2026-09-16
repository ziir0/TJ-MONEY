// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EquityCurve from "./EquityCurve";

vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: {
      settings: { useQuery: () => ({ data: null }) },
      saveSettings: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    },
    useUtils: () => ({ account: { settings: { invalidate: vi.fn() } } }),
  },
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub;

const trades = [
  {
    id: 1,
    symbol: "AAPL",
    direction: "long" as const,
    entryPrice: "100",
    exitPrice: "110",
    quantity: "1",
    fees: "0",
    pnl: "10",
    tradeDate: new Date("2026-08-10T09:30:00.000Z"),
  },
  {
    id: 2,
    symbol: "MSFT",
    direction: "short" as const,
    entryPrice: "200",
    exitPrice: "190",
    quantity: "1",
    fees: "0",
    pnl: "5",
    tradeDate: new Date("2026-08-12T09:30:00.000Z"),
  },
];

describe("EquityCurve", () => {
  afterEach(() => cleanup());

  it("filters the curve by date range and updates the account balance overlay", () => {
    render(<EquityCurve trades={trades} />);

    fireEvent.change(screen.getByLabelText("Starting balance"), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-08-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-08-10" } });

    expect(screen.getByText(/Showing/).textContent).toContain("Showing 1 daily period.");
    expect(screen.getByText(/Balance/).textContent).toContain("$1,010.00");
  });

  it("switches period labels and aggregation when a toggle is selected", () => {
    render(<EquityCurve trades={trades} />);

    expect(screen.getByText(/Running account performance by daily/)).toBeTruthy();
    expect(screen.getByText(/Showing/).textContent).toContain("Showing 2 daily periods.");

    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    expect(screen.getByText(/Running account performance by weekly/)).toBeTruthy();
    expect(screen.getByText(/Showing/).textContent).toContain("Showing 1 weekly period.");

    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByText(/Running account performance by monthly/)).toBeTruthy();
    expect(screen.getByText(/Showing/).textContent).toContain("Showing 1 monthly period.");
  });
});
