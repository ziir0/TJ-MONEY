import { z } from "zod";

const numericString = (label: string) =>
  z.preprocess(
    (value) => (typeof value === "number" ? String(value) : value),
    z
      .string({ message: `${label} is required` })
      .trim()
      .min(1, `${label} is required`)
      .refine((value) => Number.isFinite(Number(value)), `${label} must be a valid number`)
      .transform((value) => value),
  );

const nonNegativeNumericString = (label: string) =>
  numericString(label).refine((value) => Number(value) >= 0, `${label} cannot be negative`);

const normalizeDateValue = (value: unknown) => {
  if (value === "" || value === undefined || value === null) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return value;
};

const tradeDateSchema = z.preprocess(
  normalizeDateValue,
  z.date().refine((value) => !Number.isNaN(value.getTime()), "Trade date must be valid"),
);

const optionalTradeDateSchema = z.preprocess(
  normalizeDateValue,
  z.date().refine((value) => !Number.isNaN(value.getTime()), "Exit date must be valid").optional(),
);

export const createTradeSchema = z.object({
  symbol: z.string().trim().min(1, "Symbol is required").max(20),
  direction: z.enum(["long", "short"]),
  entryPrice: nonNegativeNumericString("Entry price"),
  exitPrice: nonNegativeNumericString("Exit price"),
  quantity: numericString("Quantity").refine((value) => Number(value) > 0, "Quantity must be greater than zero"),
  fees: nonNegativeNumericString("Fees").default("0"),
  pnl: numericString("P&L"),
  tradeDate: tradeDateSchema,
  exitDate: optionalTradeDateSchema,
  notes: z.string().max(5000, "Notes are too long").optional(),
});

export const bulkCreateTradesSchema = z.object({
  trades: z.array(createTradeSchema).min(1, "At least one trade is required").max(500, "Import is limited to 500 trades at a time"),
});

export const updateTradeSchema = z.object({
  id: z.number().int().positive(),
  updates: createTradeSchema.partial(),
});

export const deleteTradeSchema = z.object({
  id: z.number().int().positive(),
});

export const dateRangeSchema = z.object({
  startDate: tradeDateSchema.optional(),
  endDate: tradeDateSchema.optional(),
});

export type CreateTradeInput = z.infer<typeof createTradeSchema>;
export type BulkCreateTradesInput = z.infer<typeof bulkCreateTradesSchema>;
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;
export type DeleteTradeInput = z.infer<typeof deleteTradeSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
