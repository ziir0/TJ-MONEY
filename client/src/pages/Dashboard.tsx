import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { TrendingUp, TrendingDown, Target, Zap, BarChart3 } from "lucide-react";
import EquityCurve from "@/components/EquityCurve";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.stats.calculate.useQuery({
    startDate: undefined,
    endDate: undefined,
  });
  const { data: trades = [] } = trpc.trades.list.useQuery();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
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

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatNumber = (value: number) => {
    return value.toFixed(2);
  };

  const pnlColor = stats.totalPnL >= 0 ? "text-profit" : "text-loss";
  const pnlBgColor = stats.totalPnL >= 0 ? "bg-profit/10" : "bg-loss/10";

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-accent/5 to-transparent">
        <CardHeader>
          <CardTitle>Welcome to Your Trading Journal</CardTitle>
          <CardDescription>
            Track your trades, analyze your performance, and improve your trading strategy.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Key Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total P&L */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total P&L
              </CardTitle>
              <div className={`p-2 rounded-lg ${pnlBgColor}`}>
                {stats.totalPnL >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-profit" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-loss" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${pnlColor}`}>
              {formatCurrency(stats.totalPnL)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.tradeCount} trades
            </p>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Win Rate
              </CardTitle>
              <div className="p-2 rounded-lg bg-accent/10">
                <Target className="w-4 h-4 text-accent" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatPercent(stats.winRate)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.winCount}W / {stats.lossCount}L
            </p>
          </CardContent>
        </Card>

        {/* Average Win/Loss */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Average Win/Loss
              </CardTitle>
              <div className="p-2 rounded-lg bg-chart-1/10">
                <BarChart3 className="w-4 h-4 text-chart-1" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(stats.averageWin)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Loss: {formatCurrency(stats.averageLoss)}
            </p>
          </CardContent>
        </Card>

        {/* Profit Factor */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Profit Factor
              </CardTitle>
              <div className="p-2 rounded-lg bg-chart-2/10">
                <Zap className="w-4 h-4 text-chart-2" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.profitFactor === Infinity ? "∞" : formatNumber(stats.profitFactor)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gross ratio
            </p>
          </CardContent>
        </Card>

        {/* Trade Count */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Trade Count
              </CardTitle>
              <div className="p-2 rounded-lg bg-chart-5/10">
                <BarChart3 className="w-4 h-4 text-chart-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.tradeCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Equity Curve */}
      <EquityCurve trades={trades} />
    </div>
  );
}
