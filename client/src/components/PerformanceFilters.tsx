import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  filterTradesByDateRange,
  filterTradesByInstrument,
  type AnalyticsTrade,
} from "@/lib/tradingAnalytics";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
] as const;

type PresetPeriod = typeof PERIODS[number]["value"];
type Period = PresetPeriod | "custom";

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function presetBounds(period: PresetPeriod, now = new Date()) {
  if (period === "all") return { startDate: "", endDate: "" };
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  if (period === "1y") {
    start.setFullYear(start.getFullYear() - 1);
  } else {
    const days = Number.parseInt(period, 10);
    start.setDate(start.getDate() - (days - 1));
  }
  return { startDate: toLocalDateString(start), endDate: toLocalDateString(end) };
}

export function usePerformanceFilters(trades: AnalyticsTrade[]) {
  const [period, setPeriod] = useState<Period>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [instrument, setInstrument] = useState("All Instruments");

  const instruments = useMemo(
    () => Array.from(new Set(trades.map((trade) => String(trade.symbol ?? "").trim()).filter(Boolean))).sort(),
    [trades],
  );

  useEffect(() => {
    if (instrument !== "All Instruments" && !instruments.includes(instrument)) {
      setInstrument("All Instruments");
    }
  }, [instrument, instruments]);

  const isRangeInvalid = Boolean(startDate && endDate && startDate > endDate);
  const filteredTrades = useMemo(() => {
    if (isRangeInvalid) return [];
    return filterTradesByInstrument(
      filterTradesByDateRange(trades, startDate || undefined, endDate || undefined),
      instrument,
    );
  }, [trades, startDate, endDate, instrument, isRangeInvalid]);

  const previousRange = useMemo(() => {
    if (period === "all" || isRangeInvalid || !startDate || !endDate) return null;
    const currentStart = new Date(`${startDate}T00:00:00.000Z`);
    const currentEnd = new Date(`${endDate}T00:00:00.000Z`);
    const dayCount = Math.floor((currentEnd.getTime() - currentStart.getTime()) / DAY_MS) + 1;
    if (!Number.isFinite(dayCount) || dayCount < 1) return null;
    const previousEnd = new Date(currentStart);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setUTCDate(previousStart.getUTCDate() - dayCount + 1);
    return {
      startDate: previousStart.toISOString().slice(0, 10),
      endDate: previousEnd.toISOString().slice(0, 10),
    };
  }, [period, startDate, endDate, isRangeInvalid]);

  const periodLabel = period === "custom"
    ? "Custom range"
    : period === "all"
      ? "All time"
      : `Last ${PERIODS.find((option) => option.value === period)?.label ?? ""}`;

  function selectPeriod(nextPeriod: PresetPeriod) {
    const bounds = presetBounds(nextPeriod);
    setStartDate(bounds.startDate);
    setEndDate(bounds.endDate);
    setPeriod(nextPeriod);
  }

  function changeDate(which: "start" | "end", value: string) {
    setPeriod("custom");
    if (which === "start") setStartDate(value);
    else setEndDate(value);
  }

  return {
    filteredTrades,
    instruments,
    instrument,
    setInstrument,
    period,
    startDate,
    endDate,
    isRangeInvalid,
    previousRange,
    periodLabel,
    selectPeriod,
    changeDate,
  };
}

export default function PerformanceFilters({
  instruments,
  instrument,
  onInstrumentChange,
  period,
  startDate,
  endDate,
  isRangeInvalid,
  onPeriodChange,
  onDateChange,
}: {
  instruments: string[];
  instrument: string;
  onInstrumentChange: (instrument: string) => void;
  period: Period;
  startDate: string;
  endDate: string;
  isRangeInvalid: boolean;
  onPeriodChange: (period: PresetPeriod) => void;
  onDateChange: (which: "start" | "end", value: string) => void;
}) {
  return (
    <section aria-label="Trade filters" className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center rounded-lg border bg-background/70 p-1" role="group" aria-label="Trade date period">
          {PERIODS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={period === option.value ? "default" : "ghost"}
              aria-pressed={period === option.value}
              onClick={() => onPeriodChange(option.value)}
              className="h-8 px-3 text-xs font-semibold"
            >
              {option.label}
            </Button>
          ))}
        </div>

        <Select value={instrument} onValueChange={onInstrumentChange}>
          <SelectTrigger className="h-9 w-full min-w-40 flex-1 bg-background/70 sm:max-w-56" aria-label="Filter by instrument">
            <SelectValue placeholder="All Instruments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Instruments">All Instruments</SelectItem>
            {instruments.map((symbol) => (
              <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="trade-filter-start" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">From</label>
          <Input
            id="trade-filter-start"
            type="date"
            value={startDate}
            onChange={(event) => onDateChange("start", event.target.value)}
            className="h-9 bg-background/70 text-xs font-mono"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="trade-filter-end" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">To</label>
          <Input
            id="trade-filter-end"
            type="date"
            value={endDate}
            onChange={(event) => onDateChange("end", event.target.value)}
            className="h-9 bg-background/70 text-xs font-mono"
          />
        </div>
      </div>
      {isRangeInvalid ? (
        <p role="alert" className="text-xs text-loss">The start date must be on or before the end date.</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Instrument filters apply to trades; cash movements remain account-level.</p>
      )}
    </section>
  );
}
