import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import TradeFilters from "@/components/TradeFilters";
import CSVImport from "@/components/CSVImport";
import TradeExport from "@/components/TradeExport";
import Calendar from "./Calendar";

export default function Trades() {
  const [symbolFilter, setSymbolFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<string | null>(null);
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  const { data: trades, isLoading } = trpc.trades.list.useQuery();

  const filteredTrades = useMemo(() => {
    if (!trades) return [];

    return trades.filter((trade) => {
      // Symbol filter
      if (symbolFilter && !trade.symbol.toUpperCase().includes(symbolFilter.toUpperCase())) {
        return false;
      }

      // Direction filter
      if (directionFilter && trade.direction !== directionFilter) {
        return false;
      }

      // Outcome filter
      if (outcomeFilter) {
        const pnl = parseFloat(trade.pnl);
        if (outcomeFilter === "win" && pnl <= 0) return false;
        if (outcomeFilter === "loss" && pnl >= 0) return false;
        if (outcomeFilter === "breakeven" && pnl !== 0) return false;
      }

      // Date range filter
      if (startDateFilter || endDateFilter) {
        const tradeDate = new Date(trade.tradeDate).toISOString().split("T")[0];
        if (startDateFilter && tradeDate < startDateFilter) {
          return false;
        }
        if (endDateFilter && tradeDate > endDateFilter) {
          return false;
        }
      }

      return true;
    });
  }, [trades, symbolFilter, directionFilter, outcomeFilter, startDateFilter, endDateFilter]);

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parseFloat(String(value)));
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trades</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all your trading records
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TradeExport trades={filteredTrades} />
        </div>
      </div>

      <CSVImport />

      <TradeFilters
        onSymbolChange={setSymbolFilter}
        onDirectionChange={setDirectionFilter}
        onOutcomeChange={setOutcomeFilter}
        onDateRangeChange={(start, end) => {
          setStartDateFilter(start);
          setEndDateFilter(end);
        }}
        onReset={() => {
          setSymbolFilter("");
          setDirectionFilter(null);
          setOutcomeFilter(null);
          setStartDateFilter("");
          setEndDateFilter("");
        }}
      />

      <Calendar embedded />
    </div>
  );
}
