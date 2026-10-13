"use client";

import { motion } from "framer-motion";

/** Re-mounts on every navigation, giving each page a soft rise-in transition. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 26 }}>
      {children}
    </motion.div>
  );
}
