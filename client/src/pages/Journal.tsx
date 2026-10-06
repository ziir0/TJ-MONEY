import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  FileText,
  Loader2,
  Save,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import TradeExport from "@/components/TradeExport";

const PSYCHOLOGY_TAGS = [
  { label: "Followed Plan", tag: "#FollowedPlan", color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20" },
  { label: "FOMO", tag: "#FOMO", color: "text-rose-400 border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20" },
  { label: "Patient Entry", tag: "#Patience", color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20" },
  { label: "Overtrading", tag: "#Overtrading", color: "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20" },
  { label: "Risk Managed", tag: "#RiskManaged", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20" },
  { label: "High News", tag: "#NewsEvent", color: "text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20" },
];

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function Journal() {
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString());
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedDateObject = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }, [selectedDate]);
  const { data: selectedBroker = typeof window !== "undefined" ? localStorage.getItem("active-broker") || "Bybit" : "Bybit" } =
    trpc.account.activeBroker.useQuery(undefined, { staleTime: 60_000 });

  const { data: trades = [] } = trpc.trades.list.useQuery();
  const brokerTrades = useMemo(
    () => trades.filter((trade) => selectedBroker === "All Brokers" || trade.broker === selectedBroker),
    [trades, selectedBroker],
  );

  const journalQuery = trpc.journal.getByDate.useQuery({
    date: selectedDateObject,
    broker: selectedBroker === "All Brokers" ? undefined : selectedBroker,
  });
  const { data: journalEntry, isLoading: isLoadingJournal } = journalQuery;

  useEffect(() => {
    setContent(journalEntry?.content ?? "");
  }, [journalEntry, selectedDate]);

  const upsertMutation = trpc.journal.upsert.useMutation({
    onSuccess: () => {
      toast.success("Journal entry saved");
      setIsSaving(false);
      void journalQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save journal entry");
      setIsSaving(false);
    },
  });

  const deleteMutation = trpc.journal.delete.useMutation({
    onSuccess: () => {
      toast.success("Journal entry deleted");
      setContent("");
      void journalQuery.refetch();
    },
    onError: (error) => toast.error(error.message || "Failed to delete journal entry"),
  });

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    setSelectedDate(newDate);
    setContent("");
  };

  const shiftDate = useCallback((days: number) => {
    setSelectedDate((prevDate) => shiftDateString(prevDate, days));
  }, []);

  const jumpToToday = useCallback(() => {
    setSelectedDate(getLocalDateString());
  }, []);

  // Filter trades for selected date (in local or ISO string comparison)
  const selectedDateTrades = useMemo(() => {
    return brokerTrades.filter((trade) => {
      const date = new Date(trade.tradeDate);
      const localDateStr = getLocalDateString(date);
      const isoDateStr = date.toISOString().split("T")[0];
      return localDateStr === selectedDate || isoDateStr === selectedDate;
    });
  }, [brokerTrades, selectedDate]);

  // Daily stats calculation
  const dailyStats = useMemo(() => {
    if (selectedDateTrades.length === 0) {
      return { totalPnL: 0, wins: 0, losses: 0, tradeCount: 0, winRate: 0, avgWin: 0, avgLoss: 0 };
    }

    let totalPnL = 0;
    let wins = 0;
    let losses = 0;
    let grossWin = 0;
    let grossLoss = 0;

    selectedDateTrades.forEach((trade) => {
      const pnl = parseFloat(trade.pnl || "0");
      totalPnL += pnl;
      if (pnl > 0) {
        wins++;
        grossWin += pnl;
      } else if (pnl < 0) {
        losses++;
        grossLoss += Math.abs(pnl);
      }
    });

    return {
      totalPnL,
      wins,
      losses,
      tradeCount: selectedDateTrades.length,
      winRate: (wins / selectedDateTrades.length) * 100,
      avgWin: wins > 0 ? grossWin / wins : 0,
      avgLoss: losses > 0 ? grossLoss / losses : 0,
    };
  }, [selectedDateTrades]);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("Please enter some journal notes");
      return;
    }

    setIsSaving(true);
    upsertMutation.mutate({
      date: selectedDateObject,
      content,
      broker: selectedBroker === "All Brokers" ? "Bybit" : selectedBroker,
    });
  };

  const handleTagClick = (tag: string) => {
    setContent((prev) => {
      if (prev.includes(tag)) {
        return prev;
      }
      const separator = prev.trim() ? " " : "";
      return `${prev.trim()}${separator}${tag}\n`;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Keyboard shortcut: Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        if (content.trim() && !isSaving) {
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [content, isSaving]);

  const wordCount = useMemo(() => {
    const trimmed = content.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [content]);

  const formattedDateHeader = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }, [selectedDate]);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trading Journal</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Daily logs, execution notes, and psychological reflections for{" "}
            <span className="font-semibold text-foreground">{selectedBroker === "All Brokers" ? "all brokers" : selectedBroker}</span>.
          </p>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-card/95 p-1.5 shadow-sm dark:bg-[#0a1220]">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => shiftDate(-1)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="relative flex items-center">
            <CalendarIcon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="journal-date"
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="h-8 w-[165px] sm:w-[170px] pl-7 pr-1.5 text-xs font-mono bg-background/50 border-border/50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => shiftDate(1)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={jumpToToday}
            className="h-8 px-2.5 text-xs font-semibold"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Split View: Notes (Left 2 cols) + Scorecard & Execution Timeline (Right 1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Daily Notes & Psychology Terminal */}
        <Card className="terminal-card border-border/70 bg-card/95 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <CardHeader className="border-b border-border/70 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400 shadow-[0_0_12px_rgba(139,92,246,0.25)]">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold tracking-tight">Daily Notes</CardTitle>
                  <CardDescription className="text-xs">{formattedDateHeader}</CardDescription>
                </div>
              </div>
              {journalEntry && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Logged
                </span>
              )}
            </div>

            {/* Quick Psychology Tags */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                <Tag className="h-3 w-3" /> Tags:
              </span>
              {PSYCHOLOGY_TAGS.map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => handleTagClick(item.tag)}
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-all ${item.color}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col">
            {isLoadingJournal ? (
              <Skeleton className="h-72 w-full rounded-lg" />
            ) : (
              <>
                <div className="space-y-1.5 flex-1 flex flex-col">
                  <Textarea
                    id="journal-content"
                    placeholder="Document your pre-market bias, mindset, trade setups executed, rules followed/broken, and key takeaways..."
                    className="min-h-[280px] flex-1 resize-none rounded-lg border-border/70 bg-background/50 font-sans text-sm leading-relaxed p-3.5 focus-visible:ring-1 focus-visible:ring-primary"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span>{wordCount} words</span>
                    <span>·</span>
                    <span>{content.length} characters</span>
                    <span className="hidden sm:inline">·</span>
                    <span className="hidden sm:inline text-muted-foreground/80">Press ⌘S / Ctrl+S to save</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {journalEntry && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (window.confirm("Delete this journal entry?")) {
                            deleteMutation.mutate({ id: journalEntry.id });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="h-8 gap-1.5 text-xs text-loss hover:text-loss border-border/60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving || !content.trim()}
                      className="h-8 gap-1.5 px-3 text-xs font-semibold shadow-[0_0_12px_rgba(139,92,246,0.3)]"
                    >
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Entry
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Daily Performance Scorecard & Trade Timeline */}
        <div className="space-y-6">
          <Card className="terminal-card border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 p-4 sm:p-5">
              <div>
                <CardTitle className="text-base font-bold tracking-tight">Daily Performance</CardTitle>
                <CardDescription className="text-xs">{selectedDate}</CardDescription>
              </div>
              <TradeExport trades={selectedDateTrades} showTrades={false} />
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Daily Realized P&L Banner */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  dailyStats.totalPnL > 0
                    ? "border-profit/30 bg-profit/10 glow-emerald"
                    : dailyStats.totalPnL < 0
                      ? "border-loss/30 bg-loss/10 glow-rose"
                      : "border-border/60 bg-muted/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Daily Realized P&L</span>
                  {dailyStats.totalPnL >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-profit" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-loss" />
                  )}
                </div>
                <p
                  className={`mt-1 font-mono text-3xl font-bold tracking-tight tabular-nums ${
                    dailyStats.totalPnL > 0 ? "text-profit" : dailyStats.totalPnL < 0 ? "text-loss" : "text-foreground"
                  }`}
                >
                  {formatCurrency(dailyStats.totalPnL)}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>{dailyStats.tradeCount} trade{dailyStats.tradeCount === 1 ? "" : "s"}</span>
                  <span>{dailyStats.winRate.toFixed(0)}% Win Rate</span>
                </div>
              </div>

              {/* Stats breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Winners</p>
                  <p className="font-mono text-base font-bold text-profit tabular-nums mt-0.5">{dailyStats.wins}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Losers</p>
                  <p className="font-mono text-base font-bold text-loss tabular-nums mt-0.5">{dailyStats.losses}</p>
                </div>
              </div>

              {/* Trade Execution Timeline */}
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Executed Trades</span>
                  <span className="text-[11px] font-mono text-muted-foreground">{selectedDateTrades.length} Total</span>
                </div>

                {selectedDateTrades.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                    <Clock className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
                    No trades logged for this date.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {selectedDateTrades.map((trade) => {
                      const pnl = parseFloat(trade.pnl || "0");
                      const isLong = trade.direction === "long";
                      const DirectionIcon = isLong ? ArrowUpRight : ArrowDownRight;
                      const timeStr = new Date(trade.tradeDate).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <div
                          key={trade.id}
                          className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 p-2.5 text-xs hover:bg-muted/40 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold ${
                                isLong ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
                              }`}
                            >
                              <DirectionIcon className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <p className="font-bold tracking-tight">{trade.symbol}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">{timeStr} · {isLong ? "CALL" : "PUT"}</p>
                            </div>
                          </div>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${
                              pnl > 0 ? "text-profit" : pnl < 0 ? "text-loss" : "text-foreground"
                            }`}
                          >
                            {formatCurrency(pnl)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
