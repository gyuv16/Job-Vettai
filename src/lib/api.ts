"use client";

import { useEffect, useState } from "react";
import { useStore } from "./store";
import type { ServerStatus, Settings } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}

/** The longest the browser stays on the built-in engine after every AI engine was busy. */
export const BUILT_IN_PAUSE_MS = 60 * 60 * 1000;

/** POST JSON to one of our API routes, attaching the visitor's key/model/access code. */
export async function api<T>(path: string, body: unknown): Promise<T> {
  const { apiKey, workspaceId, accessCode, model } = useStore.getState().settings;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["x-anthropic-key"] = apiKey;
  // Saved settings from before this field existed have no workspaceId.
  if (apiKey && workspaceId?.trim()) headers["x-anthropic-workspace"] = workspaceId.trim();
  if (accessCode) headers["x-access-code"] = accessCode;
  if (model) headers["x-claude-model"] = model;
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("Network error. Check your connection and retry.", "NETWORK", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; restMs?: number };
  if (!res.ok) {
    // Keep the site working by switching this browser to the free built-in engine:
    // for good when the Anthropic credit is empty, for an hour when every AI engine is busy.
    const { settings, setSettings } = useStore.getState();
    if (settings.freeMode !== "manual") {
      if (data.code === "BILLING") setSettings({ freeMode: "billing" });
      else if (data.code === "AI_UNAVAILABLE") {
        // The server says how long: minutes after a per-minute limit, an hour after a daily one.
        const rest = typeof data.restMs === "number" ? Math.min(Math.max(data.restMs, 60_000), BUILT_IN_PAUSE_MS) : BUILT_IN_PAUSE_MS;
        setSettings({ freeMode: "limit", freeModeUntil: Date.now() + rest });
      }
    }
    throw new ApiError(data.error ?? `Request failed (${res.status})`, data.code ?? "ERROR", res.status);
  }
  return data as T;
}

let statusCache: Promise<ServerStatus> | null = null;
const statusListeners = new Set<(s: ServerStatus) => void>();

export function fetchStatus(): Promise<ServerStatus> {
  statusCache ??= fetch("/api/status", { cache: "no-store" })
    .then((r) => r.json() as Promise<ServerStatus>)
    .catch((): ServerStatus => {
      statusCache = null; // don't pin a transient failure for the rest of the session
      return { serverKey: false, engines: { mistral: false, groq: false, claude: false }, serverWorkspace: "unset", accessCodeRequired: false, defaultModel: "claude-opus-5-5", models: [], commit: null, branch: null, environment: null };
    });
  return statusCache;
}

/** Re-read the deployment's configuration (e.g. after a redeploy) and update every useAiMode() user. */
export async function refreshStatus(): Promise<ServerStatus> {
  statusCache = null;
  const s = await fetchStatus();
  statusListeners.forEach((fn) => fn(s));
  return s;
}

export type AiMode = "user-key" | "server-key" | "locked" | "free" | "heuristic" | "loading";

/** Engines the deployment has; deployments from before the free engines only report serverKey (Claude). */
export function serverEngines(status: ServerStatus | null): { mistral: boolean; groq: boolean; claude: boolean } {
  return status?.engines ?? { mistral: false, groq: false, claude: !!status?.serverKey };
}

/** Why a page is on the built-in engine, in words that say what to do about it ("" when AI is in use). */
function builtInReason(mode: AiMode, freeMode: Settings["freeMode"], until: number): string {
  if (mode === "free" && freeMode === "limit") {
    const at = new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `AI is resting until ${at} because the AI engines were busy, and comes back by itself (or switch it back on in Settings).`;
  }
  if (mode === "free" && freeMode === "billing") return "The Anthropic credit ran out, so the built-in engine is in use. See Settings.";
  if (mode === "free") return "Built-in engine only is switched on in Settings.";
  if (mode === "locked") return "Enter this site's access code in Settings to use its AI.";
  if (mode === "heuristic") return "This site has no AI engine set up yet: its owner can add a free MISTRAL_API_KEY or GROQ_API_KEY in Vercel, or you can add your own Claude key in Settings.";
  if (mode === "loading") return "Still checking which AI engine this site has; try again in a moment.";
  return "";
}

/**
 * Which engine will answer: the visitor's key, the deployment's engines (free
 * Mistral / Groq, or Claude), or the built-in fallback. "locked" means the site's
 * AI needs an access code that hasn't been entered, so pages use the built-in
 * engine instead of failing. "free" means this browser is on the built-in engine.
 */
export function useAiMode(): { mode: AiMode; status: ServerStatus | null; why: string } {
  const apiKey = useStore((s) => s.settings.apiKey);
  const accessCode = useStore((s) => s.settings.accessCode);
  // Saved settings from before Free mode existed have no freeMode field.
  const freeMode = useStore((s) => s.settings.freeMode ?? "off");
  const freeModeUntil = useStore((s) => s.settings.freeModeUntil ?? 0);
  const setSettings = useStore((s) => s.setSettings);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  useEffect(() => {
    let live = true;
    const update = (s: ServerStatus) => live && setStatus(s);
    statusListeners.add(update);
    fetchStatus().then(update);
    return () => {
      live = false;
      statusListeners.delete(update);
    };
  }, []);
  // The hour-long rest after busy AI engines ends by itself: on a timer, and whenever the tab
  // comes back, because timers stall while a laptop sleeps or a phone freezes the tab.
  useEffect(() => {
    if (freeMode !== "limit") return;
    const end = () => {
      const s = useStore.getState().settings;
      if (s.freeMode === "limit" && (s.freeModeUntil ?? 0) <= Date.now()) setSettings({ freeMode: "off", freeModeUntil: undefined });
    };
    const t = setTimeout(end, Math.min(Math.max(0, freeModeUntil - Date.now()), 2_147_000_000) + 50);
    document.addEventListener("visibilitychange", end);
    window.addEventListener("focus", end);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", end);
      window.removeEventListener("focus", end);
    };
  }, [freeMode, freeModeUntil, setSettings]);
  const result = (mode: AiMode) => ({ mode, status, why: builtInReason(mode, freeMode, freeModeUntil) });
  if (freeMode === "manual" || freeMode === "billing") return result("free");
  // A visitor's own key doesn't use the site's busy engines, so it ends the rest.
  if (apiKey) return result("user-key");
  if (freeMode === "limit" && freeModeUntil > Date.now()) return result("free");
  if (!status) return result("loading");
  if (status.serverKey && status.accessCodeRequired && !accessCode) return result("locked");
  return result(status.serverKey ? "server-key" : "heuristic");
}

export function isAi(mode: AiMode): boolean {
  return mode === "user-key" || mode === "server-key";
}
