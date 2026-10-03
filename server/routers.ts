import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc.js";
import { TRPCError } from "@trpc/server";
import * as db from "./db.js";
import {
  createTradeSchema,
  bulkCreateTradesSchema,
  updateTradeSchema,
  deleteTradeSchema,
  dateRangeSchema,
} from "../shared/schemas.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getTradeScreenshotSignedUrl, uploadTradeScreenshot } from "./storage.js";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      console.info("[TJ Auth] auth.me reached", {
        userPresent: Boolean(opts.ctx.user),
        userIdPresent: Boolean(opts.ctx.user?.id),
        nodeEnv: process.env.NODE_ENV ?? "undefined",
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        supabaseConfigured: Boolean(process.env.SUPABASE_URL),
        supabaseSecretConfigured: Boolean(process.env.SUPABASE_SECRET_KEY),
      });
      return opts.ctx.user;
    }),
    logout: publicProcedure.mutation(() => ({ success: true }) as const),
  }),

  trades: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      let userTrades;
      try {
        userTrades = await db.getUserTrades(ctx.user.id);
      } catch (error) {
        console.error("[TJ Trades] Failed to list trades", {
          message: error instanceof Error ? error.message : "Unknown database error",
        });
        throw error;
      }

      return Promise.all(userTrades.map(async (trade) => {
        const [screenshot1Url, screenshot2Url] = await Promise.all(
          [trade.screenshot1, trade.screenshot2].map(async (key) => {
            if (!key) return null;
            try {
              return await getTradeScreenshotSignedUrl(key);
            } catch (error) {
              console.error("[TJ Trades] Failed to sign screenshot URL", {
                message: error instanceof Error ? error.message : "Unknown storage error",
              });
              return null;
            }
          }),
        );
        return { ...trade, screenshot1Url, screenshot2Url };
      }));
    }),

    uploadScreenshot: protectedProcedure
      .input(z.object({
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        dataBase64: z.string().min(1).max(7 * 1024 * 1024),
      }))
      .mutation(async ({ ctx, input }) => {
        const image = Buffer.from(input.dataBase64, "base64");
        if (image.length === 0 || image.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Screenshot must be smaller than 5 MB" });
        }

        const validSignature = input.contentType === "image/jpeg"
          ? image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
          : input.contentType === "image/png"
            ? image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
            : image.subarray(0, 4).toString() === "RIFF" && image.subarray(8, 12).toString() === "WEBP";
        if (!validSignature) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported or invalid image file" });
        }

        try {
          const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType.slice(6);
          const key = await uploadTradeScreenshot(`${ctx.user.id}/${randomUUID()}.${extension}`, image, input.contentType);
          return { key };
        } catch (error) {
          console.error("[TJ Trades] Screenshot upload failed", {
            message: error instanceof Error ? error.message : "Unknown storage error",
          });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to upload trade screenshot" });
        }
      }),

    listByDate: protectedProcedure
      .input(z.date().or(z.string().transform(v => new Date(v))))
      .query(async ({ ctx, input }) => {
        return await db.getTradesByDate(ctx.user.id, input);
      }),

    listByDateRange: protectedProcedure
      .input(dateRangeSchema)
      .query(async ({ ctx, input }) => {
        if (!input.startDate || !input.endDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "startDate and endDate are required",
          });
        }
        return await db.getTradesByDateRange(ctx.user.id, input.startDate, input.endDate);
      }),

    create: protectedProcedure
      .input(createTradeSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.createTrade({
            ...input,
            userId: ctx.user.id,
          });
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create trade",
          });
        }
      }),

    bulkCreate: protectedProcedure
      .input(bulkCreateTradesSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.bulkCreateTrades(ctx.user.id, input.trades);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to import trades",
          });
        }
      }),

    update: protectedProcedure
      .input(updateTradeSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.updateTrade(ctx.user.id, input.id, input.updates);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update trade",
          });
        }
      }),

    delete: protectedProcedure
      .input(deleteTradeSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.deleteTrade(ctx.user.id, input.id);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete trade",
          });
        }
      }),
  }),

  journal: router({
    getByDate: protectedProcedure
      .input(z.object({
        date: z.date().or(z.string().transform(v => new Date(v))),
        broker: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getJournalByDate(ctx.user.id, input.date, input.broker);
      }),

    upsert: protectedProcedure
      .input(z.object({
        date: z.date().or(z.string().transform(v => new Date(v))),
        content: z.string(),
        broker: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.upsertJournal(ctx.user.id, input.date, input.content, input.broker ?? "Bybit");
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to save journal entry",
          });
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.deleteJournal(ctx.user.id, input.id);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to delete journal entry",
          });
        }
      }),
  }),

  stats: router({
    calculate: protectedProcedure
      .input(dateRangeSchema)
      .query(async ({ ctx, input }) => {
        return await db.calculateStats(ctx.user.id, input.startDate, input.endDate);
      }),
  }),

  account: router({
    settings: protectedProcedure.query(async ({ ctx }) => {
      return await db.getAccountSettings(ctx.user.id);
    }),

    activeBroker: protectedProcedure.query(async ({ ctx }) => {
      const settings = await db.getAccountSettings(ctx.user.id);
      return settings?.broker ?? "Bybit";
    }),

    saveActiveBroker: protectedProcedure
      .input(z.object({ broker: z.string().trim().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const existing = await db.getAccountSettings(ctx.user.id);
          return await db.upsertAccountSettings(ctx.user.id, {
            broker: input.broker,
            startingBalance: existing?.startingBalance ?? "0",
            startingBalanceDate: existing?.startingBalanceDate ?? new Date(),
          });
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save active broker" });
        }
      }),

    movements: protectedProcedure
      .input(z.object({ broker: z.string().optional() }).default({}))
      .query(async ({ ctx, input }) => {
        return await db.getBrokerMovements(ctx.user.id, input.broker);
      }),

    addMovement: protectedProcedure
      .input(z.object({
        broker: z.string().trim().min(1).max(64),
        kind: z.enum(["deposit", "withdrawal"]),
        amount: z.union([z.string(), z.number()]),
        date: z.date().or(z.string().transform((value) => new Date(value))).optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.addBrokerMovement(ctx.user.id, {
            broker: input.broker,
            kind: input.kind,
            amount: input.amount,
            date: input.date,
            note: input.note,
          });
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save cash movement" });
        }
      }),

    deleteMovement: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.deleteBrokerMovement(ctx.user.id, input.id);
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete cash movement" });
        }
      }),

    saveSettings: protectedProcedure
      .input(z.object({
        broker: z.string().trim().min(1).max(64).optional(),
        startingBalance: z.string().trim().refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, "Starting balance must be a valid non-negative number"),
        startingBalanceDate: z.date().or(z.string().transform((value) => new Date(value))),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.upsertAccountSettings(ctx.user.id, {
            broker: input.broker ?? "Bybit",
            startingBalance: input.startingBalance,
            startingBalanceDate: input.startingBalanceDate,
          });
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save account settings" });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
