// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CSVImport from "./CSVImport";

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
      bulkCreate: {
        useMutation: () => ({
          isPending: false,
          mutate: mocks.mutate,
        }),
      },
    },
  },
}));

describe("CSVImport", () => {
  beforeEach(() => mocks.mutate.mockReset());

  it("previews valid rows and submits the parsed payload", async () => {
    render(<CSVImport />);
    fireEvent.click(screen.getByRole("button", { name: /import csv/i }));

    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();

    const file = new File(
      [[
        "symbol,direction,entryPrice,exitPrice,quantity,fees,pnl,tradeDate",
        "AAPL,long,100,110,2,1,19,2026-08-10T09:30",
      ].join("\n")],
      "trades.csv",
      { type: "text/csv" },
    );

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    expect(await screen.findByText("1 ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /import 1 trade/i }));

    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    expect(mocks.mutate).toHaveBeenCalledWith({
      trades: [
        expect.objectContaining({ symbol: "AAPL", direction: "long", pnl: "19" }),
      ],
    });
  });

  it("shows row-level errors and keeps valid rows available", async () => {
    render(<CSVImport />);
    fireEvent.click(screen.getByRole("button", { name: /import csv/i }));

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      [[
        "symbol,direction,entryPrice,exitPrice,quantity,fees,pnl,tradeDate",
        "AAPL,long,100,110,2,1,19,2026-08-10",
        "TSLA,sideways,invalid,200,0,0,,not-a-date",
      ].join("\n")],
      "mixed.csv",
      { type: "text/csv" },
    );

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Rows skipped during validation")).toBeTruthy();
    expect(screen.getByText("1 ready")).toBeTruthy();
    expect(screen.getByText(/Row 3:/)).toBeTruthy();
  });
});
