// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Calendar from "./Calendar";

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
  }],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: { activeBroker: { useQuery: () => ({ data: "Bybit" }) } },
    trades: {
      list: { useQuery: () => ({ data: mocks.trades, isLoading: false }) },
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
  afterEach(() => cleanup());

  it("keeps each London calendar date unique across the daylight-saving transition", () => {
    const { container } = render(<Calendar embedded />);
    const dayButtons = Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-label^='2026-']"));
    const dateKeys = dayButtons.map((button) => button.getAttribute("aria-label")?.split(",")[0]);

    expect(dayButtons).toHaveLength(35);
    expect(new Set(dateKeys).size).toBe(dateKeys.length);
    expect(screen.getAllByRole("button", { name: /^2026-10-25,/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^2026-10-26,/ })).toHaveLength(1);
  });

  it("provides a compact card layout and a full table for the selected day", () => {
    const { container } = render(<Calendar embedded />);
    fireEvent.click(screen.getByRole("button", { name: /^2026-10-02,/ }));

    expect(container.querySelector(".xl\\:hidden article")).toBeTruthy();
    expect(container.querySelector("article > .grid-cols-4")?.children).toHaveLength(4);
    expect(container.querySelector(".xl\\:block table")).toBeTruthy();
    expect(screen.getByText("02/10/2026")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Preview note for BTCUSD" })[0]);
    expect(screen.getByText("October trade")).toBeTruthy();
  });
});