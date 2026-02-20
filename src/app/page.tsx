"use client";

import { useState, useEffect, useRef } from "react";

type Period = "1d" | "7d" | "1m" | "1y" | "all";

interface Summary {
  current_balance: number;
  period_change_usd: number;
  period_change_pct: number;
  fund_balance: number;
  as_of: string;
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "1m", label: "1M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "ALL" },
];

function formatDollars(value: number): string {
  const whole = Math.floor(Math.abs(value));
  const sign = value < 0 ? "-" : "";
  return sign + "$" + whole.toLocaleString("en-US");
}

function formatCents(value: number): string {
  return "." + Math.abs(value).toFixed(2).split(".")[1];
}

function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return (
    sign +
    value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    })
  );
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return sign + value.toFixed(3) + "%";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatFundBalance(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export default function Page() {
  const [period, setPeriod] = useState<Period>("1d");
  const [data, setData] = useState<Summary | null>(null);
  const [ready, setReady] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    fetch(`/api/summary?period=${period}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        if (!hasLoaded.current) {
          hasLoaded.current = true;
          requestAnimationFrame(() => setReady(true));
        }
      })
      .catch(() => {});
  }, [period]);

  const isPositive = data ? data.period_change_usd >= 0 : true;

  const stagger = (delay: number): React.CSSProperties => ({
    opacity: ready ? 1 : 0,
    transform: ready ? "translateY(0)" : "translateY(20px)",
    transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
  });

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 relative overflow-hidden select-none">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse,rgba(52,211,153,0.04)_0%,transparent_60%)]" />
        <div className="absolute -bottom-[10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse,rgba(99,102,241,0.025)_0%,transparent_60%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Brand */}
        <div style={stagger(0)} className="flex items-center gap-2.5 mb-14">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-emerald-400"
              style={{ animation: "breath 3s ease-in-out infinite" }}
            />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span className="text-[11px] tracking-[0.3em] uppercase text-zinc-500 font-medium">
            Coco Capital
          </span>
        </div>

        {/* Hero balance */}
        <div style={stagger(0.1)} className="text-center mb-5">
          <p className="text-[10px] tracking-[0.35em] uppercase text-zinc-600 mb-4 font-medium">
            Your Balance
          </p>
          {data ? (
            <p className="font-mono leading-none">
              <span className="text-4xl sm:text-[3.5rem] font-medium tracking-tighter text-white">
                {formatDollars(data.current_balance)}
              </span>
              <span className="text-xl sm:text-[2rem] font-medium tracking-tight text-zinc-500">
                {formatCents(data.current_balance)}
              </span>
            </p>
          ) : (
            <div className="h-[44px] sm:h-[56px]" />
          )}
        </div>

        {/* Period change */}
        <div
          style={stagger(0.2)}
          className="flex items-center justify-center gap-3 mb-10 min-h-[28px]"
        >
          {data && (
            <div
              key={period}
              className="flex items-center gap-2.5"
              style={{ animation: "fade-in 0.35s ease-out" }}
            >
              <span
                className={`font-mono text-[15px] font-medium ${
                  isPositive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {formatChange(data.period_change_usd)}
              </span>
              <span
                className={`font-mono text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  isPositive
                    ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20"
                    : "bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20"
                }`}
              >
                {formatPct(data.period_change_pct)}
              </span>
            </div>
          )}
        </div>

        {/* Period selector */}
        <div style={stagger(0.3)} className="mb-14">
          <div className="flex items-center bg-white/[0.03] rounded-2xl p-1 ring-1 ring-white/[0.06]">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2.5 text-[11px] font-bold tracking-wider rounded-xl transition-all duration-300 min-w-[48px] cursor-pointer ${
                  period === p.value
                    ? "bg-white/[0.09] text-white shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "text-zinc-500 hover:text-zinc-300 active:scale-95"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div
          style={stagger(0.4)}
          className="w-12 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent mb-10"
        />

        {/* Fund info */}
        <div style={stagger(0.45)} className="text-center space-y-5">
          {data && (
            <>
              <div>
                <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-700 mb-1.5 font-medium">
                  Fund Total
                </p>
                <p className="font-mono text-[17px] text-zinc-400 tracking-tight">
                  {formatFundBalance(data.fund_balance)}
                </p>
              </div>
              <p className="text-[11px] text-zinc-600">
                {formatDate(data.as_of)}
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
