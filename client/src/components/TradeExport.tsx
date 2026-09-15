import React from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  buildPerformanceSummaryCsv,
  buildTradesCsv,
  downloadCsv,
  summarizeTrades,
  type AnalyticsTrade,
} from "@/lib/tradingAnalytics";

function exportDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function TradeExport({ trades }: { trades: AnalyticsTrade[] }) {
  const isDisabled = trades.length === 0;

  const exportTrades = () => {
    if (isDisabled) return;
    downloadCsv(buildTradesCsv(trades), `money-options-trades-${exportDate()}.csv`);
    toast.success(`${trades.length} filtered trade${trades.length === 1 ? "" : "s"} exported`);
  };

  const exportSummary = () => {
    if (isDisabled) return;
    const summary = summarizeTrades(trades);
    downloadCsv(buildPerformanceSummaryCsv(summary), `money-options-performance-${exportDate()}.csv`);
    toast.success("Performance summary exported");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={exportTrades}
        disabled={isDisabled}
        className="gap-2"
        aria-label={`Export ${trades.length} filtered trades as CSV`}
      >
        <FileDown className="h-4 w-4" />
        Export Trades
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={exportSummary}
        disabled={isDisabled}
        className="gap-2"
        aria-label="Export filtered performance summary as CSV"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Export Summary
      </Button>
    </div>
  );
}
