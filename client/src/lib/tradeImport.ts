import { createTradeSchema, type CreateTradeInput } from "@shared/schemas";

export const MAX_IMPORT_ROWS = 500;

type ImportError = { row: number; message: string };
export type TradeImportSource = "standard" | "tradingview" | "pepperstone" | "mixed";
export type TradeImportResult = {
  rows: CreateTradeInput[];
  errors: ImportError[];
  source: TradeImportSource;
  warnings: string[];
  requiresSymbol: boolean;
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];
    if (character === '"' && quoted && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if ((character === "," || character === ";" || character === "\t") && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(header: string) {
  return header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}

function getField(row: Record<string, string>, ...names: string[]) {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

function parseNumber(value: string | undefined) {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/[%$€£]/g, "").replace(/\s/g, "");
  if (!cleaned) return undefined;
  const negative = cleaned.startsWith("(") && cleaned.endsWith(")");
  const unwrapped = cleaned.replace(/[()]/g, "");
  const normalized = unwrapped.includes(",") && !unwrapped.includes(".") ? unwrapped.replace(",", ".") : unwrapped.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? (negative ? -number : number) : undefined;
}

function parseDateValue(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/, "$3-$2-$1");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toRawRows(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV must include a header row and at least one trade row");
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rawRows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    return {
      rowNumber: index + 2,
      values: headers.reduce<Record<string, string>>((row, header, valueIndex) => {
        const duplicateNumber = Object.keys(row).filter((existing) => existing === header || existing.startsWith(`${header}_`)).length;
        const key = duplicateNumber === 0 ? header : `${header}_${duplicateNumber + 1}`;
        row[key] = values[valueIndex] ?? "";
        return row;
      }, {}),
    };
  });
  if (rawRows.length > MAX_IMPORT_ROWS) throw new Error(`CSV imports are limited to ${MAX_IMPORT_ROWS} rows`);
  return { headers, rawRows };
}

function isTradingViewHeaders(headers: string[]) {
  const headerSet = new Set(headers);
  return headerSet.has("type") && (headerSet.has("datetime") || headerSet.has("date") || headerSet.has("dateandtime")) && headerSet.has("trade") && (headerSet.has("price") || headerSet.has("entryprice") || headerSet.has("exitprice"));
}

function isPepperstoneHeaders(headers: string[]) {
  const headerSet = new Set(headers);
  return headerSet.has("simbolo") && headerSet.has("lado") && headerSet.has("tipo") && headerSet.has("qtde") && headerSet.has("status") && headerSet.has("tempodeatualizacao");
}

function parseStandardCsv(text: string): TradeImportResult {
  const { rawRows } = toRawRows(text);
  const rows: CreateTradeInput[] = [];
  const errors: ImportError[] = [];
  rawRows.forEach(({ values: rawRow, rowNumber }) => {
    const direction = getField(rawRow, "direction", "side")?.toLowerCase();
    const assetType = getField(rawRow, "assetType", "asset", "market")?.toLowerCase();
    const quantityUnit = getField(rawRow, "quantityUnit", "unit")?.toLowerCase();
    const pnlSource = getField(rawRow, "pnlSource", "pnlOrigin")?.toLowerCase();
    const notes = getField(rawRow, "notes", "tradeNotes") ?? "";
    const isBrokerStatement = Boolean(getField(rawRow, "netUsd", "netProfit", "brokerPnl")) || /imported from statement/i.test(notes);
    const candidate = {
      symbol: getField(rawRow, "symbol", "ticker", "instrument") ?? "",
      assetType: assetType === "forex" || assetType === "crypto" || assetType === "stocks" || assetType === "indices" || assetType === "other" ? assetType : isBrokerStatement ? "forex" : "other",
      quantityUnit: quantityUnit === "lots" || quantityUnit === "units" || quantityUnit === "coins" || quantityUnit === "shares" || quantityUnit === "contracts" ? quantityUnit : isBrokerStatement ? "lots" : "units",
      contractSize: getField(rawRow, "contractSize", "contract") || undefined,
      pnlSource: pnlSource === "broker" || isBrokerStatement ? "broker" : "calculated",
      direction: direction === "short" ? "short" : direction === "long" ? "long" : direction,
      entryPrice: getField(rawRow, "entryPrice", "entry", "openPrice") ?? "",
      exitPrice: getField(rawRow, "exitPrice", "exit", "closePrice") ?? "",
      quantity: getField(rawRow, "quantity", "qty", "size") ?? "",
      fees: getField(rawRow, "fees", "commission") ?? "0",
      pnl: getField(rawRow, "pnl", "p&l", "pl", "profit", "profitLoss", "netPnl") ?? "",
      tradeDate: getField(rawRow, "tradeDate", "date", "datetime", "timestamp") ?? "",
      exitDate: getField(rawRow, "exitDate", "exitDatetime", "closeDate") || undefined,
      notes,
    };
    const result = createTradeSchema.safeParse(candidate);
    if (result.success) rows.push(result.data);
    else errors.push({ row: rowNumber, message: result.error.issues.map((issue) => issue.message).join("; ") });
  });
  return { rows, errors, source: "standard", warnings: [], requiresSymbol: false };
}

function directionFromText(value: string) {
  const text = value.toLowerCase();
  if (/short|sell|vender/.test(text)) return "short" as const;
  if (/long|buy|compr/.test(text)) return "long" as const;
  return undefined;
}

function parseTradingViewCsv(text: string, symbolOverride?: string): TradeImportResult {
  const { rawRows } = toRawRows(text);
  const groups = new Map<string, typeof rawRows>();
  rawRows.forEach((row, index) => {
    const tradeNumber = getField(row.values, "trade", "trade#", "tradeId") ?? `row-${index + 1}`;
    groups.set(tradeNumber, [...(groups.get(tradeNumber) ?? []), row]);
  });
  const rows: CreateTradeInput[] = [];
  const errors: ImportError[] = [];
  const warnings: string[] = [];
  groups.forEach((group, tradeNumber) => {
    const descriptions = group.map(({ values }) => getField(values, "type", "side", "signal") ?? "").join(" ");
    const entry = group.find(({ values }) => /entry|open|buy|sell|long|short/i.test(getField(values, "type", "side", "signal") ?? "")) ?? group[0];
    const exit = [...group].reverse().find(({ values }) => /exit|close/i.test(getField(values, "type", "side", "signal") ?? "")) ?? group[group.length - 1];
    const direction = directionFromText(getField(entry.values, "type", "side", "signal") ?? descriptions) ?? directionFromText(descriptions);
    const entryDate = parseDateValue(getField(entry.values, "dateTime", "dateAndTime", "datetime", "date", "time"));
    const exitDate = parseDateValue(getField(exit.values, "exitDate", "exitDateTime", "closeDate", "dateTime", "dateAndTime", "datetime", "date", "time"));
    const entryPrice = parseNumber(getField(entry.values, "entryPrice", "openPrice", "price"));
    const exitPrice = parseNumber(getField(exit.values, "exitPrice", "closePrice", "price"));
    const quantity = parseNumber(getField(entry.values, "contracts", "quantity", "qty", "size"));
    const pnl = parseNumber(getField(exit.values, "profit", "pnl", "profitLoss", "netProfit")) ?? parseNumber(getField(entry.values, "profit", "pnl", "profitLoss", "netProfit"));
    const symbol = getField(entry.values, "symbol", "ticker", "instrument") ?? symbolOverride?.trim() ?? "";
    if (!direction || !entryDate || !exitDate || entryPrice === undefined || exitPrice === undefined || quantity === undefined || pnl === undefined || !symbol) {
      errors.push({ row: entry.rowNumber, message: `TradingView trade ${tradeNumber} is missing a paired entry/exit, price, quantity, P&L, symbol, or valid timestamp` });
      return;
    }
    const result = createTradeSchema.safeParse({ symbol, assetType: "other", quantityUnit: "units", pnlSource: "calculated", direction, entryPrice: String(entryPrice), exitPrice: String(exitPrice), quantity: String(quantity), fees: "0", pnl: String(pnl), tradeDate: entryDate, exitDate, notes: `Imported from TradingView (trade ${tradeNumber})` });
    if (result.success) rows.push(result.data);
    else errors.push({ row: entry.rowNumber, message: result.error.issues.map((issue) => issue.message).join("; ") });
  });
  if (groups.size !== rawRows.length) warnings.push(`Grouped ${rawRows.length} TradingView rows into ${groups.size} trades using Trade #.`);
  return { rows, errors, source: "tradingview", warnings, requiresSymbol: !getField(rawRows[0]?.values ?? {}, "symbol", "ticker", "instrument") && !symbolOverride?.trim() };
}

type PepperstoneOrder = {
  rowNumber: number;
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  filled: number;
  price: number;
  status: string;
  time: Date;
  profit: number;
  commission: number;
  orderId: string;
};

function pepperstoneStatusIsExecuted(value: string) {
  return /executed|filled|executado/i.test(value);
}

function pepperstoneIsMarket(value: string) {
  return /market|mercado/i.test(value);
}

function pepperstoneIsBuy(value: string) {
  return /buy|comprar/i.test(value);
}

function formatNumber(value: number) {
  return `${value.toFixed(12).replace(/0+$/, "").replace(/\.$/, "") || "0"}`;
}

function parsePepperstoneCsv(text: string): TradeImportResult {
  const { rawRows } = toRawRows(text);
  const errors: ImportError[] = [];
  const warnings: string[] = [];
  const parsed: PepperstoneOrder[] = [];
  rawRows.forEach(({ values, rowNumber }) => {
    const quantity = parseNumber(getField(values, "qtde", "quantity", "qty"));
    const filled = parseNumber(getField(values, "qtdPreenchida", "filledQuantity", "filledQty"));
    const price = parseNumber(getField(values, "precoMedDePreenchimento", "averageFillPrice", "fillPrice"));
    const time = parseDateValue(getField(values, "tempoDeAtualizacao", "updatedAt", "updateTime"));
    const symbol = getField(values, "simbolo", "symbol") ?? "";
    if (!symbol || quantity === undefined || filled === undefined || price === undefined || !time) {
      errors.push({ row: rowNumber, message: "Pepperstone row is missing symbol, quantity, filled quantity, average fill price, or a valid update time" });
      return;
    }
    parsed.push({
      rowNumber,
      symbol,
      side: getField(values, "lado", "side") ?? "",
      type: getField(values, "tipo", "type") ?? "",
      quantity,
      filled,
      price,
      status: getField(values, "status") ?? "",
      time,
      profit: parseNumber(getField(values, "profit", "pnl")) ?? 0,
      commission: parseNumber(getField(values, "commission", "comissao")) ?? 0,
      orderId: getField(values, "idDaOrdem", "orderId") ?? "",
    });
  });

  const seen = new Set<string>();
  const orders = parsed.filter((order) => {
    const canonicalId = order.orderId.includes(":") ? order.orderId.split(":")[1] : order.orderId;
    const key = [order.symbol, order.side, order.type, order.quantity, order.filled, order.price, order.status, order.time.getTime(), order.profit, order.commission, canonicalId].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const duplicatesRemoved = parsed.length - orders.length;
  if (duplicatesRemoved > 0) warnings.push(`Removed ${duplicatesRemoved} duplicate Pepperstone execution/protection row${duplicatesRemoved === 1 ? "" : "s"}.`);

  const lots = new Map<string, { buy: { side: string; quantity: number; price: number; time: Date; commission: number; row: number }[]; sell: { side: string; quantity: number; price: number; time: Date; commission: number; row: number }[] }>();
  const rows: CreateTradeInput[] = [];
  const sorted = orders.filter((order) => pepperstoneStatusIsExecuted(order.status) && order.filled > 0).sort((a, b) => a.time.getTime() - b.time.getTime());
  const getQueues = (symbol: string) => {
    const existing = lots.get(symbol) ?? { buy: [], sell: [] };
    lots.set(symbol, existing);
    return existing;
  };
  sorted.forEach((order) => {
    const queues = getQueues(order.symbol);
    if (pepperstoneIsMarket(order.type)) {
      (pepperstoneIsBuy(order.side) ? queues.buy : queues.sell).push({ side: order.side, quantity: order.filled, price: order.price, time: order.time, commission: order.commission, row: order.rowNumber });
      return;
    }
    const entries = pepperstoneIsBuy(order.side) ? queues.sell : queues.buy;
    let remaining = order.filled;
    while (remaining > 1e-12 && entries.length > 0) {
      const entry = entries[0];
      const matched = Math.min(entry.quantity, remaining);
      const exitFraction = order.filled > 0 ? matched / order.filled : 1;
      const entryFraction = entry.quantity > 0 ? matched / entry.quantity : 1;
      const result = createTradeSchema.safeParse({
        symbol: order.symbol,
        assetType: /usd|eur|gbp|jpy|cad|aud|nzd/i.test(order.symbol) && !/sol|btc|eth/i.test(order.symbol) ? "forex" : /sol|btc|eth|xrp/i.test(order.symbol) ? "crypto" : "other",
        quantityUnit: "lots",
        pnlSource: "broker",
        direction: pepperstoneIsBuy(entry.side) ? "long" : "short",
        entryPrice: formatNumber(entry.price),
        exitPrice: formatNumber(order.price),
        quantity: formatNumber(matched),
        fees: formatNumber(Math.abs(entry.commission) * entryFraction + Math.abs(order.commission) * exitFraction),
        pnl: formatNumber(order.profit * exitFraction),
        tradeDate: entry.time,
        exitDate: order.time,
        notes: `Imported from Pepperstone order history; entry row ${entry.row}, exit row ${order.rowNumber}`,
      });
      if (result.success) rows.push(result.data);
      else errors.push({ row: order.rowNumber, message: result.error.issues.map((issue) => issue.message).join("; ") });
      entry.quantity -= matched;
      remaining -= matched;
      if (entry.quantity <= 1e-12) entries.shift();
    }
    if (remaining > 1e-12) warnings.push(`Pepperstone exit on row ${order.rowNumber} could not be matched for ${formatNumber(remaining)} units.`);
  });
  const unmatched = Array.from(lots.values()).flatMap((queue) => [...queue.buy, ...queue.sell]).filter((entry) => entry.quantity > 1e-12);
  if (unmatched.length > 0) warnings.push(`${unmatched.length} Pepperstone entry order${unmatched.length === 1 ? "" : "s"} had no executed closing order and were not imported.`);
  return { rows, errors, source: "pepperstone", warnings, requiresSymbol: false };
}

export function parseTradeCsv(text: string, options?: { symbolOverride?: string }): TradeImportResult {
  const { headers } = toRawRows(text);
  if (isPepperstoneHeaders(headers)) return parsePepperstoneCsv(text);
  if (isTradingViewHeaders(headers)) return parseTradingViewCsv(text, options?.symbolOverride);
  return parseStandardCsv(text);
}

export async function parseTradeCsvFiles(files: { name: string; text: string }[]): Promise<TradeImportResult> {
  const results = files.map((file) => ({ file, result: parseTradeCsv(file.text) }));
  const sources = Array.from(new Set(results.map(({ result }) => result.source)));
  const source: TradeImportSource = sources.length === 1 ? (sources[0] ?? "standard") : "mixed";
  return {
    rows: results.flatMap(({ result }) => result.rows),
    errors: results.flatMap(({ file, result }) => result.errors.map((error) => ({ ...error, message: `${file.name}: ${error.message}` }))),
    warnings: results.flatMap(({ file, result }) => result.warnings.map((warning) => `${file.name}: ${warning}`)),
    source,
    requiresSymbol: results.some(({ result }) => result.requiresSymbol),
  };
}
