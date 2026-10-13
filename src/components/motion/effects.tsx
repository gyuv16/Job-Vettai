"use client";

import {
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../ui/primitives";

// ------------------------------------------------------------------ Stagger presets

export const stagger = (gap = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { type: "spring", stiffness: 260, damping: 26 } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 420, damping: 22 } },
};

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -28 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 260, damping: 28 } },
};

// ------------------------------------------------------------------ Aurora background

export function Aurora({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  const reduce = useReducedMotion();
  const blob = (color: string, size: string, pos: string, dur: number, path: { x: number[]; y: number[] }) => (
    <motion.div
      aria-hidden
      className={cn("absolute rounded-full blur-3xl", size, pos)}
      style={{ background: color, opacity: 0.32 * intensity }}
      animate={reduce ? undefined : { x: path.x, y: path.y, scale: [1, 1.15, 0.95, 1] }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
    />
  );
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {blob("var(--brand-1)", "h-80 w-80", "-left-20 -top-24", 18, { x: [0, 80, 20, 0], y: [0, 40, 90, 0] })}
      {blob("var(--brand-2)", "h-72 w-72", "right-0 top-0", 22, { x: [0, -60, -10, 0], y: [0, 70, 20, 0] })}
      {blob("var(--brand-3)", "h-72 w-72", "bottom-[-6rem] left-1/3", 20, { x: [0, 60, -40, 0], y: [0, -40, -10, 0] })}
    </div>
  );
}

// ------------------------------------------------------------------ Spotlight card (cursor-follow glow + tilt)

export function SpotlightCard({ children, className, tilt = false, glow = "var(--brand-1)" }: { children: ReactNode; className?: string; tilt?: boolean; glow?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(-400);
  const my = useMotionValue(-400);
  const rx = useSpring(0, { stiffness: 200, damping: 20 });
  const ry = useSpring(0, { stiffness: 200, damping: 20 });
  const bg = useMotionTemplate`radial-gradient(420px circle at ${mx}px ${my}px, color-mix(in oklab, ${glow} 18%, transparent), transparent 60%)`;
  return (
    <motion.div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
        if (tilt) {
          rx.set(((e.clientY - r.top) / r.height - 0.5) * -6);
          ry.set(((e.clientX - r.left) / r.width - 0.5) * 6);
        }
      }}
      onPointerLeave={() => {
        mx.set(-400);
        my.set(-400);
        rx.set(0);
        ry.set(0);
      }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      className={cn("glass group relative overflow-hidden rounded-2xl", className)}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-0" style={{ background: bg }} />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

// ------------------------------------------------------------------ Number ticker

export function NumberTicker({ value, className, suffix = "", decimals = 0 }: { value: number; className?: string; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    if (reduce) {
      node.textContent = value.toFixed(decimals) + suffix;
      return;
    }
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (node.textContent = v.toFixed(decimals) + suffix),
    });
    return () => controls.stop();
  }, [inView, value, suffix, decimals, reduce]);
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      0{suffix}
    </span>
  );
}

// ------------------------------------------------------------------ Radial gauge (score ring)

export function scoreColor(score: number): string {
  if (score >= 75) return "var(--good)";
  if (score >= 60) return "var(--info)";
  if (score >= 45) return "var(--warning)";
  if (score >= 30) return "var(--serious)";
  return "var(--critical)";
}

export function RadialGauge({ value, size = 72, stroke = 7, label, className, delay = 0 }: { value: number; size?: number; stroke?: number; label?: string; className?: string; delay?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = useMotionValue(0);
  const offset = useTransform(progress, (p) => c - (p / 100) * c);
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const ctl = animate(progress, value, { duration: 1.3, delay, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => ctl.stop();
  }, [inView, value, delay, progress]);
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg ref={ref} width={size} height={size} className="-rotate-90" role="img" aria-label={`${label ?? "Score"}: ${value} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in oklab, var(--fg) 9%, transparent)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={scoreColor(value)} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} style={{ strokeDashoffset: offset }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <div className="font-display font-bold tabular-nums text-fg" style={{ fontSize: size * 0.28 }}>
            {shown}
          </div>
          {label && <div className="mt-0.5 text-[9px] uppercase tracking-wider text-subtle">{label}</div>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Radar chart (single series: fit dimensions)

export function RadarChart({ axes, size = 260 }: { axes: { label: string; value: number }[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 44;
  const n = axes.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)] as const;
  };
  const poly = axes.map((a, i) => pt(i, a.value).join(",")).join(" ");
  const [hover, setHover] = useState<number | null>(null);
  return (
    <svg viewBox={`-30 0 ${size + 60} ${size}`} className="h-auto w-full max-w-[340px] overflow-visible" role="img" aria-label={axes.map((a) => `${a.label} ${a.value}`).join(", ")}>
      {[25, 50, 75, 100].map((ring) => (
        <polygon key={ring} points={axes.map((_, i) => pt(i, ring).join(",")).join(" ")} fill="none" stroke="var(--chart-grid)" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />;
      })}
      <motion.polygon
        points={poly}
        fill="color-mix(in oklab, var(--series-1) 22%, transparent)"
        stroke="var(--series-1)"
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.15 }}
        style={{ originX: `${cx}px`, originY: `${cy}px` }}
      />
      {axes.map((a, i) => {
        const [x, y] = pt(i, a.value);
        const [lx, ly] = pt(i, 128);
        return (
          <g key={a.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <circle cx={x} cy={y} r={14} fill="transparent" />
            <motion.circle cx={x} cy={y} r={hover === i ? 6 : 4.5} fill="var(--series-1)" stroke="var(--chart-surface)" strokeWidth={2} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.08 }} />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="var(--fg-muted)" style={{ fontFamily: "system-ui, sans-serif" }}>
              {a.label}
            </text>
            <text x={lx} y={ly + 14} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600} fill="var(--fg)" style={{ fontFamily: "system-ui, sans-serif" }}>
              {a.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------ Page header (word-by-word reveal)

export function PageHeader({ eyebrow, title, subtitle, actions, icon }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode; icon?: ReactNode }) {
  const words = title.split(" ");
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-2 inline-flex items-center gap-2 rounded-full border border-line bg-brand-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
            {icon}
            {eyebrow}
          </motion.div>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          {words.map((w, i) => (
            <motion.span
              key={i}
              className="mr-[0.25em] inline-block"
              initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ delay: 0.05 + i * 0.06, type: "spring", stiffness: 260, damping: 24 }}
            >
              {i === words.length - 1 ? <span className="text-gradient">{w}</span> : w}
            </motion.span>
          ))}
        </h1>
        {subtitle && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-1.5 max-w-2xl text-sm text-muted">
            {subtitle}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="flex flex-wrap items-center gap-2">
          {actions}
        </motion.div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Empty state

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass relative overflow-hidden rounded-3xl px-6 py-14 text-center">
      <Aurora intensity={0.5} />
      <div className="relative">
        <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center">
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-brand-soft" />
          <div className="relative grid h-16 w-16 animate-float place-items-center rounded-2xl bg-brand-gradient text-white shadow-[0_12px_30px_-10px_var(--ring)]">{icon}</div>
        </div>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{body}</p>
        {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
      </div>
    </motion.div>
  );
}

// ------------------------------------------------------------------ Flip card (3D)

export function FlipCard({ front, back, className }: { front: ReactNode; back: ReactNode; className?: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" onClick={() => setFlipped((f) => !f)} className={cn("group relative block w-full text-left [perspective:1200px]", className)} aria-pressed={flipped}>
      <motion.div className="relative h-full w-full [transform-style:preserve-3d]" animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: "spring", stiffness: 160, damping: 20 }}>
        <div className="glass absolute inset-0 overflow-y-auto rounded-2xl p-5 [backface-visibility:hidden]">{front}</div>
        <div className="glass absolute inset-0 overflow-y-auto rounded-2xl p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]">{back}</div>
      </motion.div>
    </button>
  );
}

// ------------------------------------------------------------------ Particle burst (save / success feedback)

export function Burst({ trigger, color = "var(--brand-2)" }: { trigger: number; color?: string }) {
  if (!trigger) return null;
  return (
    <span key={trigger} aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (Math.PI * 2 * i) / 10;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full"
            style={{ background: i % 2 ? color : "var(--brand-3)" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * 26, y: Math.sin(a) * 26, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        );
      })}
    </span>
  );
}

// ------------------------------------------------------------------ Typewriter text

export function TypeText({ text, className, speed = 18 }: { text: string; className?: string; speed?: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) {
      setN(text.length);
      return;
    }
    setN(0);
    const id = setInterval(() => setN((v) => (v >= text.length ? (clearInterval(id), v) : v + 2)), speed);
    return () => clearInterval(id);
  }, [text, speed, reduce]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-brand" />}
    </span>
  );
}
