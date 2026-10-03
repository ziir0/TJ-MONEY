import React, { useRef, useState } from "react";
import { parseTradeCsv, parseTradeCsvFiles, MAX_IMPORT_ROWS, type TradeImportSource } from "@/lib/tradeImport";
import type { CreateTradeInput } from "@shared/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileCheck2, FileUp, Loader2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
type ImportRow = CreateTradeInput;

function sourceLabel(source: TradeImportSource) {
  if (source === "pepperstone") return "Pepperstone";
  if (source === "bybit") return "Bybit";
  if (source === "tradingview") return "TradingView";
  if (source === "mixed") return "Multiple sources";
  return "CSV";
}

export default function CSVImport({ compact = false, fullWidth = false }: { compact?: boolean; fullWidth?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [source, setSource] = useState<TradeImportSource>("standard");
  const [requiresSymbol, setRequiresSymbol] = useState(false);
  const [symbolOverride, setSymbolOverride] = useState("");
  const [rawText, setRawText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const utils = trpc.useUtils();

  const importMutation = trpc.trades.bulkCreate.useMutation({
    onSuccess: (result) => {
      const skipped = result.skippedCount ?? 0;
      toast.success(`${result.importedCount} trade${result.importedCount === 1 ? "" : "s"} imported successfully${skipped > 0 ? ` · ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : ""}`);
      setRows([]);
      setErrors([]);
      setWarnings([]);
      setFileName("");
      setRawText("");
      setRequiresSymbol(false);
      if (inputRef.current) inputRef.current.value = "";
      utils.trades.list.invalidate();
      utils.stats.calculate.invalidate();
      setIsExpanded(false);
    },
    onError: (error) => toast.error(error.message || "Failed to import trades"),
  });

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (files.some((file) => file.size > MAX_FILE_SIZE)) {
      toast.error(`Each CSV file must be smaller than ${MAX_FILE_SIZE / 1024 / 1024} MB`);
      return;
    }

    try {
      const parsed = await parseTradeCsvFiles(await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() }))));
      setFileName(files.map((file) => file.name).join(", "));
      setRows(parsed.rows);
      setErrors(parsed.errors);
      setWarnings(parsed.warnings);
      setSource(parsed.source);
      setRequiresSymbol(parsed.requiresSymbol);
      setRawText(files.length === 1 ? await files[0].text() : "");
      setIsExpanded(true);

      if (parsed.errors.length > 0) {
        toast.warning(`${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} need attention and will not be imported`);
      } else {
        toast.success(`${parsed.rows.length} valid ${sourceLabel(parsed.source)} trade${parsed.rows.length === 1 ? "" : "s"} ready to import`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read CSV file");
      setRows([]);
      setErrors([]);
      setWarnings([]);
      setRequiresSymbol(false);
      setRawText("");
    }
  };

  const reset = () => {
    setRows([]);
    setErrors([]);
    setWarnings([]);
    setFileName("");
    setSource("standard");
    setRequiresSymbol(false);
    setSymbolOverride("");
    setRawText("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsExpanded(true)}
        className={fullWidth ? "w-full justify-start gap-2" : compact ? "h-8 w-8 shrink-0 p-0 @[53rem]:h-9 @[53rem]:w-auto @[53rem]:px-3" : "gap-2 shrink-0"}
        aria-label="Import CSV"
        title={compact ? "Import CSV" : undefined}
      >
          <FileUp className="h-4 w-4" />
          <span className={compact ? "sr-only @[53rem]:not-sr-only" : ""}>Import CSV</span>
      </Button>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Trades</DialogTitle>
            <DialogDescription>
              Upload standard, TradingView, Pepperstone, or Bybit CSV files. Broker orders are grouped into completed trades, canceled protective orders are ignored, and each file can contain up to {MAX_IMPORT_ROWS} rows.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={(event) => {
                const files = event.target.files;
                if (files) void handleFiles(files);
              }}
              className="max-w-md"
            />
            <Button variant="ghost" onClick={reset} disabled={!fileName && rows.length === 0} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {fileName && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {(source === "tradingview" || source === "pepperstone" || source === "bybit") && <Badge variant="default" className="gap-1"><FileCheck2 className="h-3 w-3" /> {sourceLabel(source)}</Badge>}
              <span><span className="font-medium text-foreground">{fileName}</span> · {rows.length} valid trade{rows.length === 1 ? "" : "s"}</span>
            </div>
          )}

          {source === "tradingview" && requiresSymbol && rawText && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
              <p className="text-sm font-medium">TradingView did not include the chart symbol</p>
              <p className="text-xs text-muted-foreground">Enter the symbol shown on the TradingView chart so the imported trades keep their correct instrument.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={symbolOverride} onChange={(event) => setSymbolOverride(event.target.value.toUpperCase())} placeholder="Example: SOLUSD" className="max-w-xs" aria-label="TradingView symbol" />
                <Button variant="secondary" disabled={!symbolOverride.trim()} onClick={() => {
                  const parsed = parseTradeCsv(rawText, { symbolOverride });
                  setRows(parsed.rows);
                  setErrors(parsed.errors);
                  setWarnings(parsed.warnings);
                  setRequiresSymbol(parsed.requiresSymbol);
                }}>Apply symbol</Button>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
              {warnings.map((warning) => <p key={warning} className="text-xs text-muted-foreground">{warning}</p>)}
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded-lg border border-loss/30 bg-loss/5 p-3 space-y-2">
              <p className="text-sm font-medium text-loss">Rows skipped during validation</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {errors.slice(0, 10).map((error) => <p key={`${error.row}-${error.message}`} className="text-xs text-muted-foreground">Row {error.row}: {error.message}</p>)}
                {errors.length > 10 && <p className="text-xs text-muted-foreground">…and {errors.length - 10} more</p>}
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{rows.length} ready</Badge>
                {errors.length > 0 && <Badge variant="outline">{errors.length} skipped</Badge>}
                {source === "pepperstone" && <Badge variant="outline">Orders grouped into trades</Badge>}
                {source === "bybit" && <Badge variant="outline">Entries + TP/SL grouped into trades</Badge>}
                {source === "tradingview" && <Badge variant="outline">Entry + exit times detected</Badge>}
              </div>
              <Button onClick={() => importMutation.mutate({ trades: rows.map((row) => ({ ...row, exitDate: row.exitDate })) })} disabled={importMutation.isPending} className="gap-2">
                {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {rows.length} Trade{rows.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
