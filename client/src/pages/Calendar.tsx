import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TradeEntryForm from "@/components/TradeEntryForm";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Calendar({ embedded = false }: { embedded?: boolean }) {
  const londonDateKey = (value: Date | string) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

  const londonDateTime = (value: Date | string) => new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { data: trades, isLoading } = trpc.trades.list.useQuery();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const deleteTradeMutation = trpc.trades.delete.useMutation({
    onSuccess: () => {
      toast.success("Trade deleted successfully");
      setDeleteId(null);
      utils.trades.list.invalidate();
      utils.stats.calculate.invalidate();
    },
    onError: (error) => toast.error(error.message || "Failed to delete trade"),
  });

  // Group trades by date and calculate daily P&L
  const dailyStats = useMemo(() => {
    if (!trades) return new Map();

    const stats = new Map<string, { pnl: number; trades: typeof trades; winCount: number; lossCount: number }>();

    trades.forEach((trade) => {
      const dateKey = londonDateKey(trade.tradeDate);
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
  const selectedDateKey = selectedDate ? londonDateKey(selectedDate) : null;
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
    return londonDateTime(date);
  };

  return (
    <div className="space-y-6">
      {!embedded && <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-1">
          View your trading performance by day with color-coded P&L
        </p>
      </div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Trading Calendar</CardTitle>
                  <CardDescription className="mt-1">
                  Green: Profit | Red: Loss | Gray: Neutral | Amber: Involuntary
                </CardDescription>
              </div>
              <TradeEntryForm />
            </div>
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
                  const dateKey = londonDateKey(date);
                  return !dailyStats.has(dateKey);
                }}
                modifiers={{
                  profit: (date) => {
                    const dateKey = londonDateKey(date);
                    const stats = dailyStats.get(dateKey);
                    return stats ? stats.pnl > 0 : false;
                  },
                  loss: (date) => {
                    const dateKey = londonDateKey(date);
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
                      <TableHead>Asset</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Exit</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>P&L</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedDayTrades.map((trade: any) => {
                      const pnl = parseFloat(trade.pnl);
                      const isProfit = pnl > 0;
                        const time = new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Europe/London",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(trade.tradeDate));

                      return (
                        <TableRow key={trade.id} className={trade.isInvoluntary ? "bg-amber-50/70 hover:bg-amber-100/70" : undefined}>
                          <TableCell className="text-sm">{time}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {trade.symbol}
                              {trade.isInvoluntary && <Badge variant="outline" className="border-amber-400 bg-amber-100 text-amber-800">Involuntary</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline">{trade.assetType ?? "other"}</Badge>
                              <span className="text-xs text-muted-foreground">{trade.quantityUnit ?? "units"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={trade.direction === "long" ? "default" : "secondary"}>
                              {trade.direction.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(parseFloat(trade.entryPrice))}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(trade.exitPrice))}</TableCell>
                          <TableCell>{trade.quantity}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatCurrency(Number.parseFloat(trade.fees ?? "0") || 0)}
                          </TableCell>
                          <TableCell>
                            <span className={isProfit ? "text-profit font-semibold" : "text-loss font-semibold"}>
                              {formatCurrency(pnl)}
                              {trade.pnlSource === "broker" && <span className="ml-1 text-[10px] text-muted-foreground">broker</span>}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <TradeEntryForm trade={trade} />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteId(trade.id)}
                                aria-label={`Delete ${trade.symbol}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this trade?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone and will remove the trade from your analytics.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTradeMutation.isPending}
              onClick={() => deleteId !== null && deleteTradeMutation.mutate({ id: deleteId })}
            >
              Delete trade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
