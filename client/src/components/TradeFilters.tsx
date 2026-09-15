import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";

interface TradeFiltersProps {
  onSymbolChange?: (symbol: string) => void;
  onDirectionChange?: (direction: string | null) => void;
  onOutcomeChange?: (outcome: string | null) => void;
  onDateRangeChange?: (startDate: string, endDate: string) => void;
  onReset?: () => void;
}

export default function TradeFilters({
  onSymbolChange,
  onDirectionChange,
  onOutcomeChange,
  onDateRangeChange,
  onReset,
}: TradeFiltersProps) {
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = symbol || direction || outcome || startDate || endDate;

  const handleReset = () => {
    setSymbol("");
    setDirection(null);
    setOutcome(null);
    setStartDate("");
    setEndDate("");
    onReset?.();
  };

  const handleSymbolChange = (value: string) => {
    setSymbol(value);
    onSymbolChange?.(value);
  };

  const handleDirectionChange = (value: string) => {
    const newDirection = value === "all" ? null : value;
    setDirection(newDirection);
    onDirectionChange?.(newDirection);
  };

  const handleOutcomeChange = (value: string) => {
    const newOutcome = value === "all" ? null : value;
    setOutcome(newOutcome);
    onOutcomeChange?.(newOutcome);
  };

  const handleDateRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end) {
      onDateRangeChange?.(start, end);
    }
  };

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        onClick={() => setIsExpanded(true)}
        className={hasActiveFilters ? "border-accent" : ""}
      >
        {hasActiveFilters ? `Filters (${[symbol, direction, outcome, startDate, endDate].filter(Boolean).length})` : "Filters"}
      </Button>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Symbol Filter */}
            <div className="space-y-2">
              <Label htmlFor="symbol-filter">Symbol</Label>
              <Input
                id="symbol-filter"
                placeholder="e.g., AAPL"
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
              />
            </div>

            {/* Direction Filter */}
            <div className="space-y-2">
              <Label htmlFor="direction-filter">Direction</Label>
              <Select value={direction || "all"} onValueChange={handleDirectionChange}>
                <SelectTrigger id="direction-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Outcome Filter */}
            <div className="space-y-2">
              <Label htmlFor="outcome-filter">Outcome</Label>
              <Select value={outcome || "all"} onValueChange={handleOutcomeChange}>
                <SelectTrigger id="outcome-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="win">Win</SelectItem>
                  <SelectItem value="loss">Loss</SelectItem>
                  <SelectItem value="breakeven">Breakeven</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="start-date-filter">From Date</Label>
              <Input
                id="start-date-filter"
                type="date"
                value={startDate}
                onChange={(e) => handleDateRangeChange(e.target.value, endDate)}
              />
            </div>

            {/* End Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="end-date-filter">To Date</Label>
              <Input
                id="end-date-filter"
                type="date"
                value={endDate}
                onChange={(e) => handleDateRangeChange(startDate, e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setIsExpanded(false)}
            >
              Close
            </Button>
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
