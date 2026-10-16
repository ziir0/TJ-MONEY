export type AnalyticsTrade = {
  id?: number;
  broker?: string;
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
  isInvoluntary?: boolean | null;
  assetType?: string | null;
};

export type BrokerMovementKind = "deposit" | "withdrawal";

export type BrokerMovement = {
  id?: string | number;
  broker?: string;
  kind: BrokerMovementKind;
  amount: number | string;
  date?: Date | string | number;
  note?: string | null;
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
export type DatePreset = "today" | "thisMonth" | "last90Days" | "last3Months" | "last6Months" | "lastYear" | "all";

export type CalendarDateRange = {
  startDate: string;
  endDate: string;
} | null;

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

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

const numericValue = (value: string | number | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const timestampValue = (value: Date | string | number) => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const calendarDate = (value: Date | string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const timestamp = timestampValue(value);
  return timestamp ? new Date(timestamp).toISOString().slice(0, 10) : null;
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

export function filterTradesByBroker(trades: AnalyticsTrade[], broker?: string | null) {
  if (!broker || broker === "All Brokers") return trades;

  return trades.filter((trade) => {
    const normalizedBroker = String(trade.broker ?? "").trim();
    return normalizedBroker === broker;
  });
}

export function calculateBrokerSummary({
  trades,
  broker,
  startingBalance = 0,
  startingBalanceDate,
  movements = [],
}: {
  trades: AnalyticsTrade[];
  broker?: string | null;
  startingBalance?: number;
  startingBalanceDate?: Date | string | number | null;
  movements?: BrokerMovement[];
}) {
  const baselineDate = calendarDate(startingBalanceDate);
  const filteredTrades = filterTradesByBroker(trades, broker).filter((trade) => {
    if (!baselineDate) return true;
    const tradeDate = calendarDate(trade.tradeDate);
    return tradeDate !== null && tradeDate >= baselineDate;
  });
  const realizedPnl = filteredTrades.reduce((total, trade) => total + numericValue(trade.pnl), 0);

  const filteredMovements = !broker || broker === "All Brokers"
    ? movements
    : movements.filter((movement) => String(movement.broker ?? "").trim() === broker);

  const totalDeposits = filteredMovements
    .filter((movement) => movement.kind === "deposit")
    .reduce((total, movement) => total + numericValue(movement.amount), 0);

  const totalWithdrawals = filteredMovements
    .filter((movement) => movement.kind === "withdrawal")
    .reduce((total, movement) => total + numericValue(movement.amount), 0);

  const balanceMovements = baselineDate
    ? filteredMovements.filter((movement) => {
        const movementDate = calendarDate(movement.date);
        return movementDate !== null && movementDate > baselineDate;
      })
    : filteredMovements;
  const balanceDeposits = balanceMovements
    .filter((movement) => movement.kind === "deposit")
    .reduce((total, movement) => total + numericValue(movement.amount), 0);
  const balanceWithdrawals = balanceMovements
    .filter((movement) => movement.kind === "withdrawal")
    .reduce((total, movement) => total + numericValue(movement.amount), 0);
  const currentBalance = startingBalance + balanceDeposits - balanceWithdrawals + realizedPnl;

  return {
    totalDeposits,
    totalWithdrawals,
    realizedPnl,
    currentBalance,
    netCashFlow: totalDeposits - totalWithdrawals,
    tradeCount: filteredTrades.length,
    startingBalance,
  };
}

export function calculateAllBrokersSummary({
  trades,
  movements = [],
  accountSettings = [],
}: {
  trades: AnalyticsTrade[];
  movements?: BrokerMovement[];
  accountSettings?: {
    broker: string;
    startingBalance?: string | number;
    startingBalanceDate?: Date | string | number | null;
  }[];
}) {
  const brokerNames = new Set([
    ...accountSettings.map((settings) => settings.broker),
    ...trades.map((trade) => String(trade.broker ?? "").trim()).filter(Boolean),
    ...movements.map((movement) => String(movement.broker ?? "").trim()).filter(Boolean),
  ]);
  const summaries = Array.from(brokerNames, (broker) => {
    const settings = accountSettings.find((entry) => entry.broker === broker);
    return calculateBrokerSummary({
      trades,
      broker,
      startingBalance: numericValue(settings?.startingBalance),
      startingBalanceDate: settings?.startingBalanceDate,
      movements,
    });
  });

  return summaries.reduce(
    (total, summary) => ({
      totalDeposits: total.totalDeposits + summary.totalDeposits,
      totalWithdrawals: total.totalWithdrawals + summary.totalWithdrawals,
      realizedPnl: total.realizedPnl + summary.realizedPnl,
      currentBalance: total.currentBalance + summary.currentBalance,
      netCashFlow: total.netCashFlow + summary.netCashFlow,
      tradeCount: total.tradeCount + summary.tradeCount,
      startingBalance: total.startingBalance + summary.startingBalance,
    }),
    {
      totalDeposits: 0,
      totalWithdrawals: 0,
      realizedPnl: 0,
      currentBalance: 0,
      netCashFlow: 0,
      tradeCount: 0,
      startingBalance: 0,
    },
  );
}

export function buildEquityCurve(
  trades: AnalyticsTrade[],
  period: EquityPeriod = "daily",
  startingBalance = 0,
  movements: BrokerMovement[] = [],
): EquityPoint[] {
  const grouped = new Map<number, { tradePnl: number; netCashFlow: number }>();

  trades.forEach((trade) => {
    const timestamp = timestampValue(trade.tradeDate);
    const key = periodStart(timestamp, period);
    const periodValues = grouped.get(key) ?? { tradePnl: 0, netCashFlow: 0 };
    periodValues.tradePnl += numericValue(trade.pnl);
    grouped.set(key, periodValues);
  });

  movements.forEach((movement) => {
    if (!movement.date) return;
    const timestamp = timestampValue(movement.date);
    const key = periodStart(timestamp, period);
    const periodValues = grouped.get(key) ?? { tradePnl: 0, netCashFlow: 0 };
    const amount = numericValue(movement.amount) * (movement.kind === "withdrawal" ? -1 : 1);
    periodValues.netCashFlow += amount;
    grouped.set(key, periodValues);
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

  let accountBalance = startingBalance;
  const curve = periods.map(([timestamp, periodValues], index) => {
    const { tradePnl, netCashFlow } = periodValues;
    cumulativePnl += tradePnl;
    accountBalance += tradePnl + netCashFlow;
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

export function filterTradesByInstrument(trades: AnalyticsTrade[], instrument?: string | null) {
  if (!instrument || instrument === "All Instruments") return trades;
  return trades.filter((trade) => String(trade.symbol ?? "").trim() === instrument);
}

export function isOnCalendarDate(value: Date | string | number | null | undefined, date: string) {
  if (value === null || value === undefined || value === "") return false;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return false;
  const localDate = [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
  return localDate === date || parsed.toISOString().slice(0, 10) === date;
}

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toCalendarDateString(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function shiftCalendarDate(date: Date, days: number) {
  const shifted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function shiftCalendarMonth(date: Date, months: number) {
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), Math.min(date.getDate(), lastDayOfTargetMonth));
}

export function getDatePresetRange(preset: DatePreset, referenceDate: string): CalendarDateRange {
  if (preset === "all") return null;

  const endDate = parseCalendarDate(referenceDate);
  let startDate: Date;
  switch (preset) {
    case "today":
      startDate = endDate;
      break;
    case "thisMonth":
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      break;
    case "last90Days":
      startDate = shiftCalendarDate(endDate, -89);
      break;
    case "last3Months":
      startDate = shiftCalendarMonth(endDate, -3);
      break;
    case "last6Months":
      startDate = shiftCalendarMonth(endDate, -6);
      break;
    case "lastYear":
      startDate = shiftCalendarMonth(endDate, -12);
      break;
  }

  return {
    startDate: toCalendarDateString(startDate),
    endDate: referenceDate,
  };
}

export function getPreviousDatePresetRange(preset: DatePreset, referenceDate: string): CalendarDateRange {
  if (preset === "all") return null;
  if (preset === "thisMonth") {
    return getDatePresetRange("thisMonth", toCalendarDateString(shiftCalendarMonth(parseCalendarDate(referenceDate), -1)));
  }

  const currentRange = getDatePresetRange(preset, referenceDate);
  if (!currentRange) return null;
  const currentStart = parseCalendarDate(currentRange.startDate);
  const currentEnd = parseCalendarDate(currentRange.endDate);
  const duration = Math.round((currentEnd.getTime() - currentStart.getTime()) / 86_400_000) + 1;
  const previousEnd = shiftCalendarDate(currentStart, -1);
  const previousStart = shiftCalendarDate(previousEnd, -(duration - 1));
  return {
    startDate: toCalendarDateString(previousStart),
    endDate: toCalendarDateString(previousEnd),
  };
}

function calendarDateCandidates(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = value.slice(0, 10);
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return [date];
    return Array.from(new Set([date, toCalendarDateString(parsed), parsed.toISOString().slice(0, 10)]));
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return [];
  return Array.from(new Set([toCalendarDateString(parsed), parsed.toISOString().slice(0, 10)]));
}

export function isWithinCalendarDateRange(
  value: Date | string | number | null | undefined,
  range: CalendarDateRange,
) {
  if (!range) return true;
  return calendarDateCandidates(value).some((date) => date >= range.startDate && date <= range.endDate);
}

export function filterTradesByCalendarDateRange<T extends AnalyticsTrade>(
  trades: T[],
  range: CalendarDateRange,
) {
  return trades.filter((trade) => isWithinCalendarDateRange(trade.tradeDate, range));
}

export function filterMovementsByCalendarDateRange<T extends BrokerMovement>(
  movements: T[],
  range: CalendarDateRange,
) {
  return movements.filter((movement) => isWithinCalendarDateRange(movement.date, range));
}

export function filterTradesByDatePreset<T extends AnalyticsTrade>(
  trades: T[],
  preset: DatePreset,
  referenceDate: string,
) {
  const range = getDatePresetRange(preset, referenceDate);
  return trades.filter((trade) => isWithinCalendarDateRange(trade.tradeDate, range));
}

export function filterMovementsByDatePreset<T extends BrokerMovement>(
  movements: T[],
  preset: DatePreset,
  referenceDate: string,
) {
  const range = getDatePresetRange(preset, referenceDate);
  return movements.filter((movement) => isWithinCalendarDateRange(movement.date, range));
}

export function filterTradesByCalendarDate(trades: AnalyticsTrade[], date: string) {
  return trades.filter((trade) => isOnCalendarDate(trade.tradeDate, date));
}

export function filterMovementsByCalendarDate<T extends BrokerMovement>(movements: T[], date: string) {
  return movements.filter((movement) => isOnCalendarDate(movement.date, date));
}

export function filterMovementsByDateRange(
  movements: BrokerMovement[],
  startDate?: string,
  endDate?: string,
) {
  const startTimestamp = startDate ? new Date(`${startDate}T00:00:00.000Z`).getTime() : undefined;
  const endTimestamp = endDate ? new Date(`${endDate}T23:59:59.999Z`).getTime() : undefined;
  const hasStart = startTimestamp !== undefined && Number.isFinite(startTimestamp);
  const hasEnd = endTimestamp !== undefined && Number.isFinite(endTimestamp);

  return movements.filter((movement) => {
    if (!movement.date) return !hasStart && !hasEnd;
    const timestamp = timestampValue(movement.date);
    if (hasStart && timestamp < startTimestamp!) return false;
    if (hasEnd && timestamp > endTimestamp!) return false;
    return true;
  });
}

export function calculateNetCashFlow(movements: BrokerMovement[]) {
  return movements.reduce((total, movement) => {
    const amount = numericValue(movement.amount);
    return total + amount * (movement.kind === "withdrawal" ? -1 : 1);
  }, 0);
}

export function calculatePeriodNetResult(
  trades: AnalyticsTrade[],
  movements: BrokerMovement[],
) {
  return trades.reduce((total, trade) => total + numericValue(trade.pnl), 0)
    + calculateNetCashFlow(movements);
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
