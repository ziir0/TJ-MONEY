import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Sliders,
  Search,
  Check,
  Building2,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  Save,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ALL_SUPPORTED_BROKERS,
  DEFAULT_ENABLED_BROKERS,
  BROKER_METADATA,
  BrokerCategory,
  getBrokerMeta,
  sanitizeEnabledBrokers,
} from "@shared/brokers";

const CATEGORIES: Array<"All" | BrokerCategory> = [
  "All",
  "Crypto",
  "Forex & CFD",
  "Multi-Asset",
  "Equities & Options",
];

export default function Settings() {
  const utils = trpc.useUtils();

  const { data: serverBrokers = DEFAULT_ENABLED_BROKERS, isLoading } =
    trpc.account.enabledBrokers.useQuery(undefined, {
      staleTime: 60_000,
    });

  const { data: activeBroker = "Bybit" } = trpc.account.activeBroker.useQuery(undefined, {
    staleTime: 60_000,
  });

  const [selectedBrokers, setSelectedBrokers] = useState<string[]>(serverBrokers);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"All" | BrokerCategory>("All");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Synchronize with server state on load
  const serverBrokersKey = (serverBrokers ?? []).join(",");
  const lastKeyRef = useRef(serverBrokersKey);

  useEffect(() => {
    if (serverBrokersKey !== lastKeyRef.current) {
      lastKeyRef.current = serverBrokersKey;
      setSelectedBrokers(serverBrokers ?? DEFAULT_ENABLED_BROKERS);
      setHasUnsavedChanges(false);
    }
  }, [serverBrokersKey, serverBrokers]);

  const updateMutation = trpc.account.updateEnabledBrokers.useMutation({
    onSuccess: (updated) => {
      toast.success("Broker settings saved successfully");
      setHasUnsavedChanges(false);
      utils.account.enabledBrokers.setData(undefined, updated);
      void utils.account.enabledBrokers.invalidate();
      void utils.account.activeBroker.invalidate();
      void utils.trades.list.invalidate();
      void utils.stats.calculate.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update enabled brokers");
      // revert to server state
      setSelectedBrokers(serverBrokers);
      setHasUnsavedChanges(false);
    },
  });

  const activeBrokerMutation = trpc.account.saveActiveBroker.useMutation({
    onSuccess: (newBroker) => {
      toast.success(`Active broker changed to ${newBroker}`);
      if (typeof window !== "undefined") {
        localStorage.setItem("active-broker", newBroker);
      }
      utils.account.activeBroker.setData(undefined, newBroker);
      void utils.account.activeBroker.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to change active broker"),
  });

  const handleToggleBroker = (broker: string) => {
    setSelectedBrokers((prev) => {
      let next: string[];
      if (prev.includes(broker)) {
        if (prev.length <= 1) {
          toast.error("You must keep at least one broker active");
          return prev;
        }
        next = prev.filter((b) => b !== broker);
      } else {
        next = [...prev, broker];
      }
      setHasUnsavedChanges(true);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedBrokers([...ALL_SUPPORTED_BROKERS]);
    setHasUnsavedChanges(true);
  };

  const handleResetDefaults = () => {
    setSelectedBrokers([...DEFAULT_ENABLED_BROKERS]);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    if (selectedBrokers.length === 0) {
      toast.error("Please select at least one broker");
      return;
    }
    updateMutation.mutate({ brokers: selectedBrokers });
  };

  const filteredBrokers = useMemo(() => {
    return ALL_SUPPORTED_BROKERS.filter((broker) => {
      const meta = getBrokerMeta(broker);
      const matchesSearch =
        broker.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meta.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === "All" || meta.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const enabledCount = selectedBrokers.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Customize which brokers are visible in your dropdowns, trading logs, and wallet.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="h-9 gap-1.5 font-semibold text-xs bg-primary text-primary-foreground"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {/* Primary Broker Selection Card */}
      <Card className="terminal-card border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="p-4 sm:p-5 border-b border-border/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-indigo-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold tracking-tight">Active Broker Workspace</CardTitle>
                <CardDescription className="text-xs">
                  Your current global filtering context throughout all pages.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Currently Selected:</span>
              <Select
                value={activeBroker}
                onValueChange={(val) => activeBrokerMutation.mutate({ broker: val })}
              >
                <SelectTrigger className="h-8 w-[160px] text-xs font-semibold bg-background">
                  <SelectValue placeholder="Select active broker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Brokers">All Brokers</SelectItem>
                  {selectedBrokers.map((broker) => {
                    const meta = getBrokerMeta(broker);
                    return (
                      <SelectItem key={broker} value={broker}>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${meta.dotColor}`} />
                          <span>{broker}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Broker Management Section */}
      <Card className="terminal-card border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="p-4 sm:p-5 border-b border-border/60 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-500/15 text-blue-400">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold tracking-tight">Supported Brokers</CardTitle>
                  <Badge variant="outline" className="font-mono text-[11px] font-semibold">
                    {enabledCount} of {ALL_SUPPORTED_BROKERS.length} enabled
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Toggle on the brokers you use. Only enabled brokers will appear in selection menus.
                </CardDescription>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-8 text-xs font-medium"
              >
                Enable All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetDefaults}
                className="h-8 text-xs font-medium"
              >
                Reset Default
              </Button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search brokers by name or market..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background/50 border-border/60"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  size="sm"
                  variant={activeCategory === cat ? "default" : "ghost"}
                  onClick={() => setActiveCategory(cat)}
                  className={`h-7 px-2.5 text-[11px] font-medium rounded-md ${
                    activeCategory === cat ? "" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          {filteredBrokers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No brokers match your search criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBrokers.map((broker) => {
                const meta = getBrokerMeta(broker);
                const isEnabled = selectedBrokers.includes(broker);
                const isCurrentlyActive = activeBroker === broker;

                return (
                  <div
                    key={broker}
                    onClick={() => handleToggleBroker(broker)}
                    className={`group relative flex flex-col justify-between rounded-xl border p-3.5 transition-all cursor-pointer select-none ${
                      isEnabled
                        ? "border-primary/40 bg-gradient-to-br from-card to-card/60 shadow-sm hover:border-primary/70"
                        : "border-border/40 bg-muted/10 opacity-70 hover:opacity-100 hover:border-border/70"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full transition-transform group-hover:scale-125 ${
                              meta.dotColor
                            }`}
                          />
                          <p className="font-bold text-sm truncate tracking-tight text-foreground">
                            {broker}
                          </p>
                        </div>

                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => handleToggleBroker(broker)}
                            aria-label={`Toggle ${broker}`}
                          />
                        </div>
                      </div>

                      <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-border/40 flex items-center justify-between text-[11px]">
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-mono font-medium px-1.5 py-0 bg-muted/60"
                      >
                        {meta.category}
                      </Badge>

                      <div className="flex items-center gap-1.5">
                        {isCurrentlyActive && (
                          <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                            Active Session
                          </span>
                        )}
                        <span
                          className={`font-semibold text-[11px] ${
                            isEnabled ? "text-emerald-400" : "text-muted-foreground"
                          }`}
                        >
                          {isEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sticky Save Bar on modification */}
          {hasUnsavedChanges && (
            <div className="mt-6 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="flex items-center gap-2 text-xs text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>You have unsaved changes to your active broker list.</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedBrokers(serverBrokers);
                    setHasUnsavedChanges(false);
                  }}
                  className="h-8 text-xs"
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="h-8 px-4 text-xs font-semibold bg-primary text-primary-foreground"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
