import React, { useRef } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
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

export default function GlobalDateNavigator() {
  const { selectedDate, setSelectedDate, shiftSelectedDate, selectedPeriod, setSelectedPeriod } = useGlobalToolbar();
  const dateInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      aria-label="Global trading period"
      className="flex min-w-0 max-w-full items-center gap-0.5 rounded-xl border border-border/70 bg-card/95 p-0.5 shadow-sm dark:bg-[#0a1220] min-[360px]:gap-1 min-[360px]:p-1"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => shiftSelectedDate(-1)}
        className="global-date-step h-8 w-6 shrink-0 text-muted-foreground hover:text-foreground min-[360px]:w-8"
        title="Previous Day"
        aria-label="Previous Day"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="global-date-picker relative flex min-w-0 items-center">
        <Input
          ref={dateInputRef}
          id="global-trading-date"
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="global-date-input h-8 w-[92px] shrink border-border/50 bg-background/50 px-1.5 text-[11px] font-mono min-[360px]:w-[104px] min-[400px]:w-[120px] sm:w-[145px] sm:px-2 sm:text-xs [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
          aria-label="Selected trading date"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="global-calendar-button h-8 w-8 shrink-0 text-muted-foreground"
          aria-label="Choose trading date"
          title="Choose trading date"
          onClick={() => {
            const input = dateInputRef.current;
            if (!input) return;
            if (typeof input.showPicker === "function") input.showPicker();
            else input.click();
          }}
        >
          <CalendarDays className="h-4 w-4" />
        </Button>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => shiftSelectedDate(1)}
        className="global-date-step h-8 w-6 shrink-0 text-muted-foreground hover:text-foreground min-[360px]:w-8"
        title="Next Day"
        aria-label="Next Day"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
        <SelectTrigger aria-label="Select date range" className="global-period-trigger h-8 shrink-0 px-1.5 text-[11px] font-semibold sm:px-2 sm:text-xs">
          <ListFilter className="global-period-icon h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="global-period-value"><SelectValue /></span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="thisMonth">This Month</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="last90Days">Last 90 Days</SelectItem>
          <SelectItem value="last3Months">Last 3 Months</SelectItem>
          <SelectItem value="last6Months">Last 6 Months</SelectItem>
          <SelectItem value="lastYear">1 Year</SelectItem>
          <SelectItem value="all">All Time</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
