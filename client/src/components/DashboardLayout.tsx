import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, Moon, PanelLeft, PanelRightOpen, BarChart3, FileText, List, ArrowDownLeft, ArrowUpRight, Sun } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { filterTradesByBroker } from "@/lib/tradingAnalytics";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import CSVImport from "@/components/CSVImport";
import TradeExport from "@/components/TradeExport";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import TradeEntryForm from "@/components/TradeEntryForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: List, label: "Trades & Calendar", path: "/trades" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: FileText, label: "Journal", path: "/journal" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const BROKER_OPTIONS = ["All Brokers", "Bybit", "Pepperstone"] as const;
const COMPACT_TOPBAR_MIN_WIDTH = 640;
const EXPANDED_TOPBAR_MIN_WIDTH = 1000;
const TOPBAR_LABELS_MIN_WIDTH = 1000;

type BrokerMovementKind = "deposit" | "withdrawal";

const normalizeBrokerMovement = (movement: {
  id: number;
  broker: string;
  kind: string;
  amount: string;
  date: string | Date;
  note?: string | null;
}) => ({
  ...movement,
  kind: (movement.kind === "deposit" || movement.kind === "withdrawal" ? movement.kind : "deposit") as BrokerMovementKind,
  date: movement.date instanceof Date ? movement.date.toISOString() : movement.date,
  note: movement.note ?? undefined,
});

function BrokerSelectControl({
  selectedBroker,
  onValueChange,
}: {
  selectedBroker: string;
  onValueChange: (broker: string) => void;
}) {
  return (
    <Select value={selectedBroker} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-[84px] min-[360px]:h-9 min-[360px]:w-[108px] sm:w-[140px] @[60rem]:w-[180px]" aria-label="Select broker">
        <SelectValue placeholder="Select broker" />
      </SelectTrigger>
      <SelectContent>
        {BROKER_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>{option}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BrokerCashControls({
  selectedBroker,
  movements,
  onAddMovement,
  isSaving,
  compact = false,
  stacked = false,
  singleLine = false,
}: {
  selectedBroker: string;
  movements: Array<{ id: number; broker: string; kind: BrokerMovementKind; amount: string; date: string; note?: string | null }>;
  onAddMovement: (kind: BrokerMovementKind, amount: string, note: string, date: string) => void;
  isSaving: boolean;
  compact?: boolean;
  stacked?: boolean;
  singleLine?: boolean;
}) {
  const [activeKind, setActiveKind] = useState<BrokerMovementKind | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [movementDate, setMovementDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  });

  const filteredMovements = selectedBroker === "All Brokers"
    ? movements
    : movements.filter((movement) => movement.broker === selectedBroker);

  const totalDeposits = filteredMovements
    .filter((movement) => movement.kind === "deposit")
    .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);

  const totalWithdrawals = filteredMovements
    .filter((movement) => movement.kind === "withdrawal")
    .reduce((sum, movement) => sum + Number(movement.amount || 0), 0);

  const openMovementForm = (kind: BrokerMovementKind) => {
    setActiveKind(kind);
    setAmount("");
    setNote("");
    const now = new Date();
    setMovementDate(new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10));
  };

  const addMovement = () => {
    const parsed = Number(amount);
    if (!activeKind || selectedBroker === "All Brokers" || !Number.isFinite(parsed) || parsed <= 0 || !movementDate) return;
    onAddMovement(activeKind, String(parsed), note.trim(), movementDate);
    setActiveKind(null);
    setAmount("");
    setNote("");
  };

  return (
    <>
      <div className={singleLine ? "flex shrink-0 flex-nowrap items-center justify-end gap-2" : stacked ? "flex flex-col gap-3" : "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"}>
        <div className={singleLine ? "flex shrink-0 items-center gap-1 rounded-lg border bg-background px-2 py-1.5 xl:gap-2" : "flex items-center gap-1 rounded-lg border bg-background px-2 py-1.5 xl:gap-2"}>
          <span className={compact ? "sr-only @[62.5rem]:not-sr-only text-xs font-medium text-muted-foreground" : "text-xs font-medium text-muted-foreground"}>Deposits</span>
          {compact && <span className="text-[10px] font-medium text-muted-foreground @[62.5rem]:hidden" aria-hidden="true">Dep</span>}
          <span className="text-sm font-semibold text-profit">${totalDeposits.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">|</span>
          <span className={compact ? "sr-only @[62.5rem]:not-sr-only text-xs font-medium text-muted-foreground" : "text-xs font-medium text-muted-foreground"}>Withdrawals</span>
          {compact && <span className="text-[10px] font-medium text-muted-foreground @[62.5rem]:hidden" aria-hidden="true">Wd</span>}
          <span className="text-sm font-semibold text-loss">${totalWithdrawals.toFixed(2)}</span>
        </div>

        <div className={singleLine ? "flex shrink-0 flex-nowrap items-center gap-2" : stacked ? "grid w-full gap-2" : "flex flex-wrap items-center gap-2"}>
          <Button type="button" size={stacked ? "default" : "icon"} variant="outline" className={stacked ? "h-9 w-full justify-start gap-2" : compact ? "h-8 w-8 @[62.5rem]:h-9 @[62.5rem]:w-auto @[62.5rem]:px-3" : "h-9 w-auto gap-1 px-3"} onClick={() => openMovementForm("deposit")} disabled={selectedBroker === "All Brokers"} aria-label="Deposit" title={compact ? "Deposit" : undefined}>
            <ArrowDownLeft className="h-4 w-4 text-profit" />
            <span className={compact ? "sr-only @[62.5rem]:not-sr-only" : ""}>Deposit</span>
          </Button>
          <Button type="button" size={stacked ? "default" : "icon"} variant="outline" className={stacked ? "h-9 w-full justify-start gap-2" : compact ? "h-8 w-8 @[62.5rem]:h-9 @[62.5rem]:w-auto @[62.5rem]:px-3" : "h-9 w-auto gap-1 px-3"} onClick={() => openMovementForm("withdrawal")} disabled={selectedBroker === "All Brokers"} aria-label="Withdraw" title={compact ? "Withdraw" : undefined}>
            <ArrowUpRight className="h-4 w-4 text-loss" />
            <span className={compact ? "sr-only @[62.5rem]:not-sr-only" : ""}>Withdraw</span>
          </Button>
        </div>
      </div>

      <Dialog open={activeKind !== null} onOpenChange={(open) => { if (!open) setActiveKind(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeKind === "deposit" ? "Record deposit" : "Record withdrawal"}</DialogTitle>
            <DialogDescription>{selectedBroker} cash movement</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="cash-movement-amount">
              Amount
              <Input id="cash-movement-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="cash-movement-date">
              Date
              <Input id="cash-movement-date" type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="cash-movement-note">
              Note
              <Input id="cash-movement-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActiveKind(null)} disabled={isSaving}>Cancel</Button>
            <Button type="button" onClick={addMovement} disabled={isSaving || !amount || !movementDate}>
              {isSaving ? "Saving..." : activeKind === "deposit" ? "Confirm deposit" : "Confirm withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const activeBrokerQuery = trpc.account.activeBroker.useQuery();
  const selectedBroker = activeBrokerQuery.data ?? "Bybit";
  const { data: toolbarTrades = [] } = trpc.trades.list.useQuery();
  const brokerToolbarTrades = filterTradesByBroker(toolbarTrades, selectedBroker);
  const saveActiveBroker = trpc.account.saveActiveBroker.useMutation();
  const movementsQuery = trpc.account.movements.useQuery({ broker: selectedBroker === "All Brokers" ? undefined : selectedBroker });
  const normalizedMovements = (movementsQuery.data ?? []).map(normalizeBrokerMovement);
  const addMovementMutation = trpc.account.addMovement.useMutation({
    onSuccess: () => {
      void movementsQuery.refetch();
    },
  });
  const sidebarRef = useRef<HTMLDivElement>(null);
  const topbarRowRef = useRef<HTMLDivElement>(null);
  const [hasInlineActionsSpace, setHasInlineActionsSpace] = useState(false);
  const isMobile = useIsMobile();
  const showInlineActions = !isMobile && hasInlineActionsSpace;

  useEffect(() => {
    const topbarRow = topbarRowRef.current;
    if (!topbarRow) return;

    const updateInlineSpace = () => {
      const availableWidth = topbarRow.clientWidth;
      const requiredWidth = availableWidth >= TOPBAR_LABELS_MIN_WIDTH
        ? EXPANDED_TOPBAR_MIN_WIDTH
        : COMPACT_TOPBAR_MIN_WIDTH;
      setHasInlineActionsSpace(!isMobile && availableWidth >= requiredWidth);
    };
    const observer = new ResizeObserver(updateInlineSpace);
    observer.observe(topbarRow);
    updateInlineSpace();

    return () => observer.disconnect();
  }, [isMobile]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex flex-col min-w-0 leading-none">
                  <span className="font-semibold tracking-tight truncate">
                    Money Options
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
                    Trading Journal
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <div className="@container sticky top-0 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <div ref={topbarRowRef} className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1 sm:gap-2">
              {isMobile && <SidebarTrigger className="h-8 w-8 shrink-0 rounded-lg bg-background min-[360px]:h-9 min-[360px]:w-9" />}
              <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground @[41rem]:inline">Broker</span>
                <BrokerSelectControl
                  selectedBroker={selectedBroker}
                  onValueChange={(broker) => saveActiveBroker.mutate({ broker }, { onSuccess: () => void activeBrokerQuery.refetch() })}
                />
              </div>
              <TradeEntryForm compact />
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={showInlineActions ? "hidden" : "h-8 w-8 shrink-0 min-[360px]:h-9 min-[360px]:w-9"}
                  aria-label="Open trading actions"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(88vw,360px)] overflow-y-auto p-0">
                <SheetHeader className="border-b pr-12">
                  <SheetTitle>Trading actions</SheetTitle>
                  <SheetDescription>{selectedBroker} account</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 p-4">
                  {!showInlineActions && (
                    <BrokerCashControls
                      selectedBroker={selectedBroker}
                      movements={normalizedMovements}
                      isSaving={addMovementMutation.isPending}
                      stacked
                      onAddMovement={(kind, amount, note, date) => {
                        addMovementMutation.mutate({
                          broker: selectedBroker,
                          kind,
                          amount,
                          date: new Date(`${date}T12:00:00`).toISOString(),
                          note: note || undefined,
                        });
                      }}
                    />
                  )}
                  <div className="grid gap-2 border-t pt-4 md:hidden">
                    <CSVImport fullWidth />
                    <TradeExport trades={brokerToolbarTrades} showSummary={false} fullWidth />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className={showInlineActions ? "flex min-w-0 shrink-0 items-center justify-end" : "hidden"}>
              <BrokerCashControls
                selectedBroker={selectedBroker}
                movements={normalizedMovements}
                isSaving={addMovementMutation.isPending}
                compact
                singleLine
                onAddMovement={(kind, amount, note, date) => {
                  addMovementMutation.mutate({
                    broker: selectedBroker,
                    kind,
                    amount,
                    date: new Date(`${date}T12:00:00`).toISOString(),
                    note: note || undefined,
                  });
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 min-[360px]:h-9 min-[360px]:w-9"
              onClick={() => toggleTheme?.()}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <main className="min-w-0 flex-1 p-2 sm:p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
