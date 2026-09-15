import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import TradeEntryForm from "@/components/TradeEntryForm";
import TradeFilters from "@/components/TradeFilters";
import CSVImport from "@/components/CSVImport";
import TradeExport from "@/components/TradeExport";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
          <TradeEntryForm />
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

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>
            {filteredTrades.length} of {trades?.length || 0} trades
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !trades || trades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No trades recorded yet. Start by adding your first trade!</p>
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No trades match the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map((trade) => {
                    const pnl = parseFloat(trade.pnl);
                    const isProfit = pnl > 0;
                    return (
                      <TableRow key={trade.id}>
                        <TableCell className="text-sm">
                          {formatDate(trade.tradeDate)}
                        </TableCell>
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={trade.direction === "long" ? "default" : "secondary"}>
                            {trade.direction.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(trade.entryPrice)}</TableCell>
                        <TableCell>{formatCurrency(trade.exitPrice)}</TableCell>
                        <TableCell>{trade.quantity}</TableCell>
                        <TableCell>
                          <span className={isProfit ? "text-profit font-semibold" : "text-loss font-semibold"}>
                            {formatCurrency(pnl)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
