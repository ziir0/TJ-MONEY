import React, { useMemo } from "react";
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
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import EquityCurve from "@/components/EquityCurve";
import { trpc } from "@/lib/trpc";
import { getLocalDateString, useGlobalToolbar } from "@/contexts/GlobalToolbarContext";
import {
  calculateNetCashFlow,
  calculatePeriodNetResult,
  filterMovementsByCalendarDateRange,
  filterMovementsByDatePreset,
  filterTradesByCalendarDateRange,
  filterTradesByBroker,
  getDatePresetRange,
  getPreviousDatePresetRange,
  summarizeTrades,
  type AnalyticsTrade,
} from "@/lib/tradingAnalytics";

type DashboardMetric = {
  title: string;
  value: string;
  detail: string;
  change: number | null;
  icon: LucideIcon;
  iconClass?: string;
  valueClass?: string;
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

function percentageChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function TrendIndicator({ change }: { change: number | null }) {
  const isPositive = change !== null && change >= 0;
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
          change === null
            ? "bg-muted text-muted-foreground"
            : isPositive
              ? "bg-profit/15 text-profit"
              : "bg-loss/15 text-loss"
        }`}
      >
        {change === null ? "No baseline" : <><ChangeIcon className="h-3 w-3" />{isPositive ? "+" : ""}{change.toFixed(1)}%</>}
      </span>
      <span className="text-[10px] text-muted-foreground">vs previous period</span>
    </div>
  );
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metric.icon;

  return (
    <Card
      className="relative h-full overflow-hidden rounded-xl border-border/70 bg-card/95 shadow-sm transition-colors hover:border-border gap-0 py-0"
    >
      <CardHeader className="grid-cols-[auto_minmax(0,1fr)] grid-rows-1 items-center gap-3 space-y-0 p-4 pb-2">
        <Icon className={`h-5 w-5 ${metric.iconClass ?? "text-primary"}`} aria-hidden="true" />
        <CardTitle className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {metric.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4">
        <div>
          <p
            className={`truncate font-mono text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${metric.valueClass ?? "text-foreground"}`}
            title={metric.value}
          >
            {metric.value}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={metric.detail}>
            {metric.detail}
          </p>
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
    <Card className="terminal-card border-border/70 bg-card/95 shadow-sm dark:bg-[#0a1220]">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Activity className="h-5 w-5 shrink-0 text-blue-500" aria-hidden="true" />
          <div className="min-w-0">
            <CardTitle className="text-sm font-bold tracking-tight">Recent Trades</CardTitle>
            <CardDescription className="text-xs">Latest execution activity</CardDescription>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onViewAll}
          className="h-8 shrink-0 gap-1 px-2.5 text-xs text-primary font-semibold hover:bg-primary/10"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {trades.length > 0 ? (
          <div className="grid grid-cols-[minmax(0,1fr)_56px_74px_42px] items-center gap-1.5 border-b border-border/60 px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid-cols-[minmax(0,1fr)_68px_88px_48px] sm:gap-2 sm:text-[11px]">
            <span>Asset</span>
            <span>Type</span>
            <span className="text-right">Result</span>
            <span className="text-right">Time</span>
          </div>
        ) : null}
        {trades.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No trades in this period"
            description="Try another date range or open Trades Log to review your records."
            actionLabel="Open Trades Log"
            onAction={onViewAll}
            className="py-7"
          />
        ) : (
          trades.map((trade) => {
            const isLong = trade.direction === "long";
            const pnl = Number(trade.pnl || 0);
            const DirectionIcon = isLong ? ArrowUpRight : ArrowDownRight;
            return (
              <div
                key={trade.id ?? `${trade.symbol}-${timestamp(trade.tradeDate)}`}
                className="grid grid-cols-[minmax(0,1fr)_56px_74px_42px] items-center gap-1.5 border-b border-border/40 px-1 py-2.5 text-xs last:border-0 hover:bg-muted/30 rounded transition-colors sm:grid-cols-[minmax(0,1fr)_68px_88px_48px] sm:gap-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${
                      isLong ? "bg-profit/15 text-profit border border-profit/20" : "bg-loss/15 text-loss border border-loss/20"
                    }`}
                  >
                    {trade.symbol.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="truncate font-semibold tracking-tight" title={trade.symbol}>
                    {trade.symbol}
                  </span>
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      isLong ? "bg-profit/15 text-profit" : "bg-loss/15 text-loss"
                    }`}
                  >
                    <DirectionIcon className="h-3 w-3 shrink-0" />
                    {isLong ? "CALL" : "PUT"}
                  </span>
                </div>
                <span
                  className={`truncate text-right font-mono font-bold tabular-nums ${pnl >= 0 ? "text-profit" : "text-loss"}`}
                  title={formatCurrency(pnl)}
                >
                  {formatCurrency(pnl)}
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatTradeTime(trade.tradeDate)}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const tradeQuery = trpc.trades.list.useQuery();
  const trades = tradeQuery.data ?? [];
  const activeBrokerQuery = trpc.account.activeBroker.useQuery(undefined, {
    staleTime: 60_000,
  });
  const selectedBroker =
    activeBrokerQuery.data ??
    (typeof window !== "undefined" ? localStorage.getItem("active-broker") || "Bybit" : "Bybit");
  const { selectedDate, selectedPeriod, periodLabel } = useGlobalToolbar();
  const movementsQuery = trpc.account.movements.useQuery({});
  const [, setLocation] = useLocation();

  const normalizedBrokerMovements = useMemo(
    () =>
      (movementsQuery.data ?? []).map((movement) => ({
        ...movement,
        kind: (movement.kind === "deposit" || movement.kind === "withdrawal" ? movement.kind : "deposit") as "deposit" | "withdrawal",
      })),
    [movementsQuery.data],
  );
  const brokerTrades = useMemo(() => filterTradesByBroker(trades, selectedBroker), [trades, selectedBroker]);
  const selectedRange = useMemo(
    () => getDatePresetRange(selectedPeriod, selectedDate),
    [selectedPeriod, selectedDate],
  );
  const previousRange = useMemo(
    () => getPreviousDatePresetRange(selectedPeriod, selectedDate),
    [selectedPeriod, selectedDate],
  );
  const filteredTrades = useMemo(
    () => filterTradesByCalendarDateRange(brokerTrades, selectedRange),
    [brokerTrades, selectedRange],
  );
  const previousPeriodTrades = useMemo(
    () => filterTradesByCalendarDateRange(brokerTrades, previousRange),
    [brokerTrades, previousRange],
  );
  const periodStats = useMemo(() => summarizeTrades(filteredTrades), [filteredTrades]);
  const previousPeriodStats = useMemo(() => summarizeTrades(previousPeriodTrades), [previousPeriodTrades]);
  const brokerMovements = useMemo(
    () => normalizedBrokerMovements.filter(
      (movement) => selectedBroker === "All Brokers" || movement.broker === selectedBroker,
    ),
    [normalizedBrokerMovements, selectedBroker],
  );
  const selectedPeriodMovements = useMemo(
    () => filterMovementsByCalendarDateRange(brokerMovements, selectedRange),
    [brokerMovements, selectedRange],
  );
  const previousPeriodMovements = useMemo(
    () => filterMovementsByCalendarDateRange(brokerMovements, previousRange),
    [brokerMovements, previousRange],
  );
  const currentMonthMovements = useMemo(
    () => filterMovementsByDatePreset(brokerMovements, "thisMonth", getLocalDateString()),
    [brokerMovements],
  );
  const previousMonthMovements = useMemo(
    () => filterMovementsByCalendarDateRange(
      brokerMovements,
      getPreviousDatePresetRange("thisMonth", getLocalDateString()),
    ),
    [brokerMovements],
  );
  const cashFlow = calculateNetCashFlow(currentMonthMovements);
  const previousMonthCashFlow = calculateNetCashFlow(previousMonthMovements);
  const periodNetResult = calculatePeriodNetResult(filteredTrades, selectedPeriodMovements);
  const previousPeriodNetResult = calculatePeriodNetResult(previousPeriodTrades, previousPeriodMovements);
  const monthDeposits = currentMonthMovements
    .filter((movement) => movement.kind === "deposit")
    .reduce((total, movement) => total + Number(movement.amount || 0), 0);
  const periodChange = (current: number, previous: number) =>
    selectedPeriod === "all" ? null : percentageChange(current, previous);
  const previousMonthDeposits = previousMonthMovements
    .filter((movement) => movement.kind === "deposit")
    .reduce((total, movement) => total + Number(movement.amount || 0), 0);

  const recentTrades = useMemo(
    () => [...filteredTrades].sort((left, right) => timestamp(right.tradeDate) - timestamp(left.tradeDate)).slice(0, 5),
    [filteredTrades],
  );

  const metrics: DashboardMetric[] = [
    {
      title: "Total P&L",
      value: formatCurrency(periodStats.totalPnl),
      detail: `${periodStats.tradeCount} trades · ${periodLabel}`,
      change: periodChange(periodStats.totalPnl, previousPeriodStats.totalPnl),
      icon: periodStats.totalPnl >= 0 ? TrendingUp : TrendingDown,
      iconClass: periodStats.totalPnl >= 0 ? "text-profit" : "text-loss",
      valueClass: periodStats.totalPnl >= 0 ? "text-profit" : "text-loss",
    },
    {
      title: "Win Rate",
      value: `${periodStats.winRate.toFixed(1)}%`,
      detail: `${periodStats.winCount}W / ${periodStats.lossCount}L`,
      change: periodChange(periodStats.winRate, previousPeriodStats.winRate),
      icon: Target,
      iconClass: "text-profit",
    },
    {
      title: "Average Win/Loss",
      value: formatCurrency(periodStats.averageWin),
      detail: `Loss: ${formatCurrency(periodStats.averageLoss)}`,
      change: periodChange(periodStats.averageWin, previousPeriodStats.averageWin),
      icon: BarChart3,
    },
    {
      title: "Profit Factor",
      value: Number.isFinite(periodStats.profitFactor) ? periodStats.profitFactor.toFixed(2) : "∞",
      detail: "Gross profit / loss",
      change: periodChange(periodStats.profitFactor, previousPeriodStats.profitFactor),
      icon: Zap,
    },
    {
      title: "Total Trades",
      value: String(periodStats.tradeCount),
      detail: periodLabel,
      change: periodChange(periodStats.tradeCount, previousPeriodStats.tradeCount),
      icon: Layers,
    },
    {
      title: "Period Net Result",
      value: formatCurrency(periodNetResult),
      detail: `P&L ${formatCurrency(periodStats.totalPnl)} · cash flow ${formatCurrency(calculateNetCashFlow(selectedPeriodMovements))}`,
      change: periodChange(periodNetResult, previousPeriodNetResult),
      icon: Wallet,
      iconClass: periodNetResult >= 0 ? "text-profit" : "text-loss",
      valueClass: periodNetResult >= 0 ? "text-profit" : "text-loss",
    },
    {
      title: "Trading Fees",
      value: formatCurrency(periodStats.totalFees),
      detail: periodLabel,
      change: periodChange(periodStats.totalFees, previousPeriodStats.totalFees),
      icon: TrendingDown,
      iconClass: "text-loss",
      valueClass: "text-loss",
    },
    {
      title: "Deposits",
      value: formatCurrency(monthDeposits),
      detail: "This Month (independent of selected range)",
      change: percentageChange(monthDeposits, previousMonthDeposits),
      icon: ArrowDownLeft,
      iconClass: "text-profit",
      valueClass: "text-profit",
    },
    {
      title: "Net Cash Flow",
      value: formatCurrency(cashFlow),
      detail: "This Month (independent of selected range)",
      change: percentageChange(cashFlow, previousMonthCashFlow),
      icon: Activity,
      iconClass: cashFlow >= 0 ? "text-profit" : "text-loss",
      valueClass: cashFlow >= 0 ? "text-profit" : "text-loss",
    },
  ];

  if (tradeQuery.isLoading || activeBrokerQuery.isLoading || movementsQuery.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {Array.from({ length: 9 }, (_, cardIndex) => <Skeleton key={cardIndex} className="h-36 rounded-xl" />)}
      </div>
    );
  }

  const formatTradeTime = (value: Date | string | number) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date)
      : "--:--";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {metrics.map((metric) => <MetricCard key={metric.title} metric={metric} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <EquityCurve
          trades={filteredTrades}
          movements={selectedPeriodMovements}
          controlledDateRange={{ startDate: "", endDate: "" }}
          includeOpeningBalance={false}
          balanceLabel="Period Net Result"
          title="Trading Performance Evolution"
          description={`Trade P&L for ${periodLabel}; cash flow for this month`}
          height={320}
        />

        <RecentTradesCard trades={recentTrades} formatTradeTime={formatTradeTime} onViewAll={() => setLocation("/trades")} />
      </div>
    </div>
  );
}