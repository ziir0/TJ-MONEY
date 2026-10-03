import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { calculateBrokerSummary, filterTradesByBroker, summarizeTrades } from "@/lib/tradingAnalytics";
import { TrendingUp, TrendingDown, Target, Zap, BarChart3 } from "lucide-react";
import EquityCurve from "@/components/EquityCurve";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.stats.calculate.useQuery({
    startDate: undefined,
    endDate: undefined,
  });
  const { data: trades = [] } = trpc.trades.list.useQuery();
  const { data: selectedBroker = "Bybit" } = trpc.account.activeBroker.useQuery();
  const { data: brokerMovements = [] } = trpc.account.movements.useQuery({ broker: selectedBroker === "All Brokers" ? undefined : selectedBroker });
  const [mounted, setMounted] = useState(false);

  const normalizedBrokerMovements = useMemo(
    () => brokerMovements.map((movement) => ({
      ...movement,
      kind: (movement.kind === "deposit" || movement.kind === "withdrawal" ? movement.kind : "deposit") as "deposit" | "withdrawal",
    })),
    [brokerMovements],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const brokerTrades = useMemo(() => filterTradesByBroker(trades, selectedBroker), [trades, selectedBroker]);
  const filteredStats = useMemo(() => summarizeTrades(brokerTrades), [brokerTrades]);
  const brokerSummary = useMemo(
    () => calculateBrokerSummary({ trades: brokerTrades, broker: selectedBroker, startingBalance: 0, movements: normalizedBrokerMovements }),
    [brokerTrades, selectedBroker, normalizedBrokerMovements],
  );

  if (!mounted || isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3 md:px-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="md:px-3">
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Unable to load statistics</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const viewStats = stats ? {
    ...stats,
    totalPnL: filteredStats.totalPnl,
    tradeCount: filteredStats.tradeCount,
    winCount: filteredStats.winCount,
    lossCount: filteredStats.lossCount,
    winRate: filteredStats.winRate,
    averageWin: filteredStats.averageWin,
    averageLoss: filteredStats.averageLoss,
    profitFactor: filteredStats.profitFactor,
    totalFees: filteredStats.totalFees,
  } : stats;

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatNumber = (value: number) => {
    return value.toFixed(2);
  };

  const pnlColor = viewStats.totalPnL >= 0 ? "text-profit" : "text-loss";
  const pnlBgColor = viewStats.totalPnL >= 0 ? "bg-profit/10" : "bg-loss/10";

  return (
    <div className="space-y-6">
      {/* Key Statistics Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:gap-4">
        {/* Total P&L */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 md:px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="min-w-0 break-words text-xs font-medium text-muted-foreground md:text-[11px] lg:text-sm">
                Total P&L
              </CardTitle>
              <div className={`p-2 rounded-lg ${pnlBgColor}`}>
                {viewStats.totalPnL >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-profit" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-loss" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="md:px-3">
            <div className={`text-xl font-bold sm:text-2xl ${pnlColor}`}>
              {formatCurrency(viewStats.totalPnL)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {viewStats.tradeCount} trades
            </p>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 md:px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="min-w-0 break-words text-xs font-medium text-muted-foreground md:text-[11px] lg:text-sm">
                Win Rate
              </CardTitle>
              <div className="p-2 rounded-lg bg-accent/10">
                <Target className="w-4 h-4 text-accent" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="md:px-3">
            <div className="text-xl font-bold text-foreground sm:text-2xl">
              {formatPercent(viewStats.winRate || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {viewStats.winCount}W / {viewStats.lossCount}L
            </p>
          </CardContent>
        </Card>

        {/* Average Win/Loss */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 md:px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="min-w-0 break-words text-xs font-medium text-muted-foreground md:text-[11px] lg:text-sm">
                Average Win/Loss
              </CardTitle>
              <div className="p-2 rounded-lg bg-chart-1/10">
                <BarChart3 className="w-4 h-4 text-chart-1" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="md:px-3">
            <div className="text-xl font-bold text-foreground sm:text-2xl">
              {formatCurrency(viewStats.averageWin || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Loss: {formatCurrency(viewStats.averageLoss || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Profit Factor */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 md:px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="min-w-0 break-words text-xs font-medium text-muted-foreground md:text-[11px] lg:text-sm">
                Profit Factor
              </CardTitle>
              <div className="p-2 rounded-lg bg-chart-2/10">
                <Zap className="w-4 h-4 text-chart-2" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="md:px-3">
            <div className="text-xl font-bold text-foreground sm:text-2xl md:text-base lg:text-2xl">
              {viewStats.profitFactor === Infinity ? "∞" : formatNumber(viewStats.profitFactor || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gross ratio
            </p>
          </CardContent>
        </Card>

        {/* Trade Count */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 md:px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="min-w-0 break-words text-xs font-medium text-muted-foreground md:text-[11px] lg:text-sm">
                Trade Count
              </CardTitle>
              <div className="p-2 rounded-lg bg-chart-5/10">
                <BarChart3 className="w-4 h-4 text-chart-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="md:px-3">
            <div className="text-xl font-bold text-foreground sm:text-2xl md:text-base lg:text-2xl">
              {viewStats.tradeCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total trades
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 md:px-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Balance</CardTitle>
          </CardHeader>
          <CardContent className="md:px-3">
            <div className="text-xl font-bold text-foreground sm:text-2xl">{formatCurrency(brokerSummary.currentBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Deposits {formatCurrency(brokerSummary.totalDeposits)} / Withdrawals {formatCurrency(brokerSummary.totalWithdrawals)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 md:px-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Realized P&L</CardTitle>
          </CardHeader>
          <CardContent className="md:px-3">
            <div className={`text-xl font-bold sm:text-2xl ${brokerSummary.realizedPnl >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(brokerSummary.realizedPnl)}</div>
            <p className="text-xs text-muted-foreground mt-1">Net result for {selectedBroker === "All Brokers" ? "all brokers" : selectedBroker}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3 md:px-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Cash Flow</CardTitle>
          </CardHeader>
          <CardContent className="md:px-3">
            <div className={`text-xl font-bold sm:text-2xl ${brokerSummary.netCashFlow >= 0 ? "text-profit" : "text-loss"}`}>{formatCurrency(brokerSummary.netCashFlow)}</div>
            <p className="text-xs text-muted-foreground mt-1">Deposits minus withdrawals</p>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve */}
      <EquityCurve trades={brokerTrades} movements={normalizedBrokerMovements} />
    </div>
  );
}
