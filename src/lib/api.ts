"use client";

import { useEffect, useState } from "react";
import { useStore } from "./store";
import type { ServerStatus } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}

/** How long the browser stays on the built-in engine after every AI engine was busy. */
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
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    // Keep the site working by switching this browser to the free built-in engine:
    // for good when the Anthropic credit is empty, for an hour when every AI engine is busy.
    const { settings, setSettings } = useStore.getState();
    if (settings.freeMode !== "manual") {
      if (data.code === "BILLING") setSettings({ freeMode: "billing" });
      else if (data.code === "AI_UNAVAILABLE") setSettings({ freeMode: "limit", freeModeUntil: Date.now() + BUILT_IN_PAUSE_MS });
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

/**
 * Which engine will answer: the visitor's key, the deployment's engines (free
 * Mistral / Groq, or Claude), or the built-in fallback. "locked" means the site's
 * AI needs an access code that hasn't been entered, so pages use the built-in
 * engine instead of failing. "free" means this browser is on the built-in engine.
 */
export function useAiMode(): { mode: AiMode; status: ServerStatus | null } {
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
  // The hour-long pause after busy AI engines ends by itself.
  useEffect(() => {
    if (freeMode !== "limit") return;
    const end = () => {
      const s = useStore.getState().settings;
      if (s.freeMode === "limit" && (s.freeModeUntil ?? 0) <= Date.now()) setSettings({ freeMode: "off", freeModeUntil: undefined });
    };
    const t = setTimeout(end, Math.min(Math.max(0, freeModeUntil - Date.now()), 2_147_000_000) + 50);
    return () => clearTimeout(t);
  }, [freeMode, freeModeUntil, setSettings]);
  if (freeMode !== "off") return { mode: "free", status };
  if (apiKey) return { mode: "user-key", status };
  if (!status) return { mode: "loading", status };
  if (status.serverKey && status.accessCodeRequired && !accessCode) return { mode: "locked", status };
  return { mode: status.serverKey ? "server-key" : "heuristic", status };
}

export function isAi(mode: AiMode): boolean {
  return mode === "user-key" || mode === "server-key";
}
