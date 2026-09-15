import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";

export default function Journal() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedDateObject = useMemo(() => new Date(selectedDate), [selectedDate]);
  const { data: trades } = trpc.trades.list.useQuery();
  const journalQuery = trpc.journal.getByDate.useQuery(selectedDateObject);
  const { data: journalEntry, isLoading: isLoadingJournal } = journalQuery;

  useEffect(() => {
    setContent(journalEntry?.content ?? "");
  }, [journalEntry, selectedDate]);

  const upsertMutation = trpc.journal.upsert.useMutation({
    onSuccess: () => {
      toast.success("Journal entry saved");
      setIsSaving(false);
      void journalQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save journal entry");
      setIsSaving(false);
    },
  });

  const deleteMutation = trpc.journal.delete.useMutation({
    onSuccess: () => {
      toast.success("Journal entry deleted");
      setContent("");
      void journalQuery.refetch();
    },
    onError: (error) => toast.error(error.message || "Failed to delete journal entry"),
  });

  // Update content when journal entry changes
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setContent("");
  };

  // Get trades for selected date
  const selectedDateTrades = useMemo(() => {
    if (!trades) return [];
    const dateKey = new Date(selectedDate).toISOString().split("T")[0];
    return trades.filter(
      (trade) => new Date(trade.tradeDate).toISOString().split("T")[0] === dateKey
    );
  }, [trades, selectedDate]);

  // Calculate daily stats
  const dailyStats = useMemo(() => {
    if (selectedDateTrades.length === 0) {
      return { totalPnL: 0, wins: 0, losses: 0, tradeCount: 0 };
    }

    let totalPnL = 0;
    let wins = 0;
    let losses = 0;

    selectedDateTrades.forEach((trade) => {
      const pnl = parseFloat(trade.pnl);
      totalPnL += pnl;
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
    });

    return {
      totalPnL,
      wins,
      losses,
      tradeCount: selectedDateTrades.length,
    };
  }, [selectedDateTrades]);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("Please enter some content");
      return;
    }

    setIsSaving(true);
    upsertMutation.mutate({
      date: new Date(selectedDate),
      content,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Journal</h1>
        <p className="text-muted-foreground mt-1">
          Record your daily trading observations, emotions, and lessons learned
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Journal Entry Editor */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Notes</CardTitle>
            <CardDescription>
              Write your thoughts, observations, and reflections for {new Date(selectedDate).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="journal-date">Date</Label>
              <Input
                id="journal-date"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            {isLoadingJournal ? (
              <Skeleton className="h-64" />
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="journal-content">Your Notes</Label>
                  <Textarea
                    id="journal-content"
                    placeholder="What happened today? How did you feel? What did you learn? What will you do differently next time?"
                    className="min-h-64 resize-none"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  {journalEntry && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (window.confirm("Delete this journal entry?")) {
                          deleteMutation.mutate({ id: journalEntry.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="gap-2 text-loss hover:text-loss"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  )}
                  <Button
                    onClick={handleSave}
                    disabled={isSaving || !content.trim()}
                    className="gap-2"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Save className="w-4 h-4" />
                    Save Entry
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Daily Summary */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Daily Summary</CardTitle>
            <CardDescription>
              {new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dailyStats.tradeCount === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <p>No trades recorded for this date</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm text-muted-foreground">Total Trades</span>
                    <span className="font-semibold">{dailyStats.tradeCount}</span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm text-muted-foreground">Daily P&L</span>
                    <span className={`font-semibold ${dailyStats.totalPnL > 0 ? "text-profit" : dailyStats.totalPnL < 0 ? "text-loss" : ""}`}>
                      {formatCurrency(dailyStats.totalPnL)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b">
                    <span className="text-sm text-muted-foreground">Winning Trades</span>
                    <span className="font-semibold text-profit">{dailyStats.wins}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Losing Trades</span>
                    <span className="font-semibold text-loss">{dailyStats.losses}</span>
                  </div>
                </div>

                {/* Trade List */}
                <div className="pt-4 border-t">
                  <p className="text-sm font-semibold mb-3">Trades</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedDateTrades.map((trade) => {
                      const pnl = parseFloat(trade.pnl);
                      const time = new Date(trade.tradeDate).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <div
                          key={trade.id}
                          className="flex justify-between items-center text-xs p-2 rounded bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{trade.symbol}</p>
                            <p className="text-muted-foreground">{time}</p>
                          </div>
                          <span className={pnl > 0 ? "text-profit font-semibold" : "text-loss font-semibold"}>
                            {formatCurrency(pnl)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
