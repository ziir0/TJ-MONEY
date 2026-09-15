export type AnalyticsTrade = {
  id?: number;
  symbol: string;
  direction: "long" | "short";
  entryPrice: string | number;
  exitPrice: string | number;
  quantity: string | number;
  fees?: string | number | null;
  pnl: string | number;
  tradeDate: Date | string | number;
  exitDate?: Date | string | number | null;
  notes?: string | null;
};

export type TradeSummary = {
  totalPnl: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  totalFees: number;
};

export type EquityPeriod = "daily" | "weekly" | "monthly";

export type EquityPoint = {
  date: string;
  timestamp: number;
  tradeNumber: number;
  tradePnl: number;
  cumulativePnl: number;
  accountBalance: number;
  drawdown: number;
  drawdownPercent: number;
  isBaseline?: boolean;
};

const numericValue = (value: string | number | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const timestampValue = (value: Date | string | number) => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

function periodStart(timestamp: number, period: EquityPeriod) {
  if (!timestamp) return 0;

  const date = new Date(timestamp);
  if (period === "monthly") {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }

  if (period === "weekly") {
    const day = date.getUTCDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday);
  }

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function buildEquityCurve(
  trades: AnalyticsTrade[],
  period: EquityPeriod = "daily",
  startingBalance = 0,
): EquityPoint[] {
  const grouped = new Map<number, number>();

  trades.forEach((trade) => {
    const timestamp = timestampValue(trade.tradeDate);
    const key = periodStart(timestamp, period);
    grouped.set(key, (grouped.get(key) ?? 0) + numericValue(trade.pnl));
  });

  const periods = Array.from(grouped.entries()).sort(([left], [right]) => left - right);
  if (periods.length === 0) return [];

  const firstTimestamp = periods[0]![0];
  const baselineTimestamp = firstTimestamp > 0 ? firstTimestamp - 1 : 0;
  let cumulativePnl = 0;
  let peakBalance = startingBalance;

  const baseline: EquityPoint = {
    date: baselineTimestamp ? new Date(baselineTimestamp).toISOString().slice(0, 10) : "Unknown",
    timestamp: baselineTimestamp,
    tradeNumber: 0,
    tradePnl: 0,
    cumulativePnl: 0,
    accountBalance: startingBalance,
    drawdown: 0,
    drawdownPercent: 0,
    isBaseline: true,
  };

  const curve = periods.map(([timestamp, tradePnl], index) => {
    cumulativePnl += tradePnl;
    const accountBalance = startingBalance + cumulativePnl;
    peakBalance = Math.max(peakBalance, accountBalance);
    const drawdown = accountBalance - peakBalance;

    return {
      date: timestamp ? new Date(timestamp).toISOString().slice(0, 10) : "Unknown",
      timestamp,
      tradeNumber: index + 1,
      tradePnl,
      cumulativePnl,
      accountBalance,
      drawdown,
      drawdownPercent: peakBalance !== 0 ? (drawdown / peakBalance) * 100 : 0,
    };
  });

  return [baseline, ...curve];
}

export function filterTradesByDateRange(
  trades: AnalyticsTrade[],
  startDate?: string,
  endDate?: string,
) {
  const startTimestamp = startDate ? new Date(`${startDate}T00:00:00.000Z`).getTime() : undefined;
  const endTimestamp = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : undefined;
  const hasStart = startTimestamp !== undefined && Number.isFinite(startTimestamp);
  const hasEnd = endTimestamp !== undefined && Number.isFinite(endTimestamp);

  return trades.filter((trade) => {
    const timestamp = timestampValue(trade.tradeDate);
    if (hasStart && timestamp < startTimestamp!) return false;
    if (hasEnd && timestamp > endTimestamp!) return false;
    return true;
  });
}

export function summarizeTrades(trades: AnalyticsTrade[]): TradeSummary {
  let totalPnl = 0;
  let totalFees = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let winningPnl = 0;
  let losingPnl = 0;

  trades.forEach((trade) => {
    const pnl = numericValue(trade.pnl);
    totalPnl += pnl;
    totalFees += numericValue(trade.fees);

    if (pnl > 0) {
      winCount += 1;
      winningPnl += pnl;
      grossProfit += pnl;
    } else if (pnl < 0) {
      lossCount += 1;
      losingPnl += pnl;
      grossLoss += Math.abs(pnl);
    } else {
      breakevenCount += 1;
    }
  });

  const tradeCount = trades.length;

  return {
    totalPnl,
    tradeCount,
    winCount,
    lossCount,
    breakevenCount,
    winRate: tradeCount ? (winCount / tradeCount) * 100 : 0,
    averageWin: winCount ? winningPnl / winCount : 0,
    averageLoss: lossCount ? losingPnl / lossCount : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    totalFees,
  };
}

export function escapeCsvCell(value: unknown) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(normalized)
    ? `"${normalized.replace(/"/g, '""')}"`
    : normalized;
}

const csvDate = (value: Date | string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
};

export function buildTradesCsv(trades: AnalyticsTrade[]) {
  const headers = [
    "Trade ID",
    "Symbol",
    "Direction",
    "Entry Price",
    "Exit Price",
    "Quantity",
    "Fees",
    "P&L",
    "Trade Date",
    "Exit Date",
    "Notes",
  ];

  const rows = trades.map((trade) => [
    trade.id ?? "",
    trade.symbol,
    trade.direction,
    trade.entryPrice,
    trade.exitPrice,
    trade.quantity,
    trade.fees ?? "",
    trade.pnl,
    csvDate(trade.tradeDate),
    csvDate(trade.exitDate),
    trade.notes ?? "",
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

export function buildPerformanceSummaryCsv(summary: TradeSummary) {
  const rows = [
    ["Metric", "Value"],
    ["Total P&L", summary.totalPnl.toFixed(2)],
    ["Win Rate", `${summary.winRate.toFixed(2)}%`],
    ["Average Win", summary.averageWin.toFixed(2)],
    ["Average Loss", summary.averageLoss.toFixed(2)],
    ["Profit Factor", Number.isFinite(summary.profitFactor) ? summary.profitFactor.toFixed(2) : "Infinity"],
    ["Trade Count", summary.tradeCount],
    ["Winning Trades", summary.winCount],
    ["Losing Trades", summary.lossCount],
    ["Breakeven Trades", summary.breakevenCount],
    ["Total Fees", summary.totalFees.toFixed(2)],
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
