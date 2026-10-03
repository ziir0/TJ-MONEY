// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TradeEntryForm from "./TradeEntryForm";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  upload: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    account: {
      activeBroker: { useQuery: () => ({ data: "Bybit" }) },
    },
    useUtils: () => ({
      trades: { list: { invalidate: mocks.invalidate } },
      stats: { calculate: { invalidate: mocks.invalidate } },
    }),
    trades: {
      screenshotUrls: { useQuery: () => ({ data: {}, isLoading: false }) },
      uploadScreenshot: {
        useMutation: () => ({ mutateAsync: mocks.upload }),
      },
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
    mocks.upload.mockReset();
    mocks.upload.mockResolvedValue({ key: "users/1/trades/test.png" });
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
        screenshot1: null,
        screenshot2: null,
      }),
    );
  });

  it("preserves exact trade instants when editing datetime-local fields", async () => {
    const tradeDate = new Date("2026-10-01T23:02:08.000Z");
    const exitDate = new Date("2026-10-02T04:21:16.000Z");
    const toLocalInputValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
    render(<TradeEntryForm trade={{
      id: 55,
      broker: "Bybit",
      symbol: "XRPUSDT.P",
      assetType: "crypto",
      quantityUnit: "coins",
      pnlSource: "calculated",
      isInvoluntary: false,
      direction: "long",
      entryPrice: "1.4919",
      exitPrice: "1.5205",
      quantity: "67",
      fees: "0.11100695",
      pnl: "1.80519305",
      tradeDate,
      exitDate,
      notes: "official timestamp regression",
      screenshot1: null,
      screenshot2: null,
    }} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
    expect((dateInputs[0] as HTMLInputElement).value.slice(0, 19)).toBe(toLocalInputValue(tradeDate));
    expect((dateInputs[1] as HTMLInputElement).value.slice(0, 19)).toBe(toLocalInputValue(exitDate));

    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    const payload = mocks.mutate.mock.calls[0]?.[0] as { updates: { tradeDate: Date; exitDate: Date } };
    expect(payload.updates.tradeDate.toISOString()).toBe(tradeDate.toISOString());
    expect(payload.updates.exitDate.toISOString()).toBe(exitDate.toISOString());
  });
});
