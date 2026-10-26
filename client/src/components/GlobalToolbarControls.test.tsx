// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GlobalToolbarProvider } from "@/contexts/GlobalToolbarContext";
import GlobalDateNavigator from "@/components/GlobalDateNavigator";
import GlobalTradeControls from "@/components/GlobalTradeControls";

function renderToolbar(active: boolean) {
  const storage = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });

  return render(
    <GlobalToolbarProvider>
      <div className="global-topbar-container">
        <div className="global-topbar-grid">
          <div className="global-topbar-primary">Broker and new trade</div>
          <GlobalTradeControls active={active} />
          <div className="global-topbar-period">
            <GlobalDateNavigator />
            <button type="button" aria-label="Toggle theme">Theme</button>
          </div>
        </div>
      </div>
    </GlobalToolbarProvider>,
  );
}

describe("Global toolbar responsive controls", () => {
  afterEach(() => cleanup());

  it("groups search and filters in one bar and opens filter controls on demand", () => {
    renderToolbar(true);

    expect(screen.getByText("Broker and new trade")).toBeTruthy();
    expect(screen.getByLabelText("Search trades")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open trade filters" })).toBeTruthy();
    expect(screen.queryByLabelText("Filter trade direction")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open trade filters" }));
    expect(screen.getByLabelText("Filter trade direction")).toBeTruthy();
    expect(screen.getByLabelText("Filter trade outcome")).toBeTruthy();
    expect(screen.getByLabelText("Filter trade asset")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeTruthy();
    expect(screen.getByLabelText("Selected trading date")).toBeTruthy();
    expect(screen.getByLabelText("Choose trading date")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Select date range" })).toBeTruthy();
    expect(screen.getByLabelText("Select date range").className).toContain("global-period-trigger");
    expect(screen.getByLabelText("Select date range").querySelector(".global-period-icon")).toBeTruthy();
    expect(screen.getByLabelText("Toggle theme")).toBeTruthy();
  });

  it("keeps search and filters visible but disabled outside Trades Log", () => {
    renderToolbar(false);

    expect((screen.getByLabelText("Search trades") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Open trade filters" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Selected trading date")).toBeTruthy();
    expect(screen.getByLabelText("Toggle theme")).toBeTruthy();
  });
});
