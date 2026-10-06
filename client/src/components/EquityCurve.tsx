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
import { BarChart3, TrendingUp } from "lucide-react";
import type { AnalyticsTrade, BrokerMovement, EquityPeriod } from "@/lib/tradingAnalytics";
import { buildEquityCurve, filterTradesByDateRange } from "@/lib/tradingAnalytics";

const DAY_MS = 24 * 60 * 60 * 1000;

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

export interface EquityCurveProps {
  trades: AnalyticsTrade[];
  movements?: BrokerMovement[];
  title?: string;
  description?: string;
  presetPeriods?: readonly number[];
  defaultPresetDays?: number;
  className?: string;
  height?: number;
}

export default function EquityCurve({
  trades,
  movements = [],
  title,
  description,
  presetPeriods,
  defaultPresetDays = 30,
  className = "",
  height = 300,
}: EquityCurveProps) {
  const [period, setPeriod] = useState<EquityPeriod>("daily");
  const [selectedPresetDays, setSelectedPresetDays] = useState<number | null>(
    presetPeriods && presetPeriods.length > 0 ? (presetPeriods.includes(defaultPresetDays) ? defaultPresetDays : presetPeriods[0]) : null,
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // If presetPeriods are defined, update date bounds on preset click
  const handlePresetSelect = (days: number) => {
    setSelectedPresetDays(days);
    const now = new Date();
    const start = new Date(now.getTime() - (days - 1) * DAY_MS);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(now.toISOString().slice(0, 10));
  };

  const isRangeInvalid = Boolean(startDate && endDate && startDate > endDate);

  // Active dates calculation
  const activeStartDate = useMemo(() => {
    if (selectedPresetDays !== null) {
      const now = Date.now();
      const start = new Date(now - (selectedPresetDays - 1) * DAY_MS);
      return start.toISOString().slice(0, 10);
    }
    return startDate;
  }, [selectedPresetDays, startDate]);

  const activeEndDate = useMemo(() => {
    if (selectedPresetDays !== null) {
      return new Date().toISOString().slice(0, 10);
    }
    return endDate;
  }, [selectedPresetDays, endDate]);

  const filteredTrades = useMemo(
    () => (isRangeInvalid ? [] : filterTradesByDateRange(trades, activeStartDate || undefined, activeEndDate || undefined)),
    [trades, activeStartDate, activeEndDate, isRangeInvalid],
  );

  const filteredMovements = useMemo(
    () => movements.filter((movement) => {
      if (!movement.date || isRangeInvalid) return false;
      const date = new Date(movement.date).getTime();
      const rangeStart = activeStartDate ? new Date(`${activeStartDate}T00:00:00.000Z`).getTime() : undefined;
      const rangeEnd = activeEndDate ? new Date(`${activeEndDate}T23:59:59.999Z`).getTime() : undefined;
      return (rangeStart === undefined || date >= rangeStart) && (rangeEnd === undefined || date <= rangeEnd);
    }),
    [movements, activeStartDate, activeEndDate, isRangeInvalid],
  );

  const openingBalance = useMemo(() => {
    if (!activeStartDate) return 0;
    const rangeStart = new Date(`${activeStartDate}T00:00:00.000Z`).getTime();
    const previousPnl = trades
      .filter((trade) => new Date(trade.tradeDate).getTime() < rangeStart)
      .reduce((total, trade) => total + Number(trade.pnl || 0), 0);
    const previousCashFlow = movements
      .filter((movement) => movement.date && new Date(movement.date).getTime() < rangeStart)
      .reduce((total, movement) => total + Number(movement.amount || 0) * (movement.kind === "withdrawal" ? -1 : 1), 0);
    return previousPnl + previousCashFlow;
  }, [trades, movements, activeStartDate]);

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
  const hasDateFilter = Boolean(startDate || endDate || selectedPresetDays !== null);

  const clearDateRange = () => {
    setSelectedPresetDays(null);
    setStartDate("");
    setEndDate("");
  };

  const cardTitle = title ?? "P&L Equity Curve";
  const cardDescription = description ?? `Running account performance by ${period}, with balance and drawdown overlays`;

  return (
    <Card className={`terminal-card border-border/70 bg-card/95 shadow-sm dark:bg-[#0a1423] ${className}`}>
      <CardHeader className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-none bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold tracking-tight">{cardTitle}</CardTitle>
              <CardDescription className="text-xs">{cardDescription}</CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {presetPeriods && presetPeriods.length > 0 ? (
              <div className="flex items-center rounded-lg border bg-muted/30 p-1" role="group" aria-label="Balance chart period">
                {presetPeriods.map((days) => {
                  const isSelected = selectedPresetDays === days;
                  return (
                    <Button
                      key={days}
                      type="button"
                      size="sm"
                      variant={isSelected ? "default" : "ghost"}
                      aria-pressed={isSelected}
                      onClick={() => handlePresetSelect(days)}
                      className="h-7 px-2.5 text-[11px] font-semibold"
                    >
                      {days}D
                    </Button>
                  );
                })}
              </div>
            ) : (
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
                      className="h-7 px-3 text-xs font-semibold"
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            )}

            <div className="text-right">
              <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Current P&L</p>
              <p className={`font-mono text-base font-bold tabular-nums ${latestClass}`}>
                {formatCurrency(latestValue)}
              </p>
            </div>
          </div>
        </div>

        {/* Date Filter Inputs (shown when presetPeriods is not passed or user opts into custom date picking) */}
        {!presetPeriods && (
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[140px] flex-1 space-y-1">
              <label htmlFor="equity-start-date" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                From
              </label>
              <Input
                id="equity-start-date"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setSelectedPresetDays(null);
                  setStartDate(event.target.value);
                }}
                className="h-8 bg-background text-xs font-mono"
              />
            </div>
            <div className="min-w-[140px] flex-1 space-y-1">
              <label htmlFor="equity-end-date" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                To
              </label>
              <Input
                id="equity-end-date"
                type="date"
                value={endDate}
                onChange={(event) => {
                  setSelectedPresetDays(null);
                  setEndDate(event.target.value);
                }}
                className="h-8 bg-background text-xs font-mono"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearDateRange}
              disabled={!hasDateFilter}
              className="h-8 text-xs"
            >
              Clear dates
            </Button>
          </div>
        )}
        {isRangeInvalid && <p className="text-xs text-loss">The start date must be before the end date.</p>}
      </CardHeader>

      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {isRangeInvalid || data.length === 0 ? (
          <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 text-center">
            <BarChart3 className="mb-2 h-7 w-7 text-muted-foreground/60" />
            <p className="text-sm font-semibold">{isRangeInvalid ? "Choose a valid date range" : "No trading activity in selected period"}</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {isRangeInvalid
                ? "Select a start date on or before the end date."
                : hasDateFilter
                  ? "No trades or movements fall within the selected date range."
                  : "Record trades or cash movements to see your performance history."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="equityPnlFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="equityDrawdownFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.02} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.22} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatDate(String(value), period)}
                minTickGap={24}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="pnl"
                tickFormatter={(value) =>
                  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value))
                }
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <YAxis
                yAxisId="balance"
                orientation="right"
                tickFormatter={(value) =>
                  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value))
                }
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={58}
              />
              <Tooltip
                labelFormatter={(label) => formatDate(String(label), period)}
                formatter={(value, name) => [
                  formatCurrency(Number(value)),
                  name === "accountBalance" ? "Account Balance" : name === "drawdown" ? "Drawdown" : "Cumulative P&L",
                ]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  boxShadow: "0 4px 20px -2px rgba(0,0,0,0.5)",
                  fontSize: 12,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              />
              <Legend
                verticalAlign="top"
                align="left"
                height={28}
                content={() => (
                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-muted-foreground pb-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]" />
                      Cumulative P&amp;L
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#8b5cf6] shadow-[0_0_6px_#8b5cf6]" />
                      Account Balance
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#f43f5e] shadow-[0_0_6px_#f43f5e]" />
                      Drawdown
                    </span>
                  </div>
                )}
              />
              <Area
                yAxisId="pnl"
                type="monotone"
                dataKey="cumulativePnl"
                name="cumulativePnl"
                stroke="#10b981"
                strokeWidth={2.2}
                fill="url(#equityPnlFill)"
                dot={data.length <= 12}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#10b981" }}
              />
              <Area
                yAxisId="pnl"
                type="monotone"
                dataKey="drawdown"
                name="drawdown"
                stroke="#f43f5e"
                strokeWidth={1.5}
                fill="url(#equityDrawdownFill)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 2, stroke: "#f43f5e" }}
              />
              <Line
                yAxisId="balance"
                type="monotone"
                dataKey="accountBalance"
                name="accountBalance"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={data.length <= 12}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#8b5cf6" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {data.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-2 border-t border-border/50 pt-2.5 text-xs text-muted-foreground sm:grid-cols-3">
            <p className="font-mono">
              Showing {data.length - 1} {periodLabel.toLowerCase()} period{data.length === 2 ? "" : "s"}.
            </p>
            <p className="font-mono">
              Balance <span className="font-semibold text-foreground">{formatCurrency(latestBalance)}</span>.
            </p>
            <p className={`font-mono ${latestDrawdown < 0 ? "text-loss font-semibold" : "text-muted-foreground"}`}>
              Drawdown {formatCurrency(latestDrawdown)}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
