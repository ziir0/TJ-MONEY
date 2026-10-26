import React, { useState } from "react";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useGlobalToolbar } from "@/contexts/GlobalToolbarContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [filtersOpen, setFiltersOpen] = useState(false);

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
    <div className="global-topbar-search min-w-0" aria-label="Trade search and filters">
      <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 shadow-sm transition-colors focus-within:border-ring/60">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Input
          aria-label="Search trades"
          placeholder={active ? "Search symbol, notes..." : "Search available in Trades Log"}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          disabled={!active}
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
        />
        {active && searchQuery ? (
          <button
            type="button"
            aria-label="Clear trade search"
            onClick={() => setSearchQuery("")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={!active}
              aria-label="Open trade filters"
              aria-expanded={filtersOpen}
              className={`h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs sm:px-3 ${hasTradeFilters ? "border-primary/40 bg-primary/10 text-primary" : "bg-background/70"}`}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span>Filters</span>
              {hasTradeFilters ? <span className="sr-only">active</span> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[min(20rem,calc(100vw-2rem))] space-y-4 rounded-xl p-4"
          >
            <div>
              <h2 className="text-sm font-semibold">Trade filters</h2>
              <p className="mt-1 text-xs text-muted-foreground">Choose which trades to show.</p>
            </div>
            <label className="block space-y-1.5 text-xs font-medium">
              Direction
              <Select value={directionFilter} onValueChange={changeDirection}>
                <SelectTrigger aria-label="Filter trade direction" className="h-9 w-full bg-background text-xs">
                  <SelectValue placeholder="All Directions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>
                  <SelectItem value="long">Long (Call)</SelectItem>
                  <SelectItem value="short">Short (Put)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5 text-xs font-medium">
              Outcome
              <Select value={outcomeFilter} onValueChange={changeOutcome}>
                <SelectTrigger aria-label="Filter trade outcome" className="h-9 w-full bg-background text-xs">
                  <SelectValue placeholder="All Outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outcomes</SelectItem>
                  <SelectItem value="win">Wins Only</SelectItem>
                  <SelectItem value="loss">Losses Only</SelectItem>
                  <SelectItem value="breakeven">Breakeven</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="block space-y-1.5 text-xs font-medium">
              Asset
              <Select value={assetFilter} onValueChange={changeAsset}>
                <SelectTrigger aria-label="Filter trade asset" className="h-9 w-full bg-background text-xs">
                  <SelectValue placeholder="All Assets" />
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
            </label>
            <div className="flex items-center justify-between gap-2 border-t border-border/70 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={resetTradeFilters}
                disabled={!hasTradeFilters}
                className="h-9 gap-1.5 px-3 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear filters
              </Button>
              <Button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="h-9 px-4 text-xs"
              >
                Apply filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {!active ? (
        <span className="sr-only" role="status">Search and trade filters are only available in Trades Log.</span>
      ) : null}
    </div>
  );
}
