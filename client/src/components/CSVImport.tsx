import React, { useRef, useState } from "react";
import { parseTradeCsv, MAX_IMPORT_ROWS } from "@/lib/tradeImport";
import type { CreateTradeInput } from "@shared/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileUp, Loader2, RotateCcw } from "lucide-react";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

type ImportRow = CreateTradeInput;

export default function CSVImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const utils = trpc.useUtils();

  const importMutation = trpc.trades.bulkCreate.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.importedCount} trades imported successfully`);
      setRows([]);
      setErrors([]);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
      utils.trades.list.invalidate();
      utils.stats.calculate.invalidate();
      setIsExpanded(false);
    },
    onError: (error) => toast.error(error.message || "Failed to import trades"),
  });

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("CSV file must be smaller than 2 MB");
      return;
    }

    try {
      const parsed = parseTradeCsv(await file.text());
      setFileName(file.name);
      setRows(parsed.rows);
      setErrors(parsed.errors);
      setIsExpanded(true);

      if (parsed.errors.length > 0) {
        toast.warning(`${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} need attention and will not be imported`);
      } else {
        toast.success(`${parsed.rows.length} valid trade${parsed.rows.length === 1 ? "" : "s"} ready to import`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read CSV file");
      setRows([]);
      setErrors([]);
    }
  };

  const reset = () => {
    setRows([]);
    setErrors([]);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Import Trades</CardTitle>
          <CardDescription>
            Upload a CSV with symbol, direction, entry price, exit price, quantity, fees, P&L, trade date, and optional exit date. Up to {MAX_IMPORT_ROWS} rows per import.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={() => setIsExpanded((value) => !value)} className="gap-2 shrink-0">
          <FileUp className="h-4 w-4" />
          {isExpanded ? "Hide Import" : "Import CSV"}
        </Button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="max-w-md"
            />
            <Button variant="ghost" onClick={reset} disabled={!fileName && rows.length === 0} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>

          {fileName && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> · {rows.length} valid row{rows.length === 1 ? "" : "s"}
            </p>
          )}

          {errors.length > 0 && (
            <div className="rounded-lg border border-loss/30 bg-loss/5 p-3 space-y-2">
              <p className="text-sm font-medium text-loss">Rows skipped during validation</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {errors.slice(0, 10).map((error) => (
                  <p key={`${error.row}-${error.message}`} className="text-xs text-muted-foreground">
                    Row {error.row}: {error.message}
                  </p>
                ))}
                {errors.length > 10 && <p className="text-xs text-muted-foreground">…and {errors.length - 10} more</p>}
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{rows.length} ready</Badge>
                {errors.length > 0 && <Badge variant="outline">{errors.length} skipped</Badge>}
              </div>
              <Button
                onClick={() => importMutation.mutate({
                  trades: rows.map((row) => ({ ...row, exitDate: row.exitDate })),
                })}
                disabled={importMutation.isPending}
                className="gap-2"
              >
                {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Import {rows.length} Trade{rows.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
