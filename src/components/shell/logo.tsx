"use client";

import { motion } from "framer-motion";

/** "Vettai" means "the hunt": a crosshair whose ring slowly turns around an arrow. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <div className="relative grid place-items-center rounded-xl bg-brand-gradient shadow-[0_8px_24px_-8px_var(--ring)]" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size * 0.72} height={size * 0.72} aria-hidden>
        <motion.g animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }} style={{ originX: "20px", originY: "20px" }}>
          <circle cx="20" cy="20" r="14" fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="2.4" strokeDasharray="10 5" />
        </motion.g>
        <path d="M20 4v6M20 30v6M4 20h6M30 20h6" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <motion.circle cx="20" cy="20" r="3.6" fill="white" animate={{ scale: [1, 1.35, 1] }} transition={{ duration: 2.2, repeat: Infinity }} style={{ originX: "20px", originY: "20px" }} />
      </svg>
    </div>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-display text-[15px] font-bold tracking-tight">
            Job <span className="text-gradient">Vettai</span>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-subtle">AI job hunt studio</div>
        </div>
      )}
    </div>
  );
}
