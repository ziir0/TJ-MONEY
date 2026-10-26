import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  CircleAlert,
  Download,
  Filter,
  ImageIcon,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { filterTradesByBroker, filterTradesByDatePreset, summarizeTrades, type AnalyticsTrade } from "@/lib/tradingAnalytics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import ZoomableScreenshot from "@/components/ZoomableScreenshot";
import { toast } from "sonner";
import CSVImport from "@/components/CSVImport";
import TradeExport from "@/components/TradeExport";
import TradeEntryForm from "@/components/TradeEntryForm";
import { useGlobalToolbar } from "@/contexts/GlobalToolbarContext";

type SortField = "tradeDate" | "symbol" | "pnl" | "entryPrice" | "quantity";
type SortDirection = "asc" | "desc";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function londonDateTime(value: Date | string | number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TradeNotePopover({ symbol, note }: { symbol: string; note?: string | null }) {
  const text = note?.trim() || "No notes recorded for this trade.";
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              aria-label={`Preview note for ${symbol}`}
            >
              <CircleAlert className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="max-h-64 max-w-sm overflow-y-auto whitespace-pre-wrap text-xs">
        <p className="font-semibold text-foreground mb-1">Notes ({symbol})</p>
        <p className="text-muted-foreground">{text}</p>
      </PopoverContent>
    </Popover>
  );
}

export default function Trades() {
  const { data: selectedBroker = typeof window !== "undefined" ? localStorage.getItem("active-broker") || "Bybit" : "Bybit" } =
    trpc.account.activeBroker.useQuery(undefined, { staleTime: 60_000 });
  const { data: allTrades = [], isLoading } = trpc.trades.list.useQuery();
  const utils = trpc.useUtils();
  const {
    selectedDate,
    selectedPeriod,
    periodLabel,
    searchQuery,
    directionFilter,
    outcomeFilter,
    assetFilter,
    hasTradeFilters,
    resetTradeFilters,
  } = useGlobalToolbar();

  // Search & Filter state
  const [sortField, setSortField] = useState<SortField>("tradeDate");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  useEffect(() => {
    setPage(1);
  }, [selectedDate, selectedPeriod, searchQuery, directionFilter, outcomeFilter, assetFilter]);

  // Modals & previews
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [previewScreenshotKey, setPreviewScreenshotKey] = useState<string | null>(null);

  const deleteMutation = trpc.trades.delete.useMutation({
    onSuccess: () => {
      toast.success("Trade deleted successfully");
      setDeleteId(null);
      void utils.trades.list.invalidate();
      void utils.stats.calculate.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to delete trade"),
  });

  const { data: screenshotUrls = {} } = trpc.trades.screenshotUrls.useQuery(
    { keys: previewScreenshotKey ? [previewScreenshotKey] : [], variant: "original" },
    { enabled: Boolean(previewScreenshotKey), staleTime: 20 * 60 * 60 * 1000 }
  );

  // Filter trades by active broker
  const brokerTrades = useMemo(
    () => filterTradesByDatePreset(filterTradesByBroker(allTrades, selectedBroker), selectedPeriod, selectedDate),
    [allTrades, selectedBroker, selectedDate, selectedPeriod]
  );

  // Apply search and filters
  const filteredTrades = useMemo(() => {
    return brokerTrades.filter((trade) => {
      // Search query (symbol or notes)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const symbolMatch = trade.symbol.toLowerCase().includes(query);
        const notesMatch = (trade.notes ?? "").toLowerCase().includes(query);
        if (!symbolMatch && !notesMatch) return false;
      }

      // Direction
      if (directionFilter !== "all" && trade.direction !== directionFilter) {
        return false;
      }

      // Outcome
      if (outcomeFilter !== "all") {
        const pnl = Number(trade.pnl || 0);
        if (outcomeFilter === "win" && pnl <= 0) return false;
        if (outcomeFilter === "loss" && pnl >= 0) return false;
        if (outcomeFilter === "breakeven" && pnl !== 0) return false;
      }

      // Asset type
      if (assetFilter !== "all" && trade.assetType !== assetFilter) {
        return false;
      }

      return true;
    });
  }, [brokerTrades, searchQuery, directionFilter, outcomeFilter, assetFilter]);

  // Sort trades
  const sortedTrades = useMemo(() => {
    return [...filteredTrades].sort((a, b) => {
      let comparison = 0;
      if (sortField === "tradeDate") {
        comparison = new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime();
      } else if (sortField === "symbol") {
        comparison = a.symbol.localeCompare(b.symbol);
      } else if (sortField === "pnl") {
        comparison = Number(a.pnl || 0) - Number(b.pnl || 0);
      } else if (sortField === "entryPrice") {
        comparison = Number(a.entryPrice || 0) - Number(b.entryPrice || 0);
      } else if (sortField === "quantity") {
        comparison = Number(a.quantity || 0) - Number(b.quantity || 0);
      }
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [filteredTrades, sortField, sortDir]);

  // Paginated trades
  const totalTrades = sortedTrades.length;
  const totalPages = Math.max(1, Math.ceil(totalTrades / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedTrades = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedTrades.slice(startIndex, startIndex + pageSize);
  }, [sortedTrades, currentPage, pageSize]);

  // Filtered stats
  const filteredStats = useMemo(() => summarizeTrades(filteredTrades), [filteredTrades]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const hasActiveFilters = hasTradeFilters;

  const resetFilters = () => {
    resetTradeFilters();
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Trades Log</h1>
            <Badge variant="outline" className="border-border/80 font-mono text-xs text-muted-foreground">
              {selectedBroker}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Trades for {periodLabel} · audit, filter, and inspect your execution history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CSVImport />
          <TradeExport trades={filteredTrades} showSummary={false} />
          <TradeEntryForm />
        </div>
      </div>

      {/* Filtered Metrics Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Filtered P&L</p>
          <p className={`mt-1 truncate text-2xl font-bold tabular-nums sm:text-3xl ${filteredStats.totalPnl >= 0 ? "text-profit" : "text-loss"}`}>
            {formatCurrency(filteredStats.totalPnl)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {filteredStats.winCount}W · {filteredStats.lossCount}L
          </p>
        </Card>

        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Win Rate</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
            {filteredStats.winRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {filteredStats.tradeCount} trades total
          </p>
        </Card>

        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Profit Factor</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
            {Number.isFinite(filteredStats.profitFactor) ? filteredStats.profitFactor.toFixed(2) : "∞"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Gross win / loss ratio
          </p>
        </Card>

        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Avg Win</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-profit sm:text-3xl">
            {formatCurrency(filteredStats.averageWin)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Per winning trade</p>
        </Card>

        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4 col-span-2 sm:col-span-4 lg:col-span-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Avg Loss</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-loss sm:text-3xl">
            {formatCurrency(filteredStats.averageLoss)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Per losing trade</p>
        </Card>
      </div>

      {/* Main Table View */}
      <Card className="terminal-card overflow-hidden border-border/70 bg-card/90 shadow-sm">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filteredTrades.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No trades match your filters"
            description="Try a different date range or adjust your search, direction, outcome, or asset filters."
            actionLabel={hasActiveFilters ? "Clear All Filters" : undefined}
            onAction={hasActiveFilters ? resetFilters : undefined}
            className="py-16"
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="w-[140px] cursor-pointer" onClick={() => toggleSort("tradeDate")}>
                      <div className="flex items-center gap-1.5">
                        <span>Date / Time</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("symbol")}>
                      <div className="flex items-center gap-1.5">
                        <span>Symbol</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("entryPrice")}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Entry</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Exit</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("quantity")}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Qty</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("pnl")}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Net P&L</span>
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-[50px]">Notes</TableHead>
                    <TableHead className="text-center w-[50px]">Chart</TableHead>
                    <TableHead className="text-right w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTrades.map((trade: any) => {
                    const isLong = trade.direction === "long";
                    const pnl = Number(trade.pnl || 0);
                    const isWin = pnl > 0;
                    const isLoss = pnl < 0;
                    const screenshots = [trade.screenshot1, trade.screenshot2].filter(Boolean);

                    return (
                      <TableRow
                        key={trade.id}
                        className={`border-border/40 hover:bg-muted/30 transition-colors ${
                          trade.isInvoluntary ? "bg-amber-500/5 hover:bg-amber-500/10" : ""
                        }`}
                      >
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {londonDateTime(trade.tradeDate)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground tracking-tight">{trade.symbol}</span>
                            {trade.isInvoluntary && (
                              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-[10px] px-1 py-0">
                                Invol
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold tracking-wide border-0 ${
                                isLong ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
                              }`}
                            >
                              {isLong ? (
                                <><ArrowUpRight className="h-3 w-3 mr-0.5 inline" />CALL</>
                              ) : (
                                <><ArrowDownRight className="h-3 w-3 mr-0.5 inline" />PUT</>
                              )}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground uppercase">{trade.assetType ?? "other"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatCurrency(Number(trade.entryPrice))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatCurrency(Number(trade.exitPrice))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {trade.quantity} <span className="text-[10px] text-muted-foreground">{trade.quantityUnit ?? "u"}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(Number(trade.fees || 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-mono text-sm font-bold tabular-nums ${
                              isWin ? "text-profit" : isLoss ? "text-loss" : "text-muted-foreground"
                            }`}
                          >
                            {formatCurrency(pnl)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {trade.notes ? (
                            <TradeNotePopover symbol={trade.symbol} note={trade.notes} />
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {screenshots.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-7 w-7 text-primary hover:text-primary/80"
                              onClick={() => setPreviewScreenshotKey(screenshots[0])}
                              aria-label={`View screenshot for ${trade.symbol}`}
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TradeEntryForm trade={trade} />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-7 w-7 text-muted-foreground hover:text-loss"
                              onClick={() => setDeleteId(trade.id)}
                              aria-label={`Delete trade ${trade.symbol}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card List */}
            <div className="divide-y divide-border/40 md:hidden">
              {paginatedTrades.map((trade: any) => {
                const isLong = trade.direction === "long";
                const pnl = Number(trade.pnl || 0);
                const isWin = pnl > 0;
                const isLoss = pnl < 0;
                const screenshots = [trade.screenshot1, trade.screenshot2].filter(Boolean);

                return (
                  <article key={trade.id} className="p-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground">{trade.symbol}</span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-semibold border-0 ${
                              isLong ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
                            }`}
                          >
                            {isLong ? "CALL" : "PUT"}
                          </Badge>
                          {trade.isInvoluntary && (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-500 text-[9px] px-1">
                              Invol
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {londonDateTime(trade.tradeDate)} · {trade.assetType ?? "other"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-base font-bold tabular-nums ${isWin ? "text-profit" : isLoss ? "text-loss" : "text-muted-foreground"}`}>
                          {formatCurrency(pnl)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Qty: {trade.quantity}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded bg-muted/20 p-2 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Entry</span>
                        <span className="font-mono text-xs tabular-nums">{formatCurrency(Number(trade.entryPrice))}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Exit</span>
                        <span className="font-mono text-xs tabular-nums">{formatCurrency(Number(trade.exitPrice))}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Fees</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatCurrency(Number(trade.fees || 0))}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        {trade.notes && <TradeNotePopover symbol={trade.symbol} note={trade.notes} />}
                        {screenshots.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs text-primary"
                            onClick={() => setPreviewScreenshotKey(screenshots[0])}
                          >
                            <ImageIcon className="h-3.5 w-3.5" /> Chart
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <TradeEntryForm trade={trade} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 text-loss"
                          onClick={() => setDeleteId(trade.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col gap-3 border-t border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalTrades)} of {totalTrades} executions
                </span>
                <span className="hidden sm:inline">·</span>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span>Per page:</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => {
                      setPageSize(Number(val));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-7 w-16 bg-background/60 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="9">9</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5 text-xs"
                >
                  Previous
                </Button>
                <span className="px-2 text-xs text-muted-foreground font-mono">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Screenshot Lightbox Modal */}
      <Dialog open={Boolean(previewScreenshotKey)} onOpenChange={(open) => !open && setPreviewScreenshotKey(null)}>
        <DialogContent className="flex h-[90vh] h-[90dvh] max-h-[1000px] w-[96vw] max-w-[1400px] flex-col gap-3 overflow-hidden p-3 sm:max-w-[1400px] sm:p-5">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle className="text-sm font-semibold">Trade Screenshot</DialogTitle>
            <DialogDescription className="text-xs">High-resolution capture · use the buttons or pinch to zoom, then drag to pan</DialogDescription>
          </DialogHeader>
          {previewScreenshotKey && (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {screenshotUrls[previewScreenshotKey] ? (
                <ZoomableScreenshot
                  key={previewScreenshotKey}
                  src={screenshotUrls[previewScreenshotKey]}
                  alt="Execution chart capture"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4 animate-spin" /> Loading screenshot...
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete execution record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone and will recalculate your cumulative P&L and metrics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete trade"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
