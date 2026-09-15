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
} from "@shared/schemas";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(() => ({ success: true }) as const),
  }),

  trades: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserTrades(ctx.user.id);
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
      .input(z.date().or(z.string().transform(v => new Date(v))))
      .query(async ({ ctx, input }) => {
        return await db.getJournalByDate(ctx.user.id, input);
      }),

    upsert: protectedProcedure
      .input(z.object({
        date: z.date().or(z.string().transform(v => new Date(v))),
        content: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await db.upsertJournal(ctx.user.id, input.date, input.content);
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
});

export type AppRouter = typeof appRouter;
