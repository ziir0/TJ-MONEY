import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { filterTradesByBroker } from "@/lib/tradingAnalytics";
import CSVImport from "@/components/CSVImport";
import TradeExport from "@/components/TradeExport";
import Calendar from "./Calendar";

export default function Trades() {
  const { data: selectedBroker = "Bybit" } = trpc.account.activeBroker.useQuery();

  const { data: trades, isLoading } = trpc.trades.list.useQuery();
  const brokerTrades = useMemo(() => filterTradesByBroker(trades ?? [], selectedBroker), [trades, selectedBroker]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Trades</h1>
        </div>
        <div className="hidden w-full shrink-0 flex-nowrap items-center justify-start gap-2 sm:w-auto sm:justify-end md:flex">
          <CSVImport />
          <TradeExport trades={brokerTrades} showSummary={false} />
        </div>
      </div>

      <Calendar embedded />
    </div>
  );
}
