import { createTradeSchema, type CreateTradeInput } from "@shared/schemas";

export const MAX_IMPORT_ROWS = 500;

type ImportError = {
  row: number;
  message: string;
};

export type TradeImportResult = {
  rows: CreateTradeInput[];
  errors: ImportError[];
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
    } else if (character === "," && !quoted) {
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
  return header.toLowerCase().replace(/[\s_-]+/g, "");
}

function getField(row: Record<string, string>, ...names: string[]) {
  for (const name of names) {
    const value = row[normalizeHeader(name)];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

export function parseTradeCsv(text: string): TradeImportResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error("CSV must include a header row and at least one trade row");

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rawRows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });

  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`CSV imports are limited to ${MAX_IMPORT_ROWS} rows`);
  }

  const rows: CreateTradeInput[] = [];
  const errors: ImportError[] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
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
      pnl: getField(rawRow, "pnl", "profitLoss", "netPnl") ?? "",
      tradeDate: getField(rawRow, "tradeDate", "date", "datetime", "timestamp") ?? "",
      exitDate: getField(rawRow, "exitDate", "exitDatetime", "closeDate") || undefined,
      notes,
    };

    const result = createTradeSchema.safeParse(candidate);
    if (result.success) {
      rows.push(result.data);
    } else {
      errors.push({
        row: rowNumber,
        message: result.error.issues.map((issue) => issue.message).join("; "),
      });
    }
  });

  return { rows, errors };
}
