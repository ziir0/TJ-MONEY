export const ALL_SUPPORTED_BROKERS = [
  "Interactive Brokers",
  "Saxo Bank",
  "Charles Schwab",
  "Fidelity Investments",
  "Fusion Markets",
  "IC Markets",
  "Pepperstone",
  "Exness",
  "FP Markets",
  "IG Markets",
  "OANDA",
  "FOREX.com",
  "XM Group",
  "AvaTrade",
  "XTB",
  "Capital.com",
  "tastytrade",
  "eToro",
  "Plus500",
  "BlackBull Markets",
  "Bybit",
  "Binance",
] as const;

export type SupportedBroker = (typeof ALL_SUPPORTED_BROKERS)[number];

export const DEFAULT_ENABLED_BROKERS: string[] = ["Bybit", "Pepperstone"];

export type BrokerCategory = "Multi-Asset" | "Forex & CFD" | "Crypto" | "Equities & Options";

export type BrokerMeta = {
  name: string;
  category: BrokerCategory;
  description: string;
  accentColor: string;
  dotColor: string;
};

export const BROKER_METADATA: Record<string, BrokerMeta> = {
  "Interactive Brokers": {
    name: "Interactive Brokers",
    category: "Multi-Asset",
    description: "Global direct access to stocks, options, futures, forex, bonds",
    accentColor: "from-red-500/20 to-red-500/5 text-red-400 border-red-500/30",
    dotColor: "bg-red-400",
  },
  "Saxo Bank": {
    name: "Saxo Bank",
    category: "Multi-Asset",
    description: "Multi-asset trading in global capital markets and CFDs",
    accentColor: "from-sky-500/20 to-sky-500/5 text-sky-400 border-sky-500/30",
    dotColor: "bg-sky-400",
  },
  "Charles Schwab": {
    name: "Charles Schwab",
    category: "Equities & Options",
    description: "US equities, options, futures (thinkorswim integration)",
    accentColor: "from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30",
    dotColor: "bg-blue-400",
  },
  "Fidelity Investments": {
    name: "Fidelity Investments",
    category: "Equities & Options",
    description: "US stocks, ETFs, active trader pro execution",
    accentColor: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
    dotColor: "bg-emerald-400",
  },
  "Fusion Markets": {
    name: "Fusion Markets",
    category: "Forex & CFD",
    description: "Ultra low-cost forex, indices, and commodity CFDs",
    accentColor: "from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/30",
    dotColor: "bg-cyan-400",
  },
  "IC Markets": {
    name: "IC Markets",
    category: "Forex & CFD",
    description: "True ECN spreads with Raw pricing for algorithmic traders",
    accentColor: "from-teal-500/20 to-teal-500/5 text-teal-400 border-teal-500/30",
    dotColor: "bg-teal-400",
  },
  "Pepperstone": {
    name: "Pepperstone",
    category: "Forex & CFD",
    description: "Razor spreads, cTrader, TradingView & MT4/MT5 execution",
    accentColor: "from-orange-500/20 to-orange-500/5 text-orange-400 border-orange-500/30",
    dotColor: "bg-orange-400",
  },
  "Exness": {
    name: "Exness",
    category: "Forex & CFD",
    description: "Instant withdrawals, high leverage, zero stop-out buffers",
    accentColor: "from-yellow-500/20 to-yellow-500/5 text-yellow-400 border-yellow-500/30",
    dotColor: "bg-yellow-400",
  },
  "FP Markets": {
    name: "FP Markets",
    category: "Forex & CFD",
    description: "Direct market access (DMA) and multi-regulated CFD trading",
    accentColor: "from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30",
    dotColor: "bg-blue-400",
  },
  "IG Markets": {
    name: "IG Markets",
    category: "Multi-Asset",
    description: "Global leader in spread betting, CFDs, and forex",
    accentColor: "from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/30",
    dotColor: "bg-rose-400",
  },
  "OANDA": {
    name: "OANDA",
    category: "Forex & CFD",
    description: "Institutional FX data, transparent pricing & TradingView partner",
    accentColor: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
    dotColor: "bg-emerald-400",
  },
  "FOREX.com": {
    name: "FOREX.com",
    category: "Forex & CFD",
    description: "Regulated currency trading, gold, commodities, and indices",
    accentColor: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30",
    dotColor: "bg-amber-400",
  },
  "XM Group": {
    name: "XM Group",
    category: "Forex & CFD",
    description: "Strict no-requotes policy, micro and standard accounts",
    accentColor: "from-red-500/20 to-red-500/5 text-red-400 border-red-500/30",
    dotColor: "bg-red-400",
  },
  "AvaTrade": {
    name: "AvaTrade",
    category: "Forex & CFD",
    description: "Fixed and floating spreads, options, and AvaProtect tools",
    accentColor: "from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/30",
    dotColor: "bg-indigo-400",
  },
  "XTB": {
    name: "XTB",
    category: "Multi-Asset",
    description: "xStation platform, 0% commission real stocks & ETFs, CFDs",
    accentColor: "from-lime-500/20 to-lime-500/5 text-lime-400 border-lime-500/30",
    dotColor: "bg-lime-400",
  },
  "Capital.com": {
    name: "Capital.com",
    category: "Multi-Asset",
    description: "AI-enhanced trading terminal, 3000+ financial markets",
    accentColor: "from-violet-500/20 to-violet-500/5 text-violet-400 border-violet-500/30",
    dotColor: "bg-violet-400",
  },
  "tastytrade": {
    name: "tastytrade",
    category: "Equities & Options",
    description: "Built for options, futures, and stock traders by traders",
    accentColor: "from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/30",
    dotColor: "bg-rose-400",
  },
  "eToro": {
    name: "eToro",
    category: "Multi-Asset",
    description: "Social trading network, stocks, crypto, copytrader portfolio",
    accentColor: "from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30",
    dotColor: "bg-emerald-400",
  },
  "Plus500": {
    name: "Plus500",
    category: "Multi-Asset",
    description: "Proprietary CFD trading platform with global coverage",
    accentColor: "from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/30",
    dotColor: "bg-blue-400",
  },
  "BlackBull Markets": {
    name: "BlackBull Markets",
    category: "Forex & CFD",
    description: "Institutional liquidity from NZ, high speed fiber execution",
    accentColor: "from-slate-500/20 to-slate-500/5 text-slate-300 border-slate-500/30",
    dotColor: "bg-slate-400",
  },
  "Bybit": {
    name: "Bybit",
    category: "Crypto",
    description: "High-performance crypto derivatives, spot, and copy trading",
    accentColor: "from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30",
    dotColor: "bg-amber-400",
  },
  "Binance": {
    name: "Binance",
    category: "Crypto",
    description: "World largest cryptocurrency exchange by trading volume",
    accentColor: "from-yellow-500/20 to-yellow-500/5 text-yellow-400 border-yellow-500/30",
    dotColor: "bg-yellow-400",
  },
};

export function getBrokerMeta(broker: string): BrokerMeta {
  return (
    BROKER_METADATA[broker] ?? {
      name: broker,
      category: "Multi-Asset",
      description: "Trading account broker",
      accentColor: "from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/30",
      dotColor: "bg-indigo-400",
    }
  );
}

export function sanitizeEnabledBrokers(brokers: unknown): string[] {
  if (!Array.isArray(brokers)) return [...DEFAULT_ENABLED_BROKERS];
  const valid = brokers.filter((b): b is string => typeof b === "string" && ALL_SUPPORTED_BROKERS.includes(b as any));
  return valid.length > 0 ? Array.from(new Set(valid)) : [...DEFAULT_ENABLED_BROKERS];
}
