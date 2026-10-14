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
    // Out of Anthropic credit: keep the site working by switching this browser to the free engine.
    if (data.code === "BILLING" && useStore.getState().settings.freeMode !== "manual") {
      useStore.getState().setSettings({ freeMode: "billing" });
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
      return { serverKey: false, serverWorkspace: "unset", accessCodeRequired: false, defaultModel: "claude-opus-5-5", models: [], commit: null, branch: null, environment: null };
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

/**
 * Which engine will answer: the visitor's key, the deployment's key, or the
 * heuristic fallback. "locked" means the site key needs an access code that
 * hasn't been entered, so pages fall back to heuristic mode instead of failing.
 */
export function useAiMode(): { mode: AiMode; status: ServerStatus | null } {
  const apiKey = useStore((s) => s.settings.apiKey);
  const accessCode = useStore((s) => s.settings.accessCode);
  // Saved settings from before Free mode existed have no freeMode field.
  const freeMode = useStore((s) => s.settings.freeMode ?? "off");
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
  if (freeMode !== "off") return { mode: "free", status };
  if (apiKey) return { mode: "user-key", status };
  if (!status) return { mode: "loading", status };
  if (status.serverKey && status.accessCodeRequired && !accessCode) return { mode: "locked", status };
  return { mode: status.serverKey ? "server-key" : "heuristic", status };
}

export function isAi(mode: AiMode): boolean {
  return mode === "user-key" || mode === "server-key";
}
