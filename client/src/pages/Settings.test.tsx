// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";
import { ALL_SUPPORTED_BROKERS, DEFAULT_ENABLED_BROKERS } from "@shared/brokers";

const mocks = vi.hoisted(() => ({
  updateEnabledBrokers: vi.fn(),
  saveActiveBroker: vi.fn(),
  invalidate: vi.fn(),
  setData: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      account: {
        enabledBrokers: {
          setData: mocks.setData,
          invalidate: mocks.invalidate,
        },
        activeBroker: {
          setData: mocks.setData,
          invalidate: mocks.invalidate,
        },
      },
      trades: { list: { invalidate: mocks.invalidate } },
      stats: { calculate: { invalidate: mocks.invalidate } },
    }),
    account: {
      enabledBrokers: {
        useQuery: () => ({
          data: ["Bybit", "Pepperstone"],
          isLoading: false,
        }),
      },
      activeBroker: {
        useQuery: () => ({
          data: "Bybit",
          isLoading: false,
        }),
      },
      updateEnabledBrokers: {
        useMutation: (options?: { onSuccess?: (data: string[]) => void }) => ({
          isPending: false,
          mutate: (input: { brokers: string[] }) => {
            mocks.updateEnabledBrokers(input);
            options?.onSuccess?.(input.brokers);
          },
        }),
      },
      saveActiveBroker: {
        useMutation: (options?: { onSuccess?: (data: string) => void }) => ({
          isPending: false,
          mutate: (input: { broker: string }) => {
            mocks.saveActiveBroker(input);
            options?.onSuccess?.(input.broker);
          },
        }),
      },
    },
  },
}));

describe("Settings Page", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.updateEnabledBrokers.mockReset();
    mocks.saveActiveBroker.mockReset();
    mocks.invalidate.mockReset();
    mocks.setData.mockReset();
  });

  it("renders page title and supported brokers counter", () => {
    render(<Settings />);

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeDefined();
    expect(screen.getByText(/2 of 22 enabled/i)).toBeDefined();
    expect(screen.getByText("Interactive Brokers")).toBeDefined();
    expect(screen.getByText("Binance")).toBeDefined();
    expect(screen.getByText("Charles Schwab")).toBeDefined();
  });

  it("filters brokers by search query", () => {
    render(<Settings />);

    const searchInput = screen.getByPlaceholderText(/search brokers/i);
    fireEvent.change(searchInput, { target: { value: "Schwab" } });

    expect(screen.getByText("Charles Schwab")).toBeDefined();
    expect(screen.queryByText("Binance")).toBeNull();
  });

  it("toggles a broker on and saves changes", async () => {
    render(<Settings />);

    // Toggle on Binance (initially not in ["Bybit", "Pepperstone"])
    const binanceCard = screen.getByText("Binance").closest(".group");
    expect(binanceCard).not.toBeNull();
    fireEvent.click(binanceCard!);

    // Should reveal Save Changes button
    const saveButton = screen.getAllByRole("button", { name: /save changes/i })[0];
    expect(saveButton).toBeDefined();

    fireEvent.click(saveButton);

    expect(mocks.updateEnabledBrokers).toHaveBeenCalledWith({
      brokers: ["Bybit", "Pepperstone", "Binance"],
    });
  });

  it("handles Enable All button", () => {
    render(<Settings />);

    const enableAllBtn = screen.getByRole("button", { name: /enable all/i });
    fireEvent.click(enableAllBtn);

    expect(screen.getByText(`22 of ${ALL_SUPPORTED_BROKERS.length} enabled`)).toBeDefined();

    const saveButton = screen.getAllByRole("button", { name: /save changes/i })[0];
    fireEvent.click(saveButton);

    expect(mocks.updateEnabledBrokers).toHaveBeenCalledWith({
      brokers: [...ALL_SUPPORTED_BROKERS],
    });
  });

  it("handles Reset Default button", () => {
    render(<Settings />);

    // First enable all
    fireEvent.click(screen.getByRole("button", { name: /enable all/i }));
    expect(screen.getByText(`22 of ${ALL_SUPPORTED_BROKERS.length} enabled`)).toBeDefined();

    // Now reset to defaults
    fireEvent.click(screen.getByRole("button", { name: /reset default/i }));
    expect(screen.getByText(`2 of ${ALL_SUPPORTED_BROKERS.length} enabled`)).toBeDefined();
  });
});
