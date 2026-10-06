// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Journal from "./Journal";

const mocks = vi.hoisted(() => ({
  selectedBroker: "Bybit",
  trades: [
    {
      id: 1,
      broker: "Bybit",
      symbol: "BTCUSD",
      direction: "long",
      pnl: "150",
      tradeDate: "2026-10-06T10:00:00.000Z",
    },
    {
      id: 2,
      broker: "Bybit",
      symbol: "ETHUSD",
      direction: "short",
      pnl: "-50",
      tradeDate: "2026-10-06T11:00:00.000Z",
    },
  ],
  entry: {
    id: 1,
    content: "Disciplined execution today.",
    date: new Date("2026-10-06T00:00:00"),
  },
  upsertCalledWith: null as any,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: {
      activeBroker: { useQuery: () => ({ data: mocks.selectedBroker }) },
    },
    trades: {
      list: { useQuery: () => ({ data: mocks.trades, isLoading: false }) },
    },
    journal: {
      getByDate: {
        useQuery: () => ({
          data: mocks.entry,
          isLoading: false,
          refetch: vi.fn(),
        }),
      },
      upsert: {
        useMutation: () => ({
          mutate: (data: any) => {
            mocks.upsertCalledWith = data;
          },
          isPending: false,
        }),
      },
      delete: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
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

describe("Journal trading workspace", () => {
  afterEach(() => {
    cleanup();
    mocks.upsertCalledWith = null;
  });

  it("renders daily notes, psychology tags, and daily scorecard", () => {
    render(<Journal />);

    expect(screen.getByText("Trading Journal")).toBeTruthy();
    expect(screen.getByText("Daily Notes")).toBeTruthy();
    expect(screen.getByText("Daily Performance")).toBeTruthy();
    expect(screen.getByText("Executed Trades")).toBeTruthy();
    expect(screen.getByText("BTCUSD")).toBeTruthy();
    expect(screen.getByText("ETHUSD")).toBeTruthy();
    expect(screen.getByText("Followed Plan")).toBeTruthy();
    expect(screen.getByText("FOMO")).toBeTruthy();
    expect(screen.getByText("Patient Entry")).toBeTruthy();
  });

  it("appends psychology tag into notes when clicked", () => {
    render(<Journal />);

    const textarea = screen.getByPlaceholderText(/Document your pre-market bias/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain("Disciplined execution today.");

    const fomoTag = screen.getByRole("button", { name: "FOMO" });
    fireEvent.click(fomoTag);

    expect(textarea.value).toContain("#FOMO");
  });

  it("saves journal notes on save button click", () => {
    render(<Journal />);

    const saveButton = screen.getByRole("button", { name: /Save Entry/i });
    fireEvent.click(saveButton);

    expect(mocks.upsertCalledWith).not.toBeNull();
    expect(mocks.upsertCalledWith.content).toContain("Disciplined execution today.");
  });

  it("navigates days with previous and next day buttons accurately across boundaries", () => {
    render(<Journal />);

    const dateInput = document.getElementById("journal-date") as HTMLInputElement;
    const prevButton = screen.getByRole("button", { name: "Previous Day" });
    const nextButton = screen.getByRole("button", { name: "Next Day" });
    const todayButton = screen.getByRole("button", { name: "Today" });

    // Initial date should match today
    const initialDate = dateInput.value;
    expect(initialDate).toBeTruthy();

    // Set to 2026-10-02 to specifically test user scenario
    fireEvent.change(dateInput, { target: { value: "2026-10-02" } });
    expect(dateInput.value).toBe("2026-10-02");

    // Advance 1 day with next button: must be 2026-10-03
    fireEvent.click(nextButton);
    expect(dateInput.value).toBe("2026-10-03");

    // Go back 1 day with prev button: must be 2026-10-02
    fireEvent.click(prevButton);
    expect(dateInput.value).toBe("2026-10-02");

    // Go back 1 more day: must be 2026-10-01
    fireEvent.click(prevButton);
    expect(dateInput.value).toBe("2026-10-01");

    // Boundary check: go back across month boundary to 2026-09-30
    fireEvent.click(prevButton);
    expect(dateInput.value).toBe("2026-09-30");

    // Jump to today
    fireEvent.click(todayButton);
    expect(dateInput.value).toBe(initialDate);
  });
});
