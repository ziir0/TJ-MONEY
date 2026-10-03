import React, { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3 } from "lucide-react";
import type { AnalyticsTrade, BrokerMovement, EquityPeriod } from "@/lib/tradingAnalytics";
import { buildEquityCurve, filterTradesByDateRange } from "@/lib/tradingAnalytics";

const periodOptions: Array<{ value: EquityPeriod; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string, period: EquityPeriod) {
  if (value === "Unknown") return value;
  return new Date(`${value}T00:00:00`).toLocaleDateString(
    "en-US",
    period === "monthly" ? { month: "short", year: "numeric" } : { month: "short", day: "numeric" },
  );
}

export default function EquityCurve({ trades, movements = [] }: { trades: AnalyticsTrade[]; movements?: BrokerMovement[] }) {
  const [period, setPeriod] = useState<EquityPeriod>("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const isRangeInvalid = Boolean(startDate && endDate && startDate > endDate);
  const filteredTrades = useMemo(
    () => (isRangeInvalid ? [] : filterTradesByDateRange(trades, startDate || undefined, endDate || undefined)),
    [trades, startDate, endDate, isRangeInvalid],
  );
  const filteredMovements = useMemo(
    () => movements.filter((movement) => {
      if (!movement.date || isRangeInvalid) return false;
      const date = new Date(movement.date).getTime();
      const rangeStart = startDate ? new Date(`${startDate}T00:00:00.000Z`).getTime() : undefined;
      const rangeEnd = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : undefined;
      return (rangeStart === undefined || date >= rangeStart) && (rangeEnd === undefined || date <= rangeEnd);
    }),
    [movements, startDate, endDate, isRangeInvalid],
  );
  const openingBalance = useMemo(() => {
    if (!startDate) return 0;
    const rangeStart = new Date(`${startDate}T00:00:00.000Z`).getTime();
    const previousPnl = trades
      .filter((trade) => new Date(trade.tradeDate).getTime() < rangeStart)
      .reduce((total, trade) => total + Number(trade.pnl || 0), 0);
    const previousCashFlow = movements
      .filter((movement) => movement.date && new Date(movement.date).getTime() < rangeStart)
      .reduce((total, movement) => total + Number(movement.amount || 0) * (movement.kind === "withdrawal" ? -1 : 1), 0);
    return previousPnl + previousCashFlow;
  }, [trades, movements, startDate]);
  const data = useMemo(
    () => buildEquityCurve(filteredTrades, period, openingBalance, filteredMovements),
    [filteredTrades, period, openingBalance, filteredMovements],
  );
  const latestPoint = data[data.length - 1];
  const latestValue = latestPoint?.cumulativePnl ?? 0;
  const latestBalance = latestPoint?.accountBalance ?? openingBalance;
  const latestDrawdown = latestPoint?.drawdown ?? 0;
  const latestClass = latestValue >= 0 ? "text-profit" : "text-loss";
  const periodLabel = periodOptions.find((option) => option.value === period)?.label ?? "Daily";
  const hasDateFilter = Boolean(startDate || endDate);

  const clearDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle>P&L Equity Curve</CardTitle>
            <CardDescription>Running account performance by {period}, with balance and drawdown overlays</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div className="flex items-center rounded-lg border bg-muted/30 p-1" role="group" aria-label="Equity curve period">
              {periodOptions.map((option) => {
                const isSelected = option.value === period;
                return (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "ghost"}
                    aria-pressed={isSelected}
                    onClick={() => setPeriod(option.value)}
                    className="h-8 px-3 text-xs"
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Current P&L</p>
              <p className={`text-lg font-semibold ${latestClass}`}>{formatCurrency(latestValue)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[150px] flex-1 space-y-1.5">
            <label htmlFor="equity-start-date" className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <Input
              id="equity-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-9 bg-background"
            />
          </div>
          <div className="min-w-[150px] flex-1 space-y-1.5">
            <label htmlFor="equity-end-date" className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <Input
              id="equity-end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="h-9 bg-background"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={clearDateRange} disabled={!hasDateFilter} className="h-9">
            Clear dates
          </Button>
        </div>
        {isRangeInvalid && <p className="text-sm text-loss">The start date must be before the end date.</p>}
      </CardHeader>

      <CardContent>
        {isRangeInvalid || data.length === 0 ? (
          <div className="flex h-[280px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <BarChart3 className="mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="font-medium">{isRangeInvalid ? "Choose a valid date range" : "Your account history starts with your first trade or cash movement"}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {isRangeInvalid
                ? "Select a start date on or before the end date."
                : hasDateFilter
                  ? "No trades fall within the selected date range."
                  : "Record trades or cash movements to see your account history here."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityCurveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.24} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="drawdownFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.04} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.22} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/70" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatDate(String(value), period)}
                minTickGap={28}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="pnl"
                tickFormatter={(value) => formatCurrency(Number(value))}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={72}
              />
              <YAxis
                yAxisId="balance"
                orientation="right"
                tickFormatter={(value) => formatCurrency(Number(value))}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={76}
              />
              <Tooltip
                labelFormatter={(label) => formatDate(String(label), period)}
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  name === "accountBalance" ? "Account Balance" : name === "drawdown" ? "Drawdown" : "Cumulative P&L",
                ]}
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              />
              <Legend
                verticalAlign="top"
                align="left"
                height={30}
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
                content={() => (
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2563eb]" />Cumulative P&amp;L</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7c3aed]" />Account Balance</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#dc2626]" />Drawdown</span>
                  </div>
                )}
              />
              <Area
                yAxisId="pnl"
                type="monotone"
                dataKey="cumulativePnl"
                name="cumulativePnl"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#equityCurveFill)"
                dot={data.length <= 12}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#ffffff" }}
              />
              <Area
                yAxisId="pnl"
                type="monotone"
                dataKey="drawdown"
                name="drawdown"
                stroke="#dc2626"
                strokeWidth={1.8}
                fill="url(#drawdownFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#ffffff" }}
              />
              <Line
                yAxisId="balance"
                type="monotone"
                dataKey="accountBalance"
                name="accountBalance"
                stroke="#7c3aed"
                strokeWidth={2.2}
                dot={data.length <= 12}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#ffffff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {data.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <p>Showing {data.length - 1} {periodLabel.toLowerCase()} period{data.length === 2 ? "" : "s"}.</p>
            <p>Balance {formatCurrency(latestBalance)}.</p>
            <p className={latestDrawdown < 0 ? "text-loss" : "text-muted-foreground"}>Drawdown {formatCurrency(latestDrawdown)}.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
