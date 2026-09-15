import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function Analytics() {
  const { data: trades, isLoading } = trpc.trades.list.useQuery();

  // Calculate cumulative P&L
  const cumulativePnL = useMemo(() => {
    if (!trades) return [];

    const sorted = [...trades].sort((a, b) => 
      new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
    );

    let cumulative = 0;
    return sorted.map((trade) => {
      cumulative += parseFloat(trade.pnl);
      return {
        date: new Date(trade.tradeDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        pnl: cumulative,
      };
    });
  }, [trades]);

  // P&L by day of week
  const pnlByDayOfWeek = useMemo(() => {
    if (!trades) return [];

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayStats = new Map<number, { total: number; count: number }>();

    trades.forEach((trade) => {
      const dayOfWeek = new Date(trade.tradeDate).getDay();
      const pnl = parseFloat(trade.pnl);

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
  }, [trades]);

  // Win/Loss distribution
  const winLossData = useMemo(() => {
    if (!trades) return [];

    let wins = 0;
    let losses = 0;
    let breakeven = 0;

    trades.forEach((trade) => {
      const pnl = parseFloat(trade.pnl);
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
      else breakeven++;
    });

    return [
      { name: "Wins", value: wins, color: "#22c55e" },
      { name: "Losses", value: losses, color: "#ef4444" },
      { name: "Breakeven", value: breakeven, color: "#a1a1a1" },
    ];
  }, [trades]);

  // Trade duration distribution, using entry and optional exit timestamps.
  const durationData = useMemo(() => {
    const buckets = [
      { name: "Unknown", value: 0, color: "#a1a1a1" },
      { name: "< 15m", value: 0, color: "#8b5cf6" },
      { name: "15–60m", value: 0, color: "#6366f1" },
      { name: "1–4h", value: 0, color: "#14b8a6" },
      { name: "4h+", value: 0, color: "#22c55e" },
    ];

    (trades ?? []).forEach((trade) => {
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
  }, [trades]);

  // Trade stats
  const tradeStats = useMemo(() => {
    if (!trades || trades.length === 0) return { avgTrades: 0, totalPnL: 0, winRate: 0 };

    const totalPnL = trades.reduce((sum, trade) => sum + parseFloat(trade.pnl), 0);
    const wins = trades.filter((trade) => parseFloat(trade.pnl) > 0).length;
    const winRate = (wins / trades.length) * 100;

    return {
      avgTrades: trades.length,
      totalPnL,
      winRate,
    };
  }, [trades]);

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

  if (!trades || trades.length === 0) {
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
          Comprehensive performance analysis and insights
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <CardDescription>Trade outcome breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={winLossData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
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
              Add an exit date and time when recording a trade to include it in duration analysis.
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
                <span className="font-semibold">{trades.length}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Winning Trades</span>
                <span className="font-semibold text-profit">
                  {trades.filter((t) => parseFloat(t.pnl) > 0).length}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Losing Trades</span>
                <span className="font-semibold text-loss">
                  {trades.filter((t) => parseFloat(t.pnl) < 0).length}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-sm text-muted-foreground">Avg Win</span>
                <span className="font-semibold text-profit">
                  {formatCurrency(
                    trades
                      .filter((t) => parseFloat(t.pnl) > 0)
                      .reduce((sum, t) => sum + parseFloat(t.pnl), 0) /
                      (trades.filter((t) => parseFloat(t.pnl) > 0).length || 1)
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Loss</span>
                <span className="font-semibold text-loss">
                  {formatCurrency(
                    trades
                      .filter((t) => parseFloat(t.pnl) < 0)
                      .reduce((sum, t) => sum + parseFloat(t.pnl), 0) /
                      (trades.filter((t) => parseFloat(t.pnl) < 0).length || 1)
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
