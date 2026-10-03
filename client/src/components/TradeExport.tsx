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

export default function TradeExport({
  trades,
  showTrades = true,
  showSummary = true,
  compact = false,
  fullWidth = false,
}: {
  trades: AnalyticsTrade[];
  showTrades?: boolean;
  showSummary?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
}) {
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
    <div className={fullWidth ? "flex w-full flex-col gap-2" : "flex flex-wrap items-center gap-2"}>
      {showTrades && (
        <Button
          type="button"
          variant="outline"
          onClick={exportTrades}
          disabled={isDisabled}
          className={fullWidth ? "w-full justify-start gap-2" : compact ? "h-8 w-8 p-0 @[53rem]:h-9 @[53rem]:w-auto @[53rem]:px-3" : "gap-2"}
          aria-label={`Export ${trades.length} filtered trades as CSV`}
          title={compact ? "Export Trades" : undefined}
        >
          <FileDown className="h-4 w-4" />
          <span className={compact ? "sr-only @[53rem]:not-sr-only" : ""}>Export Trades</span>
        </Button>
      )}
      {showSummary && (
        <Button
          type="button"
          variant="outline"
          onClick={exportSummary}
          disabled={isDisabled}
          className={fullWidth ? "w-full justify-start gap-2" : compact ? "h-8 w-8 p-0 @[53rem]:h-9 @[53rem]:w-auto @[53rem]:px-3" : "gap-2"}
          aria-label="Export filtered performance summary as CSV"
          title={compact ? "Export Summary" : undefined}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span className={compact ? "sr-only @[53rem]:not-sr-only" : ""}>Export Summary</span>
        </Button>
      )}
    </div>
  );
}
