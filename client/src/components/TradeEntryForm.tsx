import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTradeSchema } from "@shared/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface TradeEntryFormProps {
  onSuccess?: () => void;
}

export default function TradeEntryForm({ onSuccess }: TradeEntryFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const utils = trpc.useUtils();
  
  const createTradeMutation = trpc.trades.create.useMutation({
    onSuccess: () => {
      toast.success("Trade recorded successfully");
      form.reset();
      utils.trades.list.invalidate();
      utils.stats.calculate.invalidate();
      onSuccess?.();
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create trade");
    },
  });

  const form = useForm<any>({
    resolver: zodResolver(createTradeSchema as any),
    defaultValues: {
      symbol: "",
      direction: "long",
      entryPrice: "",
      exitPrice: "",
      quantity: "",
      fees: "0",
      pnl: "",
      tradeDate: new Date().toISOString().slice(0, 16),
      exitDate: "",
      notes: "",
    },
  });

  const onSubmit = (values: any) => {
    const tradeDate = typeof values.tradeDate === 'string'
      ? new Date(values.tradeDate)
      : values.tradeDate;
    const exitDate = values.exitDate
      ? (typeof values.exitDate === 'string' ? new Date(values.exitDate) : values.exitDate)
      : undefined;

    createTradeMutation.mutate({
      ...values,
      tradeDate,
      exitDate,
    });
  };

  const calculatePnL = () => {
    const entry = parseFloat(form.getValues("entryPrice"));
    const exit = parseFloat(form.getValues("exitPrice"));
    const qty = parseFloat(form.getValues("quantity"));
    const fees = parseFloat(form.getValues("fees")) || 0;
    const direction = form.getValues("direction");

    if (!isNaN(entry) && !isNaN(exit) && !isNaN(qty)) {
      let pnl = (exit - entry) * qty;
      if (direction === "short") {
        pnl = (entry - exit) * qty;
      }
      pnl -= fees;
      form.setValue("pnl", pnl.toFixed(2));
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="gap-2">
        + New Trade
      </Button>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Record a Trade</CardTitle>
        <CardDescription>
          Enter the details of your trade to track performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Symbol */}
              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol</FormLabel>
                    <FormControl>
                      <Input placeholder="AAPL, BTC/USD, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Direction */}
              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direction</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="long">Long</SelectItem>
                        <SelectItem value="short">Short</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Entry Price */}
              <FormField
                control={form.control}
                name="entryPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Exit Price */}
              <FormField
                control={form.control}
                name="exitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exit Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fees */}
              <FormField
                control={form.control}
                name="fees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fees</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Trade Date & Time */}
              <FormField
                control={form.control}
                name="tradeDate"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Trade Date & Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Exit Date & Time */}
              <FormField
                control={form.control}
                name="exitDate"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Exit Date & Time <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>Used to analyze trade duration.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* P&L */}
              <FormField
                control={form.control}
                name="pnl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>P&L</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Auto-calculated or enter manually
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trade Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any notes about this trade..."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Record your reasoning, setup, or any observations
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsOpen(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={calculatePnL}
              >
                Calculate P&L
              </Button>
              <Button
                type="submit"
                disabled={createTradeMutation.isPending}
                className="gap-2"
              >
                {createTradeMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Save Trade
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
