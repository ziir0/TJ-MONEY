import React, { useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";

const assetOptions = [
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Crypto" },
  { value: "stocks", label: "Stocks" },
  { value: "indices", label: "Indices" },
  { value: "other", label: "Other" },
] as const;

const unitOptions = [
  { value: "lots", label: "Lots" },
  { value: "units", label: "Units" },
  { value: "coins", label: "Coins" },
  { value: "shares", label: "Shares" },
  { value: "contracts", label: "Contracts" },
] as const;

interface TradeEntryFormProps {
  onSuccess?: () => void;
  trade?: any;
}

export default function TradeEntryForm({ onSuccess, trade }: TradeEntryFormProps) {
  // Both new and edit dialogs must remain closed until the user clicks the trigger.
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

  const updateTradeMutation = trpc.trades.update.useMutation({
    onSuccess: () => {
      toast.success("Trade updated successfully");
      utils.trades.list.invalidate();
      utils.stats.calculate.invalidate();
      onSuccess?.();
      setIsOpen(false);
    },
    onError: (error) => toast.error(error.message || "Failed to update trade"),
  });

  const form = useForm<any>({
    resolver: zodResolver(createTradeSchema as any),
    defaultValues: {
      symbol: "",
      assetType: "other",
      quantityUnit: "units",
      contractSize: "",
      pnlSource: "calculated",
      isInvoluntary: false,
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

  useEffect(() => {
    if (!trade) return;
    form.reset({
      symbol: trade.symbol,
      assetType: trade.assetType ?? "other",
      quantityUnit: trade.quantityUnit ?? "units",
      contractSize: trade.contractSize ?? "",
      pnlSource: trade.pnlSource ?? "calculated",
      isInvoluntary: trade.isInvoluntary ?? false,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.quantity,
      fees: trade.fees ?? "0",
      pnl: trade.pnl,
      tradeDate: new Date(trade.tradeDate).toISOString().slice(0, 16),
      exitDate: trade.exitDate ? new Date(trade.exitDate).toISOString().slice(0, 16) : "",
      notes: trade.notes ?? "",
    });
  }, [trade, form]);

  const onSubmit = (values: any) => {
    const tradeDate = typeof values.tradeDate === 'string'
      ? new Date(values.tradeDate)
      : values.tradeDate;
    const exitDate = values.exitDate
      ? (typeof values.exitDate === 'string' ? new Date(values.exitDate) : values.exitDate)
      : undefined;

    const payload = {
      ...values,
      tradeDate,
      exitDate,
    };
    if (trade) updateTradeMutation.mutate({ id: trade.id, updates: payload });
    else createTradeMutation.mutate(payload);
  };

  const calculatePnL = () => {
    const toNumber = (value: unknown) => {
      const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
      return Number(normalized);
    };
    const entry = toNumber(form.getValues("entryPrice"));
    const exit = toNumber(form.getValues("exitPrice"));
    const qty = toNumber(form.getValues("quantity"));
    const fees = toNumber(form.getValues("fees")) || 0;
    const direction = form.getValues("direction");
    const assetType = form.getValues("assetType");
    const quantityUnit = form.getValues("quantityUnit");
    const contractSize = toNumber(form.getValues("contractSize")) || (assetType === "forex" && quantityUnit === "lots" ? 100000 : 1);

    if (Number.isFinite(entry) && Number.isFinite(exit) && Number.isFinite(qty)) {
      let pnl = (exit - entry) * qty;
      if (direction === "short") {
        pnl = (entry - exit) * qty;
      }
      if (assetType === "forex" && quantityUnit === "lots") {
        pnl *= contractSize;
      }
      pnl -= fees;
      // Keep sub-cent results instead of rounding them to 0.00.
      const precisePnl = pnl.toFixed(8).replace(/0+$/, "").replace(/\.$/, "") || "0";
      form.setValue("pnl", precisePnl, { shouldDirty: true, shouldValidate: true });
      form.setValue("pnlSource", "calculated", { shouldDirty: true });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={trade ? "outline" : "default"} size={trade ? "sm" : "default"} className="gap-2">
          {trade ? <><Pencil className="h-4 w-4" /> Edit</> : "+ New Trade"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{trade ? "Edit Trade" : "Record a Trade"}</DialogTitle>
          <DialogDescription>
            {trade ? "Correct or complete the details of this trade." : "Enter the details of your trade to track performance."}
          </DialogDescription>
        </DialogHeader>
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

              <FormField
                control={form.control}
                name="assetType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asset Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select asset type" /></SelectTrigger></FormControl>
                      <SelectContent>{assetOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormDescription>Controls quantity and P&amp;L interpretation.</FormDescription>
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

              <FormField
                control={form.control}
                name="quantityUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger></FormControl>
                      <SelectContent>{unitOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contractSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Size <span className="text-muted-foreground font-normal">(Forex)</span></FormLabel>
                    <FormControl><Input type="number" min="0" step="0.01" placeholder="100000" {...field} /></FormControl>
                    <FormDescription>For Forex, 0.02 lots × 100,000 = 2,000 units.</FormDescription>
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
                        step="0.00000001"
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

              <FormField
                control={form.control}
                name="isInvoluntary"
                render={({ field }) => (
                  <FormItem className="md:col-span-2 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={Boolean(field.value)}
                        onChange={(event) => field.onChange(event.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-amber-600"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Trade involuntário</FormLabel>
                      <FormDescription>
                        Marque quando a ordem foi executada por engano ou sem intenção.
                      </FormDescription>
                    </div>
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
                disabled={createTradeMutation.isPending || updateTradeMutation.isPending}
                className="gap-2"
              >
                {(createTradeMutation.isPending || updateTradeMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {trade ? "Update Trade" : "Save Trade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
