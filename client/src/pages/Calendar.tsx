import React, { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { filterTradesByBroker } from "@/lib/tradingAnalytics";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TradeEntryForm from "@/components/TradeEntryForm";
import { ChevronLeft, ChevronRight, CircleAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function TradeNotePreview({ symbol, note }: { symbol: string; note?: string | null }) {
  const preview = note?.trim() || "No note recorded for this trade.";

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Preview note for ${symbol}`}
            >
              <CircleAlert className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap">
          {preview}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm">
        {preview}
      </PopoverContent>
    </Popover>
  );
}

export default function Calendar(props?: { embedded?: boolean; params?: any }) {
  const embedded = props?.embedded ?? false;
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

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  });
  const [displayMonth, setDisplayMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1, 12);
  });
  const { data: selectedBroker = typeof window !== "undefined" ? localStorage.getItem("active-broker") || "Bybit" : "Bybit" } =
    trpc.account.activeBroker.useQuery(undefined, { staleTime: 60_000 });

  const { data: trades, isLoading } = trpc.trades.list.useQuery();
  const brokerTrades = useMemo(() => filterTradesByBroker(trades ?? [], selectedBroker), [trades, selectedBroker]);
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
    if (!brokerTrades) return new Map();

    const stats = new Map<string, { pnl: number; trades: typeof brokerTrades; winCount: number; lossCount: number }>();

    brokerTrades.forEach((trade) => {
      const dateKey = londonDateKey(new Date(trade.tradeDate));
      const pnl = Number(trade.pnl || 0);

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
  }, [brokerTrades]);

  // Get trades for selected date
  const selectedDateKey = selectedDate ? londonDateKey(selectedDate) : null;
  const selectedDayTrades = selectedDateKey ? dailyStats.get(selectedDateKey)?.trades || [] : [];
  const selectedDayStats = selectedDateKey ? dailyStats.get(selectedDateKey) : null;

  const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
  const monthDayCount = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 0).getDate();
  const calendarDayCount = Math.ceil((monthStart.getDay() + monthDayCount) / 7) * 7;
  const calendarStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1 - monthStart.getDay(), 12);
  const calendarDates = Array.from({ length: calendarDayCount }, (_, index) =>
    new Date(calendarStart.getFullYear(), calendarStart.getMonth(), calendarStart.getDate() + index, 12),
  );
  const weekCount = calendarDayCount / 7;
  const weekSummaries = Array.from({ length: weekCount }, (_, weekIndex) => {
    const weekDates = calendarDates.slice(weekIndex * 7, weekIndex * 7 + 7);
    return weekDates.reduce((summary, date) => {
      const stats = dailyStats.get(londonDateKey(date));
      if (stats) {
        summary.pnl += stats.pnl;
        summary.trades += stats.trades.length;
        summary.activeDays += 1;
      }
      return summary;
    }, { pnl: 0, trades: 0, activeDays: 0 });
  });
  const monthSummary = calendarDates
    .filter((date) => date.getMonth() === displayMonth.getMonth())
    .reduce((summary, date) => {
      const stats = dailyStats.get(londonDateKey(date));
      if (stats) {
        summary.pnl += stats.pnl;
        summary.trades += stats.trades.length;
        summary.activeDays += 1;
      }
      return summary;
    }, { pnl: 0, trades: 0, activeDays: 0 });
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(displayMonth);
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatMobileCurrency = (value: number) => {
    const fractionDigits = Math.abs(value) < 100 ? 2 : 0;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  };

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(displayMonth.getFullYear(), displayMonth.getMonth() + offset, 1, 12);
    setDisplayMonth(nextMonth);
    setSelectedDate(nextMonth);
  };

  const selectCalendarDate = (date: Date) => {
    setSelectedDate(date);
    if (date.getMonth() !== displayMonth.getMonth() || date.getFullYear() !== displayMonth.getFullYear()) {
      setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
              <Badge variant="outline" className="border-border/80 font-mono text-xs text-muted-foreground">
                {selectedBroker}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Performance heatmap and daily trading breakdown
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/80 px-3 py-1.5 text-xs shadow-sm">
              <span className="text-muted-foreground">{monthLabel} Net:</span>
              <span className={`font-mono font-bold tabular-nums ${monthSummary.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(monthSummary.pnl)}
              </span>
              <span className="text-muted-foreground/60">·</span>
              <span className="text-muted-foreground font-mono">{monthSummary.trades} tr</span>
            </div>
            <TradeEntryForm />
          </div>
        </div>
      )}

      <div className="space-y-5">
        <Card className="terminal-card border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => changeMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="min-w-36 text-base sm:text-lg font-bold tracking-tight text-center">{monthLabel}</CardTitle>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next month" onClick={() => changeMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => {
                const today = new Date();
                setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12));
                setSelectedDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12));
              }} className="text-xs">
                This month
              </Button>
            </div>
          </CardHeader>
          <CardContent className="@container/calendar p-2 sm:p-5">
            {isLoading ? <Skeleton className="h-[600px]" /> : (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_clamp(88px,20cqw,170px)]">
                <div className="min-w-0">
                  <div className="mb-1.5 grid grid-cols-7 gap-1">
                    {weekdayLabels.map((day) => (
                      <div key={day} className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:h-8 sm:text-xs">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 auto-rows-[76px] gap-1 sm:auto-rows-[86px] lg:auto-rows-[96px]">
                    {calendarDates.map((date) => {
                      const dateKey = londonDateKey(date);
                      const stats = dailyStats.get(dateKey);
                      const isCurrentMonth = date.getMonth() === displayMonth.getMonth();
                      const isSelected = dateKey === selectedDateKey;
                      const winRate = stats?.trades.length ? Math.round((stats.winCount / stats.trades.length) * 100) : 0;
                      const tone = !stats ? "bg-muted/15 border-border/40" : stats.pnl > 0
                        ? "bg-profit/10 border-profit/30 shadow-[0_0_10px_rgba(16,185,129,0.06)] hover:border-profit/60"
                        : stats.pnl < 0 ? "bg-loss/10 border-loss/30 shadow-[0_0_10px_rgba(244,63,94,0.06)] hover:border-loss/60" : "bg-muted/30 border-border";

                      return (
                        <button
                          key={dateKey}
                          type="button"
                          onClick={() => selectCalendarDate(date)}
                          aria-pressed={isSelected}
                          aria-label={stats
                            ? `${dateKey}, ${formatCurrency(stats.pnl)}, ${stats.trades.length} trades, ${winRate}% win rate`
                            : `${dateKey}, no trades`}
                          className={`relative flex h-full min-w-0 flex-col items-stretch rounded-lg border p-1 text-left transition-all sm:p-2 md:p-1.5 ${tone} ${!isCurrentMonth ? "opacity-35" : ""} ${isSelected ? "ring-2 ring-primary ring-inset shadow-md" : "hover:scale-[1.01]"}`}
                        >
                          <span className="text-xs font-mono font-medium tabular-nums text-foreground/80">{date.getDate()}</span>
                          {stats && (
                            <span className="mt-1 flex min-w-0 flex-col gap-0.5 text-right">
                              <span className={`truncate text-[9px] font-mono font-bold tabular-nums sm:text-sm md:text-[10px] ${stats.pnl >= 0 ? "text-profit" : "text-loss"}`} title={formatCurrency(stats.pnl)}>
                                <span className="hidden sm:inline">{formatCurrency(stats.pnl)}</span>
                                <span className="sm:hidden">{formatMobileCurrency(stats.pnl)}</span>
                              </span>
                              <span className="truncate text-[9px] text-muted-foreground sm:text-[11px] md:text-[9px]">
                                <span className="hidden md:inline lg:hidden">{stats.trades.length} tr</span>
                                <span className="md:hidden lg:inline">{stats.trades.length} {stats.trades.length === 1 ? "trade" : "trades"}</span>
                              </span>
                              <span className="text-[9px] font-mono font-medium text-muted-foreground sm:text-[11px] md:text-[9px]">{winRate}%</span>
                            </span>
                          )}
                          {stats?.trades.some((trade: { isInvoluntary?: boolean }) => trade.isInvoluntary) && (
                            <span className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]" aria-label="Includes involuntary trade" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <aside className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:mt-9 md:auto-rows-[86px] md:grid-cols-1 md:gap-1 lg:auto-rows-[96px]" aria-label="Weekly performance">
                  {weekSummaries.map((week, index) => (
                    <div key={index} className="flex min-h-[76px] min-w-0 flex-col justify-center rounded-md border px-2 py-2 md:h-full md:px-1.5 md:py-1.5">
                      <p className="text-xs text-muted-foreground">Week {index + 1}</p>
                      <p className={`mt-1 text-lg font-semibold tabular-nums md:text-base lg:text-lg ${week.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatCurrency(week.pnl)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {week.activeDays} {week.activeDays === 1 ? "day" : "days"}
                      </p>
                    </div>
                  ))}
                </aside>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{formatDate(selectedDate)}</CardTitle>
              <CardDescription>
                {selectedDayStats
                  ? `${selectedDayStats.trades.length} trades · ${selectedDayStats.winCount} wins · ${selectedDayStats.lossCount} losses`
                  : "No trades recorded for this date"}
              </CardDescription>
            </div>
            {selectedDayStats && (
              <p className={`text-lg font-semibold tabular-nums ${selectedDayStats.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(selectedDayStats.pnl)}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {selectedDayTrades.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>No trades recorded for this date</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 xl:hidden">
                  {selectedDayTrades.map((trade: any) => {
                    const pnl = Number(trade.pnl || 0);
                    const entryPrice = formatCurrency(Number(trade.entryPrice));
                    const exitPrice = formatCurrency(Number(trade.exitPrice));
                    const quantity = String(trade.quantity);
                    const fees = formatCurrency(Number(trade.fees ?? 0));
                    const time = new Intl.DateTimeFormat("en-GB", {
                      timeZone: "Europe/London",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(trade.tradeDate));

                    return (
                      <article key={trade.id} className={`space-y-3 rounded-md border p-3 ${trade.isInvoluntary ? "border-amber-300 bg-amber-50/70" : "bg-background"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{trade.symbol}</span>
                              <Badge variant={trade.direction === "long" ? "default" : "secondary"}>{trade.direction.toUpperCase()}</Badge>
                              {trade.isInvoluntary && <Badge variant="outline" className="border-amber-400 bg-amber-100 text-amber-800">Involuntary</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{time} · {trade.assetType ?? "other"} · {trade.quantityUnit ?? "units"}</p>
                          </div>
                          <p className={`shrink-0 text-sm font-semibold tabular-nums ${pnl > 0 ? "text-profit" : "text-loss"}`}>
                            {formatCurrency(pnl)}
                            {trade.pnlSource === "broker" && <span className="ml-1 text-[10px] text-muted-foreground">broker</span>}
                          </p>
                        </div>

                        <div className="grid grid-cols-4 gap-x-2 border-y py-2">
                          <div className="min-w-0"><span className="block truncate text-[10px] text-muted-foreground sm:text-xs">Entry</span><p className="truncate text-xs tabular-nums sm:text-sm" title={entryPrice}>{entryPrice}</p></div>
                          <div className="min-w-0"><span className="block truncate text-[10px] text-muted-foreground sm:text-xs">Exit</span><p className="truncate text-xs tabular-nums sm:text-sm" title={exitPrice}>{exitPrice}</p></div>
                          <div className="min-w-0"><span className="block truncate text-[10px] text-muted-foreground sm:text-xs">Quantity</span><p className="truncate text-xs tabular-nums sm:text-sm" title={quantity}>{quantity}</p></div>
                          <div className="min-w-0"><span className="block truncate text-[10px] text-muted-foreground sm:text-xs">Fees</span><p className="truncate text-xs tabular-nums sm:text-sm" title={fees}>{fees}</p></div>
                        </div>

                        <div className="flex items-center justify-end gap-1">
                          <TradeNotePreview symbol={trade.symbol} note={trade.notes} />
                          <TradeEntryForm trade={trade} />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(trade.id)}
                            aria-label={`Delete ${trade.symbol}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>

              <div className="hidden overflow-x-auto xl:block">
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
                      <TableHead>Note</TableHead>
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
                          <TableCell>
                            <TradeNotePreview symbol={trade.symbol} note={trade.notes} />
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
              </>
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
