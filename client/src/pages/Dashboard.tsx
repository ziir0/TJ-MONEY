import React, { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Layers,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  buildEquityCurve,
  calculateBrokerSummary,
  filterTradesByBroker,
  summarizeTrades,
  type AnalyticsTrade,
  type BrokerMovement,
} from "@/lib/tradingAnalytics";

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_PERIODS = [7, 30, 90] as const;

type MetricTone = "rose" | "teal" | "blue" | "amber" | "violet" | "green" | "cyan";

type DashboardMetric = {
  title: string;
  value: string;
  detail: string;
  change: number | null;
  icon: LucideIcon;
  tone: MetricTone;
  valueClass?: string;
};

const metricToneClasses: Record<MetricTone, { card: string; icon: string }> = {
  rose: {
    card: "border-rose-500/25 bg-gradient-to-br from-rose-500/10 via-card to-card dark:from-rose-950/50 dark:via-[#0c1422] dark:to-[#08101d]",
    icon: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  },
  teal: {
    card: "border-teal-500/25 bg-gradient-to-br from-teal-500/10 via-card to-card dark:from-teal-950/50 dark:via-[#0c1722] dark:to-[#08101d]",
    icon: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  },
  blue: {
    card: "border-blue-500/25 bg-gradient-to-br from-blue-500/10 via-card to-card dark:from-blue-950/50 dark:via-[#0d1628] dark:to-[#08101d]",
    icon: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  },
  amber: {
    card: "border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-card to-card dark:from-amber-950/45 dark:via-[#171728] dark:to-[#08101d]",
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  violet: {
    card: "border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-card to-card dark:from-violet-950/45 dark:via-[#11152a] dark:to-[#08101d]",
    icon: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  },
  green: {
    card: "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-card to-card dark:from-emerald-950/45 dark:via-[#0c1923] dark:to-[#08101d]",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  cyan: {
    card: "border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-card to-card dark:from-cyan-950/45 dark:via-[#0c1928] dark:to-[#08101d]",
    icon: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function timestamp(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

function netCashFlow(movements: BrokerMovement[]) {
  return movements.reduce((total, movement) => {
    const amount = Number(movement.amount || 0);
    return total + amount * (movement.kind === "withdrawal" ? -1 : 1);
  }, 0);
}

function percentageChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function TrendIndicator({ change }: { change: number | null }) {
  const isPositive = change !== null && change >= 0;
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        change === null
          ? "bg-muted text-muted-foreground"
          : isPositive
            ? "bg-profit/10 text-profit"
            : "bg-loss/10 text-loss"
      }`}>
        {change === null ? "No baseline" : <><ChangeIcon className="h-3.5 w-3.5" />{isPositive ? "+" : ""}{change.toFixed(1)}%</>}
      </span>
      <span className="text-[10px] text-muted-foreground">vs previous 30D</span>
    </div>
  );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metric.icon;
  const tone = metricToneClasses[metric.tone];

  return (
    <Card className={`relative overflow-hidden border shadow-sm ${tone.card} gap-0 py-0`}>
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-3 pb-1 sm:p-4 sm:pb-1">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="min-w-0 text-xs font-medium text-muted-foreground sm:text-sm">{metric.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 sm:px-4 sm:pb-4">
        <div>
          <p className={`truncate text-3xl font-bold tabular-nums sm:text-4xl ${metric.valueClass ?? "text-foreground"}`} title={metric.value}>
            {metric.value}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={metric.detail}>{metric.detail}</p>
        </div>
        <TrendIndicator change={metric.change} />
      </CardContent>
    </Card>
  );
}

function RecentTradesCard({
  trades,
  formatTradeTime,
  onViewAll,
}: {
  trades: AnalyticsTrade[];
  formatTradeTime: (value: Date | string | number) => string;
  onViewAll: () => void;
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm dark:bg-[#0a1423]">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm">Recent Trades</CardTitle>
            <CardDescription className="text-xs">Latest activity</CardDescription>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onViewAll} className="h-8 shrink-0 gap-1 px-2 text-xs text-primary">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_48px_68px_38px] items-center gap-1.5 border-b border-border/60 px-1 pb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:grid-cols-[minmax(0,1fr)_64px_82px_48px] sm:gap-2 sm:text-[11px]">
          <span>Asset</span><span>Type</span><span className="text-right">Result</span><span className="text-right">Time</span>
        </div>
        {trades.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No trades recorded yet.</p>
        ) : trades.map((trade) => {
          const isLong = trade.direction === "long";
          const pnl = Number(trade.pnl || 0);
          const DirectionIcon = isLong ? ArrowUpRight : ArrowDownRight;
          return (
            <div key={trade.id ?? `${trade.symbol}-${timestamp(trade.tradeDate)}`} className="grid grid-cols-[minmax(0,1fr)_48px_68px_38px] items-center gap-1.5 border-b border-border/40 px-1 py-2.5 text-xs last:border-0 sm:grid-cols-[minmax(0,1fr)_64px_82px_48px] sm:gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${isLong ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"}`}>
                  {trade.symbol.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate font-medium" title={trade.symbol}>{trade.symbol}</span>
              </div>
              <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold sm:text-xs ${isLong ? "text-profit" : "text-loss"}`}>
                <DirectionIcon className="h-3.5 w-3.5 shrink-0" />{isLong ? "CALL" : "PUT"}
              </span>
              <span className={`truncate text-right font-semibold tabular-nums ${pnl >= 0 ? "text-profit" : "text-loss"}`} title={formatCurrency(pnl)}>{formatCurrency(pnl)}</span>
              <span className="text-right tabular-nums text-muted-foreground">{formatTradeTime(trade.tradeDate)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const tradeQuery = trpc.trades.list.useQuery();
  const trades = tradeQuery.data ?? [];
  const activeBrokerQuery = trpc.account.activeBroker.useQuery();
  const selectedBroker = activeBrokerQuery.data ?? "Bybit";
  const movementsQuery = trpc.account.movements.useQuery({ broker: selectedBroker === "All Brokers" ? undefined : selectedBroker });
  const [chartDays, setChartDays] = useState<(typeof CHART_PERIODS)[number]>(30);
  const [, setLocation] = useLocation();

  const normalizedBrokerMovements = useMemo(
    () => (movementsQuery.data ?? []).map((movement) => ({
      ...movement,
      kind: (movement.kind === "deposit" || movement.kind === "withdrawal" ? movement.kind : "deposit") as "deposit" | "withdrawal",
    })),
    [movementsQuery.data],
  );
  const brokerTrades = useMemo(() => filterTradesByBroker(trades, selectedBroker), [trades, selectedBroker]);
  const allTimeStats = useMemo(() => summarizeTrades(brokerTrades), [brokerTrades]);
  const brokerSummary = useMemo(
    () => calculateBrokerSummary({ trades: brokerTrades, broker: selectedBroker, startingBalance: 0, movements: normalizedBrokerMovements }),
    [brokerTrades, selectedBroker, normalizedBrokerMovements],
  );

  const now = Date.now();
  const currentPeriodStart = now - 30 * DAY_MS;
  const previousPeriodStart = now - 60 * DAY_MS;
  const currentPeriodTrades = brokerTrades.filter((trade) => {
    const tradeTime = timestamp(trade.tradeDate);
    return tradeTime >= currentPeriodStart && tradeTime <= now;
  });
  const previousPeriodTrades = brokerTrades.filter((trade) => {
    const tradeTime = timestamp(trade.tradeDate);
    return tradeTime >= previousPeriodStart && tradeTime < currentPeriodStart;
  });
  const currentPeriodStats = summarizeTrades(currentPeriodTrades);
  const previousPeriodStats = summarizeTrades(previousPeriodTrades);
  const currentPeriodMovements = normalizedBrokerMovements.filter((movement) => {
    const movementTime = timestamp(movement.date);
    return movementTime >= currentPeriodStart && movementTime <= now;
  });
  const previousPeriodMovements = normalizedBrokerMovements.filter((movement) => {
    const movementTime = timestamp(movement.date);
    return movementTime >= previousPeriodStart && movementTime < currentPeriodStart;
  });
  const currentPeriodFlow = netCashFlow(currentPeriodMovements);
  const previousPeriodFlow = netCashFlow(previousPeriodMovements);
  const balanceAtPeriodStart = calculateBrokerSummary({
    trades: brokerTrades.filter((trade) => timestamp(trade.tradeDate) < currentPeriodStart),
    broker: selectedBroker,
    movements: normalizedBrokerMovements.filter((movement) => timestamp(movement.date) < currentPeriodStart),
  }).currentBalance;

  const chartStart = now - (chartDays - 1) * DAY_MS;
  const chartTrades = brokerTrades.filter((trade) => timestamp(trade.tradeDate) >= chartStart && timestamp(trade.tradeDate) <= now);
  const chartMovements = normalizedBrokerMovements.filter((movement) => timestamp(movement.date) >= chartStart && timestamp(movement.date) <= now);
  const chartOpeningBalance = calculateBrokerSummary({
    trades: brokerTrades.filter((trade) => timestamp(trade.tradeDate) < chartStart),
    broker: selectedBroker,
    movements: normalizedBrokerMovements.filter((movement) => timestamp(movement.date) < chartStart),
  }).currentBalance;
  const equityData = buildEquityCurve(chartTrades, "daily", chartOpeningBalance, chartMovements);
  const recentTrades = useMemo(
    () => [...brokerTrades].sort((left, right) => timestamp(right.tradeDate) - timestamp(left.tradeDate)).slice(0, 5),
    [brokerTrades],
  );

  const metrics: DashboardMetric[] = [
    { title: "Total P&L", value: formatCurrency(allTimeStats.totalPnl), detail: `${allTimeStats.tradeCount} trades`, change: percentageChange(currentPeriodStats.totalPnl, previousPeriodStats.totalPnl), icon: allTimeStats.totalPnl >= 0 ? TrendingUp : TrendingDown, tone: "rose", valueClass: allTimeStats.totalPnl >= 0 ? "text-profit" : "text-loss" },
    { title: "Win Rate", value: `${allTimeStats.winRate.toFixed(1)}%`, detail: `${allTimeStats.winCount}W / ${allTimeStats.lossCount}L`, change: percentageChange(currentPeriodStats.winRate, previousPeriodStats.winRate), icon: Target, tone: "teal" },
    { title: "Average Win/Loss", value: formatCurrency(allTimeStats.averageWin), detail: `Loss: ${formatCurrency(allTimeStats.averageLoss)}`, change: percentageChange(currentPeriodStats.averageWin, previousPeriodStats.averageWin), icon: BarChart3, tone: "blue" },
    { title: "Profit Factor", value: Number.isFinite(allTimeStats.profitFactor) ? allTimeStats.profitFactor.toFixed(2) : "∞", detail: "Gross profit / loss", change: percentageChange(currentPeriodStats.profitFactor, previousPeriodStats.profitFactor), icon: Zap, tone: "amber" },
    { title: "Total Trades", value: String(allTimeStats.tradeCount), detail: "Trades recorded", change: percentageChange(currentPeriodTrades.length, previousPeriodTrades.length), icon: Layers, tone: "violet" },
    { title: "Current Balance", value: formatCurrency(brokerSummary.currentBalance), detail: `Deposits: ${formatCurrency(brokerSummary.totalDeposits)} · Withdrawals: ${formatCurrency(brokerSummary.totalWithdrawals)}`, change: percentageChange(brokerSummary.currentBalance, balanceAtPeriodStart), icon: Wallet, tone: "violet" },
    { title: "Realized P&L", value: formatCurrency(currentPeriodStats.totalPnl), detail: "Last 30 days", change: percentageChange(currentPeriodStats.totalPnl, previousPeriodStats.totalPnl), icon: TrendingDown, tone: "rose", valueClass: currentPeriodStats.totalPnl >= 0 ? "text-profit" : "text-loss" },
    { title: "Net Deposit", value: formatCurrency(brokerSummary.netCashFlow), detail: "Deposits less withdrawals · all time", change: percentageChange(currentPeriodFlow, previousPeriodFlow), icon: ArrowDownLeft, tone: "green", valueClass: "text-profit" },
    { title: "Net Cash Flow", value: formatCurrency(currentPeriodFlow), detail: "Deposits less withdrawals · 30D", change: percentageChange(currentPeriodFlow, previousPeriodFlow), icon: Activity, tone: "cyan", valueClass: currentPeriodFlow >= 0 ? "text-profit" : "text-loss" },
  ];

  if (tradeQuery.isLoading || activeBrokerQuery.isLoading || movementsQuery.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {Array.from({ length: 9 }, (_, cardIndex) => (
          <Card key={cardIndex} className="border-0 shadow-sm">
            <CardHeader className="pb-3"><Skeleton className="h-4 w-28" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-32" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatTradeTime = (value: Date | string | number) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date) : "--:--";
  };
  const formatAxisDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
  const currentBalance = equityData[equityData.length - 1]?.accountBalance ?? brokerSummary.currentBalance;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {metrics.map((metric) => <MetricCard key={metric.title} metric={metric} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card className="border-border/70 bg-card/95 shadow-sm dark:bg-[#0a1423]">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><TrendingUp className="h-4 w-4" /></div>
              <div><CardTitle className="text-sm">Balance Evolution</CardTitle><CardDescription className="text-xs">Account balance over time</CardDescription></div>
            </div>
            <div className="flex items-center rounded-lg border bg-muted/30 p-1" role="group" aria-label="Balance chart period">
              {CHART_PERIODS.map((days) => (
                <Button key={days} type="button" size="sm" variant={chartDays === days ? "default" : "ghost"} aria-pressed={chartDays === days} onClick={() => setChartDays(days)} className="h-7 px-2.5 text-[11px]">{days}D</Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Current balance</p><p className="text-lg font-semibold tabular-nums text-profit">{formatCurrency(currentBalance)}</p></div>
              <p className="text-xs text-muted-foreground">{equityData.length > 1 ? `${equityData.length - 1} periods` : "No recent activity"}</p>
            </div>
            {equityData.length > 1 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={equityData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs><linearGradient id="dashboardBalanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="100%" stopColor="#10b981" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={(value) => formatAxisDate(String(value))} minTickGap={24} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis domain={[(dataMinimum: number) => Math.min(dataMinimum, 0), "auto"]} tickFormatter={(value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value))} width={48} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Balance"]} labelFormatter={(value) => formatAxisDate(String(value))} contentStyle={{ background: "var(--card)", borderColor: "var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
                  <Area type="monotone" dataKey="accountBalance" name="Balance" stroke="#10b981" strokeWidth={2.5} fill="url(#dashboardBalanceFill)" activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">Record trades or cash movements to build your balance history.</div>}
          </CardContent>
        </Card>

        <RecentTradesCard trades={recentTrades} formatTradeTime={formatTradeTime} onViewAll={() => setLocation("/trades")} />
      </div>
    </div>
  );
}