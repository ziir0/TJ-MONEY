import React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
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

  return (
    <div
      aria-label="Global trading period"
      className="flex shrink-0 items-center gap-0.5 rounded-xl border border-border/70 bg-card/95 p-0.5 shadow-sm dark:bg-[#0a1220] sm:gap-1 sm:p-1"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => shiftSelectedDate(-1)}
        className="h-8 w-7 text-muted-foreground hover:text-foreground sm:w-8"
        title="Previous Day"
        aria-label="Previous Day"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="relative flex min-w-0 items-center">
        <CalendarIcon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          id="global-trading-date"
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
          className="h-8 w-[104px] border-border/50 bg-background/50 pl-7 pr-1.5 text-xs font-mono sm:w-[145px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
          aria-label="Selected trading date"
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => shiftSelectedDate(1)}
        className="h-8 w-7 text-muted-foreground hover:text-foreground sm:w-8"
        title="Next Day"
        aria-label="Next Day"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
        <SelectTrigger aria-label="Select date range" className="h-8 w-[110px] px-2 text-xs font-semibold sm:w-[140px]">
          <SelectValue />
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
