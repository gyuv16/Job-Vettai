"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { Cpu, Gift, KeyRound, Lock, Menu, Moon, Sparkles, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAiMode } from "@/lib/api";
import { useHydrated, useStore } from "@/lib/store";
import { cn } from "../ui/primitives";
import { Toaster } from "../ui/overlay";
import { Logo, LogoMark } from "./logo";
import { NAV } from "./nav";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function useThemeSync() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

function ThemeToggle() {
  const theme = useStore((s) => s.settings.theme);
  const setSettings = useStore((s) => s.setSettings);
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), [theme]);
  return (
    <button
      onClick={() => setSettings({ theme: dark ? "light" : "dark" })}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="glass relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl text-muted hover:text-fg"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? "moon" : "sun"} initial={{ rotate: -90, scale: 0, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 90, scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
          {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function AiChip() {
  const { mode } = useAiMode();
  const cfg = {
    "user-key": { label: "Claude · your key", icon: <KeyRound className="h-3.5 w-3.5" />, dot: "var(--good)" },
    "server-key": { label: "Claude AI", icon: <Sparkles className="h-3.5 w-3.5" />, dot: "var(--good)" },
    locked: { label: "Access code needed", icon: <Lock className="h-3.5 w-3.5" />, dot: "var(--warning)" },
    free: { label: "Free mode", icon: <Gift className="h-3.5 w-3.5" />, dot: "var(--good)" },
    heuristic: { label: "Heuristic mode", icon: <Cpu className="h-3.5 w-3.5" />, dot: "var(--warning)" },
    loading: { label: "Checking AI…", icon: <Cpu className="h-3.5 w-3.5" />, dot: "var(--fg-subtle)" },
  }[mode];
  return (
    <Link href="/settings" className="glass flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium text-muted hover:text-fg" title="AI engine - change in Settings">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: cfg.dot }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: cfg.dot }} />
      </span>
      {cfg.icon}
      <span className="hidden sm:inline">{cfg.label}</span>
    </Link>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r border-line bg-[color-mix(in_oklab,var(--bg-elev)_75%,transparent)] px-3 py-5 backdrop-blur-xl md:flex lg:w-64">
      <div className="mb-8 px-1.5">
        <div className="hidden lg:block">
          <Logo />
        </div>
        <div className="lg:hidden">
          <LogoMark />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item, i) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <motion.div key={item.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i, type: "spring", stiffness: 300, damping: 28 }}>
              <Link href={item.href} className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", active ? "text-white" : "text-muted hover:text-fg")} title={item.label}>
                {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-brand-gradient shadow-[0_8px_24px_-10px_var(--ring)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                {!active && <span className="absolute inset-0 rounded-xl bg-brand-soft opacity-0 transition-opacity group-hover:opacity-100" />}
                <Icon className="relative z-10 h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110" />
                <span className="relative z-10 hidden lg:block">{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>
      <div className="hidden rounded-2xl border border-line bg-brand-soft p-3 text-[11px] leading-relaxed text-muted lg:block">
        <p className="font-semibold text-fg">Private by design</p>
        Your profile and applications stay in this browser. Export them anytime from Settings.
      </div>
    </aside>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const primary = NAV.filter((n) => n.primary);
  const rest = NAV.filter((n) => !n.primary);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-between rounded-2xl border border-line bg-[color-mix(in_oklab,var(--bg-elev)_85%,transparent)] p-1.5 shadow-2xl backdrop-blur-xl md:hidden">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn("relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium", active ? "text-white" : "text-muted")}>
              {active && <motion.span layoutId="mnav-pill" className="absolute inset-0 rounded-xl bg-brand-gradient" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Icon className="relative z-10 h-5 w-5" />
              <span className="relative z-10">{item.short}</span>
            </Link>
          );
        })}
        <button onClick={() => setOpen(true)} className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium text-muted" aria-label="More pages">
          <Menu className="h-5 w-5" />
          More
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[60] md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-[var(--card-solid)] p-4 pb-8">
              <div className="mb-3 flex items-center justify-between">
                <Logo />
                <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {rest.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.div key={item.href} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Link href={item.href} className="glass flex items-center gap-3 rounded-2xl p-3">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand">
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{item.label}</span>
                          <span className="block text-[11px] text-muted">{item.hint}</span>
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4">
        <LogoMark size={56} />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-brand-soft">
          <motion.div className="h-full w-1/2 rounded-full bg-brand-gradient" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }} />
        </div>
      </motion.div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const reduceMotion = useStore((s) => s.settings.reduceMotion);
  useThemeSync();
  const current = NAV.find((n) => isActive(pathname, n.href));

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none fixed -top-40 left-1/2 -z-10 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-brand-gradient opacity-[0.10] blur-3xl" />
      {!hydrated ? (
        <Splash />
      ) : (
        <>
          <Sidebar pathname={pathname} />
          <MobileNav pathname={pathname} />
          <div className="md:pl-20 lg:pl-64">
            <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--bg)_70%,transparent)] backdrop-blur-xl">
              <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="md:hidden">
                    <LogoMark size={30} />
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div key={current?.href} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="min-w-0">
                      <div className="truncate text-sm font-semibold">{current?.label ?? "Job Vettai"}</div>
                      <div className="hidden truncate text-[11px] text-subtle sm:block">{current?.hint}</div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="flex items-center gap-2">
                  <AiChip />
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-12">{children}</main>
          </div>
        </>
      )}
      <Toaster />
    </MotionConfig>
  );
}
