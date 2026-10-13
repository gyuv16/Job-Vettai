"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "./ui/primitives";

/**
 * Horizontal bars. One series = one colour; ordered stages may pass an ordinal
 * ramp via `colors`. Labels and values use text ink, never the series colour.
 */
export function BarList({
  data,
  colors,
  max,
  valueSuffix = "",
  emptyText = "No data yet",
}: {
  data: { label: string; value: number; hint?: string }[];
  colors?: string[];
  max?: number;
  valueSuffix?: string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  if (!data.some((d) => d.value > 0)) return <p className="py-6 text-center text-xs text-subtle">{emptyText}</p>;
  return (
    <ul className="space-y-2.5" role="list">
      {data.map((d, i) => (
        <li key={d.label} className="relative" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-muted">{d.label}</span>
            <span className="font-semibold tabular-nums text-fg">
              {d.value}
              {valueSuffix}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_7%,transparent)]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: colors?.[i] ?? "var(--series-1)" }}
              initial={{ width: 0 }}
              whileInView={{ width: `${(d.value / top) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          {hover === i && d.hint && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="absolute -top-8 right-0 z-20 rounded-lg border border-line bg-[var(--card-solid)] px-2 py-1 text-[11px] text-fg shadow-lg">
              {d.hint}
            </motion.div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Vertical histogram of fit scores (single series). Bars grow from the baseline. */
export function Histogram({ bins, height = 140 }: { bins: { label: string; value: number }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(1, ...bins.map((b) => b.value));
  return (
    <div className="relative" style={{ height: height + 24 }}>
      <div className="absolute inset-x-0 top-0 flex items-end gap-[2px] border-b border-[var(--chart-axis)]" style={{ height }}>
        {bins.map((b, i) => (
          <div key={b.label} className="relative flex h-full flex-1 items-end" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <motion.div
              className={cn("w-full rounded-t-[4px]", hover === i ? "opacity-100" : "opacity-90")}
              style={{ background: "var(--series-1)" }}
              initial={{ height: 0 }}
              whileInView={{ height: `${(b.value / top) * 100}%` }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 120, damping: 18, delay: i * 0.05 }}
            />
            {hover === i && (
              <div className="absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-[var(--card-solid)] px-2 py-1 text-[11px] text-fg shadow-lg">
                {b.label}: <b>{b.value}</b> jobs
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-[2px]">
        {bins.map((b) => (
          <div key={b.label} className="flex-1 text-center text-[10px] tabular-nums text-[var(--chart-muted)]">
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ordinal blue ramp for ordered stages (funnel). Lightest step still clears 2:1. */
export const ORDINAL_RAMP = ["var(--seq-250)", "var(--seq-350)", "var(--seq-450)", "var(--seq-550)", "var(--seq-650)"];
