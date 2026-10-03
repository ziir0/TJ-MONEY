import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { filterTradesByBroker, summarizeTrades, type AnalyticsTrade } from "@/lib/tradingAnalytics";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ScreenshotAnalyticsTrade = AnalyticsTrade & {
  screenshot1?: string | null;
  screenshot2?: string | null;
};

function ScreenshotTradeGrid({
  trades,
  previewUrls,
  formatCurrency,
  onSelectImage,
}: {
  trades: ScreenshotAnalyticsTrade[];
  previewUrls: Record<string, string>;
  formatCurrency: (value: number) => string;
  onSelectImage: (key: string, description: string) => void;
}) {
  if (trades.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No screenshots in this gallery yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
      {trades.map((trade) => {
        const screenshots = [trade.screenshot1, trade.screenshot2]
          .filter((key): key is string => Boolean(key));
        const pnl = Number(trade.pnl || 0);
        const outcome = pnl > 0 ? "Winning" : "Losing";
        return (
          <article key={trade.id} className="overflow-hidden rounded-md border bg-background">
            <div className={`grid gap-px bg-border ${screenshots.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {screenshots.map((key, index) => {
                const description = `${trade.symbol} ${outcome.toLowerCase()} trade screenshot ${index + 1}`;
                const previewUrl = previewUrls[key];
                return (
                  <button key={key} type="button" className="aspect-video min-w-0 bg-muted p-1" onClick={() => onSelectImage(key, description)} aria-label={`View ${description}`}>
                    {previewUrl
                      ? <img src={previewUrl} alt={description} loading="lazy" decoding="async" className="h-full w-full object-contain" />
                      : <div className="h-full w-full animate-pulse rounded-sm bg-muted-foreground/10" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{trade.symbol}</p>
                <p className="text-xs text-muted-foreground">{new Date(trade.tradeDate).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{screenshots.length} screenshot{screenshots.length === 1 ? "" : "s"}</p>
              </div>
              <p className={`shrink-0 text-sm font-semibold ${pnl >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(pnl)}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const { data: trades = [], isLoading } = trpc.trades.list.useQuery();
  const { data: selectedBroker = "Bybit" } = trpc.account.activeBroker.useQuery();
  const [selectedImage, setSelectedImage] = useState<{ key: string; description: string } | null>(null);
  const [galleryTab, setGalleryTab] = useState("wins");

  const brokerTrades = useMemo(() => filterTradesByBroker(trades, selectedBroker), [trades, selectedBroker]);
  const screenshotTrades = brokerTrades as ScreenshotAnalyticsTrade[];
  const winScreenshotTrades = screenshotTrades.filter((trade) => Number(trade.pnl || 0) > 0 && (trade.screenshot1 || trade.screenshot2));
  const lossScreenshotTrades = screenshotTrades.filter((trade) => Number(trade.pnl || 0) < 0 && (trade.screenshot1 || trade.screenshot2));
  const activeScreenshotTrades = galleryTab === "wins" ? winScreenshotTrades : lossScreenshotTrades;
  const screenshotKeys = useMemo(
    () => activeScreenshotTrades.flatMap((trade) => [trade.screenshot1, trade.screenshot2].filter((key): key is string => Boolean(key))),
    [activeScreenshotTrades],
  );
  const { data: screenshotPreviewUrls = {} } = trpc.trades.screenshotUrls.useQuery(
    { keys: screenshotKeys, variant: "thumbnail" },
    { enabled: screenshotKeys.length > 0, staleTime: 20 * 60 * 60 * 1000 },
  );
  const originalScreenshotKeys = useMemo(() => selectedImage ? [selectedImage.key] : [], [selectedImage]);
  const { data: originalScreenshotUrls = {}, isError: originalScreenshotError } = trpc.trades.screenshotUrls.useQuery(
    { keys: originalScreenshotKeys, variant: "original" },
    { enabled: originalScreenshotKeys.length > 0, staleTime: 20 * 60 * 60 * 1000 },
  );

  // Calculate cumulative P&L
  const cumulativePnL = useMemo(() => {
    if (!brokerTrades) return [];

    const sorted = [...brokerTrades].sort((a, b) =>
      new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
    );

    let cumulative = 0;
    return sorted.map((trade) => {
      cumulative += Number(trade.pnl || 0);
      return {
        date: new Date(trade.tradeDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        pnl: cumulative,
      };
    });
  }, [brokerTrades]);

  // P&L by day of week
  const pnlByDayOfWeek = useMemo(() => {
    if (!brokerTrades) return [];

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayStats = new Map<number, { total: number; count: number }>();

    brokerTrades.forEach((trade) => {
      const dayOfWeek = new Date(trade.tradeDate).getDay();
      const pnl = Number(trade.pnl || 0);

      if (!dayStats.has(dayOfWeek)) {
        dayStats.set(dayOfWeek, { total: 0, count: 0 });
      }

      const stats = dayStats.get(dayOfWeek)!;
      stats.total += pnl;
      stats.count += 1;
    });

    return days.map((day, index) => {
      const stats = dayStats.get(index);
      return {
        day: day.slice(0, 3),
        avgPnL: stats ? stats.total / stats.count : 0,
        total: stats ? stats.total : 0,
      };
    });
  }, [brokerTrades]);

  // Win/Loss distribution
  const winLossData = useMemo(() => {
    if (!brokerTrades) return [];

    let wins = 0;
    let losses = 0;
    let breakeven = 0;

    brokerTrades.forEach((trade) => {
      const pnl = Number(trade.pnl || 0);
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
      else breakeven++;
    });

    return [
      { name: "Wins", value: wins, color: "#22c55e" },
      { name: "Losses", value: losses, color: "#ef4444" },
      { name: "Breakeven", value: breakeven, color: "#a1a1a1" },
    ];
  }, [brokerTrades]);

  // Trade duration distribution, using entry and optional exit timestamps.
  const durationData = useMemo(() => {
    const buckets = [
      { name: "Not recorded", value: 0, color: "#a1a1a1" },
      { name: "< 15m", value: 0, color: "#8b5cf6" },
      { name: "15–60m", value: 0, color: "#6366f1" },
      { name: "1–4h", value: 0, color: "#14b8a6" },
      { name: "4h+", value: 0, color: "#22c55e" },
    ];

    (brokerTrades ?? []).forEach((trade) => {
      if (!trade.exitDate) {
        buckets[0].value += 1;
        return;
      }

      const durationMinutes = (new Date(trade.exitDate).getTime() - new Date(trade.tradeDate).getTime()) / 60000;
      if (!Number.isFinite(durationMinutes) || durationMinutes < 0) {
        buckets[0].value += 1;
      } else if (durationMinutes < 15) {
        buckets[1].value += 1;
      } else if (durationMinutes < 60) {
        buckets[2].value += 1;
      } else if (durationMinutes < 240) {
        buckets[3].value += 1;
      } else {
        buckets[4].value += 1;
      }
    });

    return buckets;
  }, [brokerTrades]);

  // Trade stats
  const tradeStats = useMemo(() => {
    if (!brokerTrades || brokerTrades.length === 0) return { avgTrades: 0, totalPnL: 0, winRate: 0 };

    const totalPnL = brokerTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    const wins = brokerTrades.filter((trade) => Number(trade.pnl || 0) > 0).length;
    const winRate = (wins / brokerTrades.length) * 100;

    return {
      avgTrades: brokerTrades.length,
      totalPnL,
      winRate,
    };
  }, [brokerTrades]);

  const involuntaryComparison = useMemo(() => {
    const allTrades = (brokerTrades ?? []) as AnalyticsTrade[];
    const voluntaryTrades = allTrades.filter((trade) => !trade.isInvoluntary);
    const allSummary = summarizeTrades(allTrades);
    const voluntarySummary = summarizeTrades(voluntaryTrades);

    return {
      allSummary,
      voluntarySummary,
      involuntaryTrades: allTrades.length - voluntaryTrades.length,
      involuntaryPnl: allSummary.totalPnl - voluntarySummary.totalPnl,
    };
  }, [brokerTrades]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  if (!brokerTrades || brokerTrades.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <p>No trades recorded yet. Start trading to see analytics.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive performance analysis for {selectedBroker === "All Brokers" ? "all brokers" : selectedBroker}.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{tradeStats.avgTrades}</div>
            <p className="text-xs text-muted-foreground mt-1">trades analyzed</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{tradeStats.winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">winning trades</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${tradeStats.totalPnL > 0 ? "text-profit" : "text-loss"}`}>
              {formatCurrency(tradeStats.totalPnL)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">cumulative profit/loss</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Impact of Involuntary Trades</CardTitle>
          <CardDescription>
            Compare your actual result with the result excluding trades marked as involuntary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">With involuntary trades</p>
              <p className={`text-2xl font-bold mt-1 ${involuntaryComparison.allSummary.totalPnl >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(involuntaryComparison.allSummary.totalPnl)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {involuntaryComparison.allSummary.tradeCount} trades · {involuntaryComparison.allSummary.winRate.toFixed(1)}% win rate
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Without involuntary trades</p>
              <p className={`text-2xl font-bold mt-1 ${involuntaryComparison.voluntarySummary.totalPnl >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(involuntaryComparison.voluntarySummary.totalPnl)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {involuntaryComparison.voluntarySummary.tradeCount} trades · {involuntaryComparison.voluntarySummary.winRate.toFixed(1)}% win rate
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">Involuntary trade impact</p>
              <p className={`text-2xl font-bold mt-1 ${involuntaryComparison.involuntaryPnl >= 0 ? "text-profit" : "text-loss"}`}>
                {formatCurrency(involuntaryComparison.involuntaryPnl)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {involuntaryComparison.involuntaryTrades} marked trade{involuntaryComparison.involuntaryTrades === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Trade Screenshot Gallery</CardTitle>
            <CardDescription>Review chart captures for winning and losing trades.</CardDescription>
          </div>
          <div className="flex items-center rounded-lg border bg-muted/30 p-1" role="tablist" aria-label="Trade screenshot results">
            <Button type="button" role="tab" aria-selected={galleryTab === "wins"} variant={galleryTab === "wins" ? "default" : "ghost"} size="sm" className="h-8 px-3 text-xs" onClick={() => setGalleryTab("wins")}>
              Wins ({winScreenshotTrades.length})
            </Button>
            <Button type="button" role="tab" aria-selected={galleryTab === "losses"} variant={galleryTab === "losses" ? "default" : "ghost"} size="sm" className="h-8 px-3 text-xs" onClick={() => setGalleryTab("losses")}>
              Losses ({lossScreenshotTrades.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div role="tabpanel" aria-label={galleryTab === "wins" ? "Winning trades gallery" : "Losing trades gallery"}>
            {galleryTab === "wins" ? (
              <ScreenshotTradeGrid trades={winScreenshotTrades} previewUrls={screenshotPreviewUrls} formatCurrency={formatCurrency} onSelectImage={(key, description) => setSelectedImage({ key, description })} />
            ) : (
              <ScreenshotTradeGrid trades={lossScreenshotTrades} previewUrls={screenshotPreviewUrls} formatCurrency={formatCurrency} onSelectImage={(key, description) => setSelectedImage({ key, description })} />
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={selectedImage !== null} onOpenChange={(open) => { if (!open) setSelectedImage(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Trade screenshot</DialogTitle>
            <DialogDescription>{selectedImage?.description}</DialogDescription>
          </DialogHeader>
          {selectedImage && (originalScreenshotUrls[selectedImage.key]
            ? <img src={originalScreenshotUrls[selectedImage.key]} alt={selectedImage.description} className="max-h-[75vh] w-full object-contain" />
            : <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground" role="status">
                {originalScreenshotError ? "Screenshot unavailable." : "Loading screenshot..."}
              </div>)}
        </DialogContent>
      </Dialog>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cumulative P&L Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Cumulative P&L</CardTitle>
            <CardDescription>Running total of profit and loss over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cumulativePnL}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke="#7c3aed"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* P&L by Day of Week */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>P&L by Day of Week</CardTitle>
            <CardDescription>Average performance by day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pnlByDayOfWeek}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="avgPnL" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Win/Loss Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Win/Loss Distribution</CardTitle>
              <CardDescription>Trade outcome breakdown by count and percentage</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={winLossData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value} (${brokerTrades.length ? ((Number(value) / brokerTrades.length) * 100).toFixed(0) : 0}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {winLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trade Duration Analysis */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Trade Duration Analysis</CardTitle>
            <CardDescription>How long your trades stay open</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={durationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Trades" fill="#14b8a6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              “Not recorded” means the trade has no exit date/time. Add an exit timestamp when editing a trade to measure its duration.
            </p>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>Key trading statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Total Trades</span>
                <span className="font-semibold">{brokerTrades.length}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Winning Trades</span>
                <span className="font-semibold text-profit">
                  {brokerTrades.filter((trade) => Number(trade.pnl) > 0).length}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Losing Trades</span>
                <span className="font-semibold text-loss">
                  {brokerTrades.filter((trade) => Number(trade.pnl) < 0).length}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Avg Win</span>
                <span className="font-semibold text-profit">
                  {formatCurrency(
                    brokerTrades
                      .filter((trade) => Number(trade.pnl) > 0)
                      .reduce((sum, trade) => sum + Number(trade.pnl), 0) /
                      (brokerTrades.filter((trade) => Number(trade.pnl) > 0).length || 1)
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Loss</span>
                <span className="font-semibold text-loss">
                  {formatCurrency(
                    brokerTrades
                      .filter((trade) => Number(trade.pnl) < 0)
                      .reduce((sum, trade) => sum + Number(trade.pnl), 0) /
                      (brokerTrades.filter((trade) => Number(trade.pnl) < 0).length || 1)
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
