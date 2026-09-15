import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Calendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { data: trades, isLoading } = trpc.trades.list.useQuery();

  // Group trades by date and calculate daily P&L
  const dailyStats = useMemo(() => {
    if (!trades) return new Map();

    const stats = new Map<string, { pnl: number; trades: typeof trades; winCount: number; lossCount: number }>();

    trades.forEach((trade) => {
      const dateKey = new Date(trade.tradeDate).toISOString().split("T")[0];
      const pnl = parseFloat(trade.pnl);

      if (!stats.has(dateKey)) {
        stats.set(dateKey, { pnl: 0, trades: [], winCount: 0, lossCount: 0 });
      }

      const dayStats = stats.get(dateKey)!;
      dayStats.pnl += pnl;
      dayStats.trades.push(trade);
      if (pnl > 0) dayStats.winCount++;
      else if (pnl < 0) dayStats.lossCount++;
    });

    return stats;
  }, [trades]);

  // Get trades for selected date
  const selectedDateKey = selectedDate ? new Date(selectedDate).toISOString().split("T")[0] : null;
  const selectedDayTrades = selectedDateKey ? dailyStats.get(selectedDateKey)?.trades || [] : [];
  const selectedDayStats = selectedDateKey ? dailyStats.get(selectedDateKey) : null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-1">
          View your trading performance by day with color-coded P&L
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle>Trading Calendar</CardTitle>
            <CardDescription>
              Green: Profit | Red: Loss | Gray: Neutral
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80" />
            ) : (
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => {
                  const dateKey = new Date(date).toISOString().split("T")[0];
                  return !dailyStats.has(dateKey);
                }}
                modifiers={{
                  profit: (date) => {
                    const dateKey = new Date(date).toISOString().split("T")[0];
                    const stats = dailyStats.get(dateKey);
                    return stats ? stats.pnl > 0 : false;
                  },
                  loss: (date) => {
                    const dateKey = new Date(date).toISOString().split("T")[0];
                    const stats = dailyStats.get(dateKey);
                    return stats ? stats.pnl < 0 : false;
                  },
                }}
                modifiersClassNames={{
                  profit: "bg-profit/20 text-profit font-semibold",
                  loss: "bg-loss/20 text-loss font-semibold",
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Day View */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedDate ? formatDate(selectedDate).split(",")[0] : "Select a Date"}
            </CardTitle>
            {selectedDayStats && (
              <CardDescription className="space-y-2 mt-2">
                <div className="flex items-center gap-4 text-sm">
                  <span className={selectedDayStats.pnl > 0 ? "text-profit font-semibold" : selectedDayStats.pnl < 0 ? "text-loss font-semibold" : ""}>
                    P&L: {formatCurrency(selectedDayStats.pnl)}
                  </span>
                  <span>Trades: {selectedDayStats.trades.length}</span>
                  <span className="text-profit">Wins: {selectedDayStats.winCount}</span>
                  <span className="text-loss">Losses: {selectedDayStats.lossCount}</span>
                </div>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Select a date to view trades</p>
              </div>
            ) : selectedDayTrades.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No trades recorded for this date</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Exit</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDayTrades.map((trade: any) => {
                      const pnl = parseFloat(trade.pnl);
                      const isProfit = pnl > 0;
                      const time = new Date(trade.tradeDate).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <TableRow key={trade.id}>
                          <TableCell className="text-sm">{time}</TableCell>
                          <TableCell className="font-medium">{trade.symbol}</TableCell>
                          <TableCell>
                            <Badge variant={trade.direction === "long" ? "default" : "secondary"}>
                              {trade.direction.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(parseFloat(trade.entryPrice))}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(trade.exitPrice))}</TableCell>
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
    </div>
  );
}
