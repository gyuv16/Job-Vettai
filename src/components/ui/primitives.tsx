"use client";

import { clsx, type ClassValue } from "clsx";
import { AnimatePresence, motion, type HTMLMotionProps } from "framer-motion";
import { Check, CircleAlert, Info, Loader2, OctagonAlert, TriangleAlert, X } from "lucide-react";
import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ------------------------------------------------------------------ Button

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-brand-gradient bg-[length:200%_auto] hover:bg-[position:100%_0] shadow-[0_8px_24px_-8px_var(--ring)] transition-[background-position,transform,box-shadow] duration-500",
  secondary: "glass text-fg hover:bg-[var(--card-hover)]",
  outline: "border border-line text-fg hover:bg-brand-soft",
  ghost: "text-muted hover:text-fg hover:bg-brand-soft",
  danger: "text-white bg-critical hover:brightness-110",
};

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, children, className, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center gap-2 rounded-xl font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        size === "icon" && "h-9 w-9 text-sm",
        buttonStyles[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </motion.button>
  );
});

// ------------------------------------------------------------------ Card

export function Card({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("glass rounded-2xl", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, icon, action }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-semibold text-fg">{title}</h3>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ Badge / Status

export type Tone = "good" | "info" | "warning" | "serious" | "critical" | "neutral" | "brand";

const toneStyles: Record<Tone, string> = {
  good: "text-good-text bg-[color-mix(in_oklab,var(--good)_14%,transparent)] border-[color-mix(in_oklab,var(--good)_30%,transparent)]",
  info: "text-info bg-[color-mix(in_oklab,var(--info)_14%,transparent)] border-[color-mix(in_oklab,var(--info)_30%,transparent)]",
  warning: "text-fg bg-[color-mix(in_oklab,var(--warning)_20%,transparent)] border-[color-mix(in_oklab,var(--warning)_45%,transparent)]",
  serious: "text-fg bg-[color-mix(in_oklab,var(--serious)_18%,transparent)] border-[color-mix(in_oklab,var(--serious)_40%,transparent)]",
  critical: "text-critical bg-[color-mix(in_oklab,var(--critical)_14%,transparent)] border-[color-mix(in_oklab,var(--critical)_30%,transparent)]",
  neutral: "text-muted bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] border-line",
  brand: "text-brand bg-brand-soft border-[color-mix(in_oklab,var(--brand-1)_30%,transparent)]",
};

const toneIcon: Partial<Record<Tone, ReactNode>> = {
  good: <Check className="h-3 w-3" aria-hidden />,
  info: <Info className="h-3 w-3" aria-hidden />,
  warning: <TriangleAlert className="h-3 w-3" aria-hidden />,
  serious: <CircleAlert className="h-3 w-3" aria-hidden />,
  critical: <OctagonAlert className="h-3 w-3" aria-hidden />,
};

export function Badge({ tone = "neutral", children, className, icon = true }: { tone?: Tone; children: ReactNode; className?: string; icon?: boolean | ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", toneStyles[tone], className)}>
      {icon === true ? toneIcon[tone] : icon || null}
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ Inputs

const fieldBase =
  "w-full rounded-xl border border-line bg-[color-mix(in_oklab,var(--bg-elev)_70%,transparent)] px-3 text-sm text-fg placeholder:text-subtle outline-none transition focus:border-[var(--ring)] focus:ring-4 focus:ring-[color-mix(in_oklab,var(--brand-1)_15%,transparent)]";

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(fieldBase, "h-10 appearance-none bg-[length:16px] bg-[position:right_0.6rem_center] bg-no-repeat pr-9", className)}
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-[11px] text-subtle">{hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full border border-line transition-colors", checked ? "bg-brand-gradient" : "bg-[color-mix(in_oklab,var(--fg)_10%,transparent)]")}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
        className={cn("absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow", checked ? "right-0.5" : "left-0.5")}
      />
    </button>
  );
}

// ------------------------------------------------------------------ Tabs (morphing pill)

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  layoutId,
  className,
}: {
  tabs: { value: T; label: ReactNode; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("glass inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl p-1 no-scrollbar", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn("relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors", active ? "text-white" : "text-muted hover:text-fg")}
          >
            {active && (
              <motion.span layoutId={layoutId} className="absolute inset-0 rounded-xl bg-brand-gradient shadow-[0_6px_20px_-8px_var(--ring)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {t.icon}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Chip input

export function ChipInput({ values, onChange, placeholder, tone = "brand" }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string; tone?: Tone }) {
  const add = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    const next = [...values];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
  };
  return (
    <div className={cn(fieldBase, "flex min-h-11 flex-wrap items-center gap-1.5 py-1.5")}>
      <AnimatePresence initial={false}>
        {values.map((v) => (
          <motion.span
            key={v}
            layout
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className={cn("inline-flex items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-xs font-medium", toneStyles[tone])}
          >
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="grid h-4 w-4 place-items-center rounded-full hover:bg-black/10">
              <X className="h-3 w-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-subtle"
        placeholder={placeholder ?? "Type and press Enter"}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          if ((e.key === "Enter" || e.key === ",") && el.value.trim()) {
            e.preventDefault();
            add(el.value);
            el.value = "";
          } else if (e.key === "Backspace" && !el.value && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={(e) => {
          if (e.currentTarget.value.trim()) {
            add(e.currentTarget.value);
            e.currentTarget.value = "";
          }
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ Skeleton

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}
