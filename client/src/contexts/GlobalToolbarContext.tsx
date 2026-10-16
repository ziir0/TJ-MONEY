import React, { createContext, useContext, useMemo, useState } from "react";
import type { DatePreset } from "@/lib/tradingAnalytics";

export type TradeDirectionFilter = "all" | "long" | "short";
export type TradeOutcomeFilter = "all" | "win" | "loss" | "breakeven";
export type TradeAssetFilter = "all" | "crypto" | "forex" | "stocks" | "indices" | "other";

type GlobalToolbarState = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  shiftSelectedDate: (days: number) => void;
  selectedPeriod: DatePreset;
  setSelectedPeriod: (period: DatePreset) => void;
  periodLabel: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  directionFilter: TradeDirectionFilter;
  setDirectionFilter: (direction: TradeDirectionFilter) => void;
  outcomeFilter: TradeOutcomeFilter;
  setOutcomeFilter: (outcome: TradeOutcomeFilter) => void;
  assetFilter: TradeAssetFilter;
  setAssetFilter: (asset: TradeAssetFilter) => void;
  hasTradeFilters: boolean;
  resetTradeFilters: () => void;
};

const GlobalToolbarContext = createContext<GlobalToolbarState | null>(null);
const PERIOD_LABELS: Record<DatePreset, string> = {
  today: "Today",
  thisMonth: "This Month",
  last90Days: "Last 90 Days",
  last3Months: "Last 3 Months",
  last6Months: "Last 6 Months",
  lastYear: "1 Year",
  all: "All Time",
};
const DATE_PRESETS = Object.keys(PERIOD_LABELS) as DatePreset[];

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

export function GlobalToolbarProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState(() => {
    if (typeof window === "undefined") return getLocalDateString();
    if (window.localStorage.getItem("global-trading-period") !== "today") return getLocalDateString();
    const savedDate = window.localStorage.getItem("global-trading-date");
    return savedDate && /^\d{4}-\d{2}-\d{2}$/.test(savedDate) ? savedDate : getLocalDateString();
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriodState] = useState<DatePreset>(() => {
    if (typeof window === "undefined") return "thisMonth";
    const savedPeriod = window.localStorage.getItem("global-trading-period");
    return savedPeriod && DATE_PRESETS.includes(savedPeriod as DatePreset)
      ? (savedPeriod as DatePreset)
      : "thisMonth";
  });
  const [directionFilter, setDirectionFilter] = useState<TradeDirectionFilter>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<TradeOutcomeFilter>("all");
  const [assetFilter, setAssetFilter] = useState<TradeAssetFilter>("all");

  const setSelectedDate = (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    setSelectedDateState(date);
    window.localStorage.setItem("global-trading-date", date);
    setSelectedPeriodState("today");
    window.localStorage.setItem("global-trading-period", "today");
  };

  const shiftSelectedDate = (days: number) => {
    setSelectedDate(shiftDateString(selectedDate, days));
  };

  const setSelectedPeriod = (period: DatePreset) => {
    if (!DATE_PRESETS.includes(period)) return;
    setSelectedPeriodState(period);
    window.localStorage.setItem("global-trading-period", period);
    setSelectedDateState(getLocalDateString());
    window.localStorage.setItem("global-trading-date", getLocalDateString());
  };
  const hasTradeFilters = Boolean(
    searchQuery || directionFilter !== "all" || outcomeFilter !== "all" || assetFilter !== "all",
  );
  const resetTradeFilters = () => {
    setSearchQuery("");
    setDirectionFilter("all");
    setOutcomeFilter("all");
    setAssetFilter("all");
  };

  const value = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      shiftSelectedDate,
      selectedPeriod,
      setSelectedPeriod,
      periodLabel: PERIOD_LABELS[selectedPeriod],
      searchQuery,
      setSearchQuery,
      directionFilter,
      setDirectionFilter,
      outcomeFilter,
      setOutcomeFilter,
      assetFilter,
      setAssetFilter,
      hasTradeFilters,
      resetTradeFilters,
    }),
    [selectedDate, selectedPeriod, searchQuery, directionFilter, outcomeFilter, assetFilter, hasTradeFilters],
  );

  return <GlobalToolbarContext.Provider value={value}>{children}</GlobalToolbarContext.Provider>;
}

export function useGlobalToolbar() {
  const context = useContext(GlobalToolbarContext);
  if (!context) {
    throw new Error("useGlobalToolbar must be used within GlobalToolbarProvider");
  }
  return context;
}
