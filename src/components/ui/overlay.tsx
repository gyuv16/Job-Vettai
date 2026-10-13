"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { cn } from "./primitives";

// ------------------------------------------------------------------ Toasts

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

const useToasts = create<{ toasts: Toast[]; push: (t: Omit<Toast, "id">) => void; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === "error" ? 7000 : 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  success: (title: string, body?: string) => useToasts.getState().push({ kind: "success", title, body }),
  error: (title: string, body?: string) => useToasts.getState().push({ kind: "error", title, body }),
  info: (title: string, body?: string) => useToasts.getState().push({ kind: "info", title, body }),
};

const icons: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-good" aria-hidden />,
  error: <OctagonAlert className="h-5 w-5 text-critical" aria-hidden />,
  info: <Info className="h-5 w-5 text-info" aria-hidden />,
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:right-6 md:left-auto md:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.9, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl p-3.5 pr-2"
            role={t.kind === "error" ? "alert" : "status"}
          >
            {icons[t.kind]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.body}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-lg p-1 text-subtle hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ------------------------------------------------------------------ Modal

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  // Portal to <body>: ancestors with transform/filter/backdrop-filter would otherwise trap position: fixed.
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-end p-0 sm:place-items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.94, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            style={{ transformPerspective: 900 }}
            className={cn("relative max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-[var(--card-solid)] shadow-2xl sm:rounded-3xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[var(--card-solid)] px-5 py-4">
              <h2 className="font-display text-base font-semibold">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-subtle hover:bg-brand-soft hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
