import React, { useEffect, useMemo, useState } from "react";
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
import { ImagePlus, Loader2, Pencil, X } from "lucide-react";

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;
const SCREENSHOT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function toDateTimeLocalValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

function readScreenshotAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

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

const brokerOptions = [
  { value: "Bybit", label: "Bybit" },
  { value: "Pepperstone", label: "Pepperstone" },
] as const;

interface TradeEntryFormProps {
  onSuccess?: () => void;
  trade?: any;
  compact?: boolean;
  wide?: boolean;
}

export default function TradeEntryForm({ onSuccess, trade, compact = false, wide = false }: TradeEntryFormProps) {
  // Both new and edit dialogs must remain closed until the user clicks the trigger.
  const [isOpen, setIsOpen] = useState(false);
  const [screenshots, setScreenshots] = useState<Array<{ key: string; url: string | null }>>([]);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [isUploadingScreenshots, setIsUploadingScreenshots] = useState(false);
  const utils = trpc.useUtils();
  const { data: activeBroker = "Bybit" } = trpc.account.activeBroker.useQuery();
  const existingScreenshotKeys = useMemo(
    () => trade ? [trade.screenshot1, trade.screenshot2].filter((key): key is string => typeof key === "string" && key.length > 0) : [],
    [trade],
  );
  const { data: existingScreenshotUrls = {} } = trpc.trades.screenshotUrls.useQuery(
    { keys: existingScreenshotKeys, variant: "original" },
    { enabled: isOpen && existingScreenshotKeys.length > 0, staleTime: 20 * 60 * 60 * 1000 },
  );
  const uploadScreenshotMutation = trpc.trades.uploadScreenshot.useMutation();
  const screenshotPreviews = useMemo(
    () => screenshotFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [screenshotFiles],
  );

  useEffect(() => () => screenshotPreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [screenshotPreviews]);

  const createTradeMutation = trpc.trades.create.useMutation({
    onSuccess: () => {
      toast.success("Trade recorded successfully");
      form.reset();
      setScreenshots([]);
      setScreenshotFiles([]);
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
      setScreenshotFiles([]);
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
      broker: "Bybit",
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
      tradeDate: toDateTimeLocalValue(new Date()),
      exitDate: "",
      notes: "",
      screenshot1: null,
      screenshot2: null,
    },
  });

  useEffect(() => {
    if (activeBroker && activeBroker !== "All Brokers") {
      form.setValue("broker", activeBroker);
    }
  }, [activeBroker, form]);

  useEffect(() => {
    if (!trade) return;
    form.reset({
      broker: trade.broker ?? "Bybit",
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
      tradeDate: toDateTimeLocalValue(trade.tradeDate),
      exitDate: trade.exitDate ? toDateTimeLocalValue(trade.exitDate) : "",
      notes: trade.notes ?? "",
      screenshot1: trade.screenshot1 ?? null,
      screenshot2: trade.screenshot2 ?? null,
    });
    const existingScreenshots: Array<{ key: string | null; url: string | null }> = [
      { key: trade.screenshot1, url: null },
      { key: trade.screenshot2, url: null },
    ];
    setScreenshots(existingScreenshots.filter((screenshot): screenshot is { key: string; url: string | null } => Boolean(screenshot.key)));
    setScreenshotFiles([]);
  }, [trade, form]);

  useEffect(() => {
    if (Object.keys(existingScreenshotUrls).length === 0) return;
    setScreenshots((current) => current.map((screenshot) => ({
      ...screenshot,
      url: existingScreenshotUrls[screenshot.key] ?? screenshot.url,
    })));
  }, [existingScreenshotUrls]);

  const onSubmit = async (values: any) => {
    const tradeDate = typeof values.tradeDate === 'string'
      ? new Date(values.tradeDate)
      : values.tradeDate;
    const exitDate = values.exitDate
      ? (typeof values.exitDate === 'string' ? new Date(values.exitDate) : values.exitDate)
      : undefined;

    setIsUploadingScreenshots(true);
    try {
      const uploadedKeys: string[] = [];
      for (const file of screenshotFiles) {
        const result = await uploadScreenshotMutation.mutateAsync({
          contentType: file.type as typeof SCREENSHOT_TYPES[number],
          dataBase64: await readScreenshotAsBase64(file),
        });
        uploadedKeys.push(result.key);
      }

      const keys = [...screenshots.map((screenshot) => screenshot.key), ...uploadedKeys];
      const payload = {
        ...values,
        tradeDate,
        exitDate,
        screenshot1: keys[0] ?? null,
        screenshot2: keys[1] ?? null,
      };
      if (trade) updateTradeMutation.mutate({ id: trade.id, updates: payload });
      else createTradeMutation.mutate(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload trade screenshots");
    } finally {
      setIsUploadingScreenshots(false);
    }
  };

  const handleScreenshotSelection = (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    const invalidType = selected.find((file) => !SCREENSHOT_TYPES.includes(file.type as typeof SCREENSHOT_TYPES[number]));
    if (invalidType) {
      toast.error("Screenshots must be JPEG, PNG, or WebP images");
      return;
    }
    const oversized = selected.find((file) => file.size > MAX_SCREENSHOT_SIZE);
    if (oversized) {
      toast.error("Each screenshot must be 5 MB or smaller");
      return;
    }
    const availableSlots = 2 - screenshots.length - screenshotFiles.length;
    if (selected.length > availableSlots) {
      toast.error("A trade can have up to 2 screenshots");
    }
    setScreenshotFiles((current) => [...current, ...selected.slice(0, Math.max(availableSlots, 0))]);
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
        <Button
          variant={trade ? "outline" : "default"}
          size={trade ? "sm" : "default"}
          className={wide && !trade ? "w-full justify-start gap-2" : compact && !trade ? "h-8 shrink-0 whitespace-nowrap px-1 text-[11px] min-[360px]:h-9 min-[360px]:px-2 min-[360px]:text-xs @[53rem]:px-3 @[53rem]:text-sm" : "gap-2"}
          aria-label={trade ? "Edit trade" : "New Trade"}
          title={compact && !trade ? "New Trade" : undefined}
        >
          {trade ? <><Pencil className="h-4 w-4" /> Edit</> : compact ? "New Trade" : "+ New Trade"}
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
              <FormField
                control={form.control}
                name="broker"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Broker</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? "Bybit"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select broker" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {brokerOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <Input type="datetime-local" step="1" {...field} />
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
                      <Input type="datetime-local" step="1" {...field} />
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

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Trade screenshots <span className="text-muted-foreground font-normal">(optional, up to 2)</span></p>
                <p className="text-xs text-muted-foreground">Attach chart screenshots to review the executed setup later.</p>
              </div>
              {(screenshots.length > 0 || screenshotPreviews.length > 0) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {screenshots.map(({ key, url }) => (
                    <div key={key} className="relative overflow-hidden rounded-md border bg-muted">
                      {url ? <img src={url} alt="Trade chart screenshot" className="aspect-video w-full object-contain" /> : <div className="flex aspect-video items-center justify-center text-xs text-muted-foreground">Screenshot unavailable</div>}
                      <Button type="button" variant="secondary" size="icon" className="absolute right-2 top-2 h-8 w-8" aria-label="Remove screenshot" onClick={() => setScreenshots((current) => current.filter((item) => item.key !== key))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {screenshotPreviews.map(({ file, url }, index) => (
                    <div key={`${file.name}-${file.lastModified}`} className="relative overflow-hidden rounded-md border bg-muted">
                      <img src={url} alt={`New trade screenshot ${index + 1}`} className="aspect-video w-full object-contain" />
                      <Button type="button" variant="secondary" size="icon" className="absolute right-2 top-2 h-8 w-8" aria-label="Remove selected screenshot" onClick={() => setScreenshotFiles((current) => current.filter((item) => item !== file))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {screenshots.length + screenshotFiles.length < 2 && (
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  aria-label="Add trade screenshots"
                  onChange={(event) => {
                    handleScreenshotSelection(event.target.files);
                    event.target.value = "";
                  }}
                  className="max-w-md"
                />
              )}
            </div>

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
                disabled={createTradeMutation.isPending || updateTradeMutation.isPending || isUploadingScreenshots}
                className="gap-2"
              >
                {(createTradeMutation.isPending || updateTradeMutation.isPending || isUploadingScreenshots) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {isUploadingScreenshots ? "Uploading..." : trade ? "Update Trade" : "Save Trade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
