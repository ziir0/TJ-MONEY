// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TradeEntryForm from "./TradeEntryForm";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      trades: { list: { invalidate: mocks.invalidate } },
      stats: { calculate: { invalidate: mocks.invalidate } },
    }),
    trades: {
      create: {
        useMutation: (options: { onSuccess?: () => void }) => ({
          isPending: false,
          mutate: (input: unknown) => {
            mocks.mutate(input);
            options.onSuccess?.();
          },
        }),
      },
      update: {
        useMutation: (options: { onSuccess?: () => void }) => ({
          isPending: false,
          mutate: (input: unknown) => {
            mocks.mutate(input);
            options.onSuccess?.();
          },
        }),
      },
    },
  },
}));

describe("TradeEntryForm", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.invalidate.mockReset();
  });

  it("opens and reports required field validation", async () => {
    render(<TradeEntryForm />);

    fireEvent.click(screen.getByRole("button", { name: /new trade/i }));
    fireEvent.click(screen.getByRole("button", { name: /save trade/i }));

    expect(await screen.findByText("Symbol is required")).toBeTruthy();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("submits a valid trade with Date objects", async () => {
    render(<TradeEntryForm />);
    fireEvent.click(screen.getByRole("button", { name: /new trade/i }));

    const symbolInput = document.querySelector('input[placeholder="AAPL, BTC/USD, etc."]');
    expect(symbolInput).toBeTruthy();
    fireEvent.change(symbolInput as HTMLInputElement, { target: { value: "AAPL" } });

    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0] as HTMLInputElement, { target: { value: "1" } });
    fireEvent.change(numberInputs[1] as HTMLInputElement, { target: { value: "100" } });
    fireEvent.change(numberInputs[2] as HTMLInputElement, { target: { value: "110" } });
    fireEvent.change(numberInputs[3] as HTMLInputElement, { target: { value: "2" } });
    fireEvent.change(numberInputs[4] as HTMLInputElement, { target: { value: "1" } });
    fireEvent.change(numberInputs[5] as HTMLInputElement, { target: { value: "19" } });

    const form = document.querySelector("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    expect(mocks.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "AAPL",
        direction: "long",
        entryPrice: "100",
        pnl: "19",
        tradeDate: expect.any(Date),
      }),
    );
  });
});
