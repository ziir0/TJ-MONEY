import React, { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { calculateBrokerSummary, filterTradesByBroker, formatCurrency } from "@/lib/tradingAnalytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Landmark,
  Plus,
  Search,
  Settings2,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

const BROKER_OPTIONS = ["All Brokers", "Bybit", "Pepperstone"] as const;
type BrokerMovementKind = "deposit" | "withdrawal";

interface MovementRecord {
  id: number;
  broker: string;
  kind: BrokerMovementKind;
  amount: string;
  date: string;
  note?: string | null;
}

const normalizeMovement = (movement: {
  id: number;
  broker: string;
  kind: string;
  amount: string;
  date: string | Date;
  note?: string | null;
}): MovementRecord => ({
  id: movement.id,
  broker: movement.broker,
  kind: movement.kind === "withdrawal" ? "withdrawal" : "deposit",
  amount: String(movement.amount),
  date: movement.date instanceof Date ? movement.date.toISOString() : String(movement.date),
  note: movement.note ?? undefined,
});

export default function Wallet() {
  const utils = trpc.useUtils();
  const activeBrokerQuery = trpc.account.activeBroker.useQuery();
  const selectedBroker = activeBrokerQuery.data ?? "Bybit";
  const [activeBrokerFilter, setActiveBrokerFilter] = useState<string>(selectedBroker);

  // Sync with global active broker whenever it changes
  useEffect(() => {
    if (activeBrokerQuery.data) {
      setActiveBrokerFilter(activeBrokerQuery.data);
    }
  }, [activeBrokerQuery.data]);

  const currentBroker = activeBrokerFilter;

  const { data: allTrades = [] } = trpc.trades.list.useQuery();
  const movementsQuery = trpc.account.movements.useQuery({
    broker: currentBroker === "All Brokers" ? undefined : currentBroker,
  });

  const accountSettingsQuery = trpc.account.settings.useQuery(
    { broker: currentBroker === "All Brokers" ? "Bybit" : currentBroker },
    { enabled: true }
  );

  const normalizedMovements: MovementRecord[] = useMemo(
    () => (movementsQuery.data ?? []).map(normalizeMovement),
    [movementsQuery.data]
  );

  const startingBalanceNum = Number(accountSettingsQuery.data?.startingBalance ?? 0);

  // Broker summary calculation
  const brokerSummary = useMemo(() => {
    return calculateBrokerSummary({
      trades: allTrades,
      broker: currentBroker,
      startingBalance: startingBalanceNum,
      movements: normalizedMovements,
    });
  }, [allTrades, currentBroker, startingBalanceNum, normalizedMovements]);

  // Breakdown by individual brokers
  const bybitMovements = useMemo(
    () => normalizedMovements.filter((m) => m.broker === "Bybit"),
    [normalizedMovements]
  );
  const pepperstoneMovements = useMemo(
    () => normalizedMovements.filter((m) => m.broker === "Pepperstone"),
    [normalizedMovements]
  );

  const bybitSummary = useMemo(
    () => calculateBrokerSummary({ trades: allTrades, broker: "Bybit", movements: bybitMovements }),
    [allTrades, bybitMovements]
  );

  const pepperstoneSummary = useMemo(
    () => calculateBrokerSummary({ trades: allTrades, broker: "Pepperstone", movements: pepperstoneMovements }),
    [allTrades, pepperstoneMovements]
  );

  // Movement Ledger Filters
  const [kindFilter, setKindFilter] = useState<"all" | "deposit" | "withdrawal">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMovements = useMemo(() => {
    return normalizedMovements.filter((m) => {
      if (kindFilter !== "all" && m.kind !== kindFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesNote = m.note?.toLowerCase().includes(query);
        const matchesBroker = m.broker.toLowerCase().includes(query);
        const matchesAmount = m.amount.includes(query);
        if (!matchesNote && !matchesBroker && !matchesAmount) return false;
      }
      return true;
    });
  }, [normalizedMovements, kindFilter, searchQuery]);

  // Mutations
  const addMovementMutation = trpc.account.addMovement.useMutation({
    onSuccess: () => {
      void movementsQuery.refetch();
      toast.success("Cash movement recorded successfully");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to record cash movement");
    },
  });

  const deleteMovementMutation = trpc.account.deleteMovement.useMutation({
    onSuccess: () => {
      void movementsQuery.refetch();
      toast.success("Movement deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete movement");
    },
  });

  const saveActiveBroker = trpc.account.saveActiveBroker.useMutation({
    onSuccess: (newBroker) => {
      utils.account.activeBroker.setData(undefined, newBroker);
      void utils.account.invalidate();
    },
  });

  const saveSettingsMutation = trpc.account.saveSettings.useMutation({
    onSuccess: () => {
      void accountSettingsQuery.refetch();
      toast.success("Starting balance updated");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update starting balance");
    },
  });

  // Dialog State: Movement
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [movementKind, setMovementKind] = useState<BrokerMovementKind>("deposit");
  const [movementBroker, setMovementBroker] = useState<string>(
    currentBroker === "All Brokers" ? "Bybit" : currentBroker
  );
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [movementDate, setMovementDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  });

  const openMovementDialog = (kind: BrokerMovementKind, prefillBroker?: string) => {
    setMovementKind(kind);
    setMovementBroker(prefillBroker ?? (currentBroker === "All Brokers" ? "Bybit" : currentBroker));
    setMovementAmount("");
    setMovementNote("");
    const now = new Date();
    setMovementDate(new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10));
    setMovementDialogOpen(true);
  };

  const handleSaveMovement = () => {
    const parsed = Number(movementAmount);
    if (!Number.isFinite(parsed) || parsed <= 0 || !movementDate) {
      toast.error("Please enter a valid amount and date");
      return;
    }
    addMovementMutation.mutate(
      {
        broker: movementBroker,
        kind: movementKind,
        amount: String(parsed),
        date: new Date(`${movementDate}T12:00:00`).toISOString(),
        note: movementNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setMovementDialogOpen(false);
        },
      }
    );
  };

  // Dialog State: Starting Balance
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsBroker, setSettingsBroker] = useState<string>(
    currentBroker === "All Brokers" ? "Bybit" : currentBroker
  );
  const [settingsAmount, setSettingsAmount] = useState("");
  const [settingsDate, setSettingsDate] = useState("");

  const openSettingsDialog = (broker?: string) => {
    const targetBroker = broker ?? (currentBroker === "All Brokers" ? "Bybit" : currentBroker);
    setSettingsBroker(targetBroker);
    setSettingsAmount(String(startingBalanceNum || 0));
    const now = new Date();
    setSettingsDate(new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10));
    setSettingsDialogOpen(true);
  };

  const handleSaveSettings = () => {
    const parsed = Number(settingsAmount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Please enter a valid non-negative starting balance");
      return;
    }
    saveSettingsMutation.mutate(
      {
        broker: settingsBroker,
        startingBalance: String(parsed),
        startingBalanceDate: new Date(`${settingsDate || new Date().toISOString().slice(0, 10)}T12:00:00`),
      },
      {
        onSuccess: () => {
          setSettingsDialogOpen(false);
        },
      }
    );
  };

  // Dialog State: Delete Confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const confirmDelete = () => {
    if (deletingId === null) return;
    deleteMovementMutation.mutate(
      { id: deletingId },
      {
        onSettled: () => setDeletingId(null),
      }
    );
  };

  const depositCount = normalizedMovements.filter((m) => m.kind === "deposit").length;
  const withdrawalCount = normalizedMovements.filter((m) => m.kind === "withdrawal").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Wallet & Capital</h1>
            <Badge variant="outline" className="border-border/80 font-mono text-xs text-muted-foreground">
              {currentBroker}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage deposits, withdrawals, broker capital allocations, and cash movement history.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Broker Selector */}
          <Select
            value={currentBroker}
            onValueChange={(val) => {
              setActiveBrokerFilter(val);
              utils.account.activeBroker.setData(undefined, val);
              saveActiveBroker.mutate({ broker: val });
            }}
          >
            <SelectTrigger className="h-9 w-[150px] bg-background/80 font-medium text-xs sm:text-sm" aria-label="Select broker filter">
              <SelectValue placeholder="Broker" />
            </SelectTrigger>
            <SelectContent>
              {BROKER_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Record Deposit */}
          <Button
            type="button"
            size="sm"
            onClick={() => openMovementDialog("deposit")}
            className="h-9 gap-1.5 bg-emerald-600 font-medium text-white hover:bg-emerald-500 shadow-sm"
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>Deposit</span>
          </Button>

          {/* Record Withdrawal */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openMovementDialog("withdrawal")}
            className="h-9 gap-1.5 border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Withdraw</span>
          </Button>

          {/* Starting Balance */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => openSettingsDialog()}
            className="h-9 gap-1.5"
            title="Configure Starting Balance"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Starting Capital</span>
          </Button>
        </div>
      </div>

      {/* Capital KPI Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        {/* Net Account Balance */}
        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Net Liquidity
            </p>
            <WalletIcon className="h-4 w-4 text-primary" />
          </div>
          <p
            className={`mt-1 truncate text-2xl font-bold tabular-nums sm:text-3xl ${
              brokerSummary.currentBalance >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {formatCurrency(brokerSummary.currentBalance)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Capital + Net P&L ({formatCurrency(brokerSummary.realizedPnl)})
          </p>
        </Card>

        {/* Total Deposits */}
        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total Deposits
            </p>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1 truncate text-2xl font-bold tabular-nums text-profit sm:text-3xl">
            {formatCurrency(brokerSummary.totalDeposits)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {depositCount} {depositCount === 1 ? "transaction" : "transactions"}
          </p>
        </Card>

        {/* Total Withdrawals */}
        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total Withdrawals
            </p>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-1 truncate text-2xl font-bold tabular-nums text-loss sm:text-3xl">
            {formatCurrency(brokerSummary.totalWithdrawals)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {withdrawalCount} {withdrawalCount === 1 ? "transaction" : "transactions"}
          </p>
        </Card>

        {/* Net Cash Flow */}
        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Net Inflow
            </p>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <p
            className={`mt-1 truncate text-2xl font-bold tabular-nums sm:text-3xl ${
              brokerSummary.netCashFlow >= 0 ? "text-profit" : "text-loss"
            }`}
          >
            {formatCurrency(brokerSummary.netCashFlow)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Deposits minus Withdrawals
          </p>
        </Card>

        {/* Starting Capital */}
        <Card className="terminal-card border-border/60 bg-card/60 p-3 sm:p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Starting Capital
            </p>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 truncate text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
            {formatCurrency(startingBalanceNum)}
          </p>
          <button
            type="button"
            onClick={() => openSettingsDialog()}
            className="mt-0.5 text-[10px] text-primary hover:underline"
          >
            Edit baseline capital
          </button>
        </Card>
      </div>

      {/* Broker Accounts Overview (Multi-Broker Distribution) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Bybit Card */}
        <Card className="terminal-card border-border/60 bg-card/40 p-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <h3 className="font-semibold tracking-tight">Bybit Account</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => openMovementDialog("deposit", "Bybit")}
              >
                + Deposit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => openMovementDialog("withdrawal", "Bybit")}
              >
                - Withdraw
              </Button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:text-left">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Deposited</p>
              <p className="font-mono text-sm font-semibold text-profit">
                {formatCurrency(bybitSummary.totalDeposits)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Withdrawn</p>
              <p className="font-mono text-sm font-semibold text-loss">
                {formatCurrency(bybitSummary.totalWithdrawals)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Trades P&L</p>
              <p
                className={`font-mono text-sm font-semibold ${
                  bybitSummary.realizedPnl >= 0 ? "text-profit" : "text-loss"
                }`}
              >
                {formatCurrency(bybitSummary.realizedPnl)}
              </p>
            </div>
          </div>
        </Card>

        {/* Pepperstone Card */}
        <Card className="terminal-card border-border/60 bg-card/40 p-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <h3 className="font-semibold tracking-tight">Pepperstone Account</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => openMovementDialog("deposit", "Pepperstone")}
              >
                + Deposit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => openMovementDialog("withdrawal", "Pepperstone")}
              >
                - Withdraw
              </Button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:text-left">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Deposited</p>
              <p className="font-mono text-sm font-semibold text-profit">
                {formatCurrency(pepperstoneSummary.totalDeposits)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Withdrawn</p>
              <p className="font-mono text-sm font-semibold text-loss">
                {formatCurrency(pepperstoneSummary.totalWithdrawals)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">Trades P&L</p>
              <p
                className={`font-mono text-sm font-semibold ${
                  pepperstoneSummary.realizedPnl >= 0 ? "text-profit" : "text-loss"
                }`}
              >
                {formatCurrency(pepperstoneSummary.realizedPnl)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Cash Movement Ledger */}
      <Card className="terminal-card border-border/60 bg-card/60 p-4">
        {/* Table Toolbar */}
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Cash Movement History</h2>
            <Badge variant="secondary" className="font-mono text-xs">
              {filteredMovements.length} {filteredMovements.length === 1 ? "record" : "records"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative w-full sm:w-[220px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search note or broker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Kind Tabs */}
            <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setKindFilter("all")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  kindFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setKindFilter("deposit")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  kindFilter === "deposit" ? "bg-background text-profit shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Deposits
              </button>
              <button
                type="button"
                onClick={() => setKindFilter("withdrawal")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  kindFilter === "withdrawal" ? "bg-background text-loss shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Withdrawals
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[140px]">Date</TableHead>
                <TableHead className="w-[130px]">Broker</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="min-w-[180px]">Note / Memo</TableHead>
                <TableHead className="w-[70px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <WalletIcon className="h-8 w-8 text-muted-foreground/50" />
                      <p className="text-sm">No cash movements recorded yet.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openMovementDialog("deposit")}
                        className="mt-1 h-8 gap-1 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Record first deposit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((movement) => {
                  const isDeposit = movement.kind === "deposit";
                  const dateObj = new Date(movement.date);
                  const formattedDate = Number.isNaN(dateObj.getTime())
                    ? movement.date
                    : dateObj.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });

                  return (
                    <TableRow key={movement.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formattedDate}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            movement.broker === "Bybit"
                              ? "border-amber-500/30 text-amber-500"
                              : "border-emerald-500/30 text-emerald-500"
                          }
                        >
                          {movement.broker}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isDeposit
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                              : "border-rose-500/40 bg-rose-500/10 text-rose-500"
                          }
                        >
                          {isDeposit ? (
                            <ArrowDownLeft className="mr-1 h-3 w-3 inline" />
                          ) : (
                            <ArrowUpRight className="mr-1 h-3 w-3 inline" />
                          )}
                          {isDeposit ? "Deposit" : "Withdrawal"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm font-semibold tabular-nums ${
                          isDeposit ? "text-profit" : "text-loss"
                        }`}
                      >
                        {isDeposit ? "+" : "-"}
                        {formatCurrency(Math.abs(Number(movement.amount || 0)))}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={movement.note || ""}>
                        {movement.note || <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(movement.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete movement ${movement.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Record Deposit / Withdrawal Modal */}
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {movementKind === "deposit" ? "Record Deposit" : "Record Withdrawal"}
            </DialogTitle>
            <DialogDescription>
              Log cash flow for your trading account capital ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Kind Toggle */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={movementKind === "deposit" ? "default" : "outline"}
                className={movementKind === "deposit" ? "bg-emerald-600 text-white hover:bg-emerald-500" : ""}
                onClick={() => setMovementKind("deposit")}
              >
                <ArrowDownLeft className="mr-1.5 h-4 w-4" />
                Deposit
              </Button>
              <Button
                type="button"
                variant={movementKind === "withdrawal" ? "default" : "outline"}
                className={movementKind === "withdrawal" ? "bg-rose-600 text-white hover:bg-rose-500" : ""}
                onClick={() => setMovementKind("withdrawal")}
              >
                <ArrowUpRight className="mr-1.5 h-4 w-4" />
                Withdrawal
              </Button>
            </div>

            {/* Broker Select */}
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="movement-broker">
                Broker Account
              </label>
              <Select value={movementBroker} onValueChange={setMovementBroker}>
                <SelectTrigger id="movement-broker" className="h-9">
                  <SelectValue placeholder="Select broker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bybit">Bybit</SelectItem>
                  <SelectItem value="Pepperstone">Pepperstone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="movement-amount">
                Amount ($)
              </label>
              <Input
                id="movement-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="1000.00"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                autoFocus
              />
            </div>

            {/* Date */}
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="movement-date">
                Date
              </label>
              <Input
                id="movement-date"
                type="date"
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
              />
            </div>

            {/* Note */}
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="movement-note">
                Note / Description (Optional)
              </label>
              <Input
                id="movement-note"
                placeholder="e.g. Wire transfer, Monthly profit withdrawal"
                value={movementNote}
                onChange={(e) => setMovementNote(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMovementDialogOpen(false)}
              disabled={addMovementMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveMovement}
              disabled={addMovementMutation.isPending || !movementAmount || !movementDate}
              className={movementKind === "deposit" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"}
            >
              {addMovementMutation.isPending ? "Recording..." : `Confirm ${movementKind === "deposit" ? "Deposit" : "Withdrawal"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Starting Capital Modal */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Starting Capital</DialogTitle>
            <DialogDescription>
              Set the baseline capital balance used to calculate your overall net liquidity and equity curve.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="settings-broker">
                Broker
              </label>
              <Select value={settingsBroker} onValueChange={setSettingsBroker}>
                <SelectTrigger id="settings-broker" className="h-9">
                  <SelectValue placeholder="Select broker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bybit">Bybit</SelectItem>
                  <SelectItem value="Pepperstone">Pepperstone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="settings-amount">
                Starting Capital ($)
              </label>
              <Input
                id="settings-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={settingsAmount}
                onChange={(e) => setSettingsAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="settings-date">
                Baseline Inception Date
              </label>
              <Input
                id="settings-date"
                type="date"
                value={settingsDate}
                onChange={(e) => setSettingsDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsDialogOpen(false)}
              disabled={saveSettingsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveSettings}
              disabled={saveSettingsMutation.isPending || !settingsAmount}
            >
              {saveSettingsMutation.isPending ? "Saving..." : "Save Baseline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deletingId !== null} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cash Movement?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this cash movement from your ledger and adjust your net capital calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMovementMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMovementMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMovementMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
