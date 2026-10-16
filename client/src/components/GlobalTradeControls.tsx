import React from "react";
import { RotateCcw, Search } from "lucide-react";
import { useGlobalToolbar } from "@/contexts/GlobalToolbarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GlobalTradeControls({ active }: { active: boolean }) {
  const {
    searchQuery,
    setSearchQuery,
    directionFilter,
    setDirectionFilter,
    outcomeFilter,
    setOutcomeFilter,
    assetFilter,
    setAssetFilter,
    hasTradeFilters,
    resetTradeFilters,
  } = useGlobalToolbar();
  const changeDirection = (value: string) => {
    if (value === "all" || value === "long" || value === "short") {
      setDirectionFilter(value);
    }
  };
  const changeOutcome = (value: string) => {
    if (value === "all" || value === "win" || value === "loss" || value === "breakeven") {
      setOutcomeFilter(value);
    }
  };
  const changeAsset = (value: string) => {
    if (value === "all" || value === "crypto" || value === "forex" || value === "stocks" || value === "indices" || value === "other") {
      setAssetFilter(value);
    }
  };

  return (
    <div className="flex min-w-0 flex-[1_1_420px] flex-wrap items-center gap-1.5" aria-label="Trade search and filters">
      <div className="relative min-w-[150px] flex-[1_1_180px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search trades"
          placeholder={active ? "Search symbol, notes..." : "Search available in Trades Log"}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          disabled={!active}
          className="h-9 border-border/70 bg-background/70 pl-8 pr-8 text-xs"
        />
        {active && searchQuery ? (
          <button
            type="button"
            aria-label="Clear trade search"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>

      <Select
        value={directionFilter}
        onValueChange={changeDirection}
        disabled={!active}
      >
        <SelectTrigger aria-label="Filter trade direction" className="h-9 w-[108px] bg-background/70 text-[11px]">
          <SelectValue placeholder="Direction" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Directions</SelectItem>
          <SelectItem value="long">Long (Call)</SelectItem>
          <SelectItem value="short">Short (Put)</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={outcomeFilter}
        onValueChange={changeOutcome}
        disabled={!active}
      >
        <SelectTrigger aria-label="Filter trade outcome" className="h-9 w-[108px] bg-background/70 text-[11px]">
          <SelectValue placeholder="Outcome" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Outcomes</SelectItem>
          <SelectItem value="win">Wins Only</SelectItem>
          <SelectItem value="loss">Losses Only</SelectItem>
          <SelectItem value="breakeven">Breakeven</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={assetFilter}
        onValueChange={changeAsset}
        disabled={!active}
      >
        <SelectTrigger aria-label="Filter trade asset" className="h-9 w-[98px] bg-background/70 text-[11px]">
          <SelectValue placeholder="Asset" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Assets</SelectItem>
          <SelectItem value="crypto">Crypto</SelectItem>
          <SelectItem value="forex">Forex</SelectItem>
          <SelectItem value="stocks">Stocks</SelectItem>
          <SelectItem value="indices">Indices</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>

      {active && hasTradeFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={resetTradeFilters}
          className="h-9 w-9 shrink-0 text-muted-foreground"
          aria-label="Reset trade search and filters"
          title="Reset trade search and filters"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      ) : null}
      {!active ? (
        <span className="sr-only" role="status">Search and trade filters are only available in Trades Log.</span>
      ) : null}
    </div>
  );
}
