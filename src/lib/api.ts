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
  const { apiKey, accessCode, model } = useStore.getState().settings;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["x-anthropic-key"] = apiKey;
  if (accessCode) headers["x-access-code"] = accessCode;
  if (model) headers["x-claude-model"] = model;
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("Network error. Check your connection and retry.", "NETWORK", 0);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, data.code ?? "ERROR", res.status);
  return data as T;
}

let statusCache: Promise<ServerStatus> | null = null;

export function fetchStatus(): Promise<ServerStatus> {
  statusCache ??= fetch("/api/status")
    .then((r) => r.json() as Promise<ServerStatus>)
    .catch(() => ({ serverKey: false, accessCodeRequired: false, defaultModel: "claude-opus-5-5", models: [] }));
  return statusCache;
}

export type AiMode = "user-key" | "server-key" | "heuristic" | "loading";

/** Which engine will answer: the visitor's key, the deployment's key, or the heuristic fallback. */
export function useAiMode(): { mode: AiMode; status: ServerStatus | null } {
  const apiKey = useStore((s) => s.settings.apiKey);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  useEffect(() => {
    let live = true;
    fetchStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, []);
  if (apiKey) return { mode: "user-key", status };
  if (!status) return { mode: "loading", status };
  return { mode: status.serverKey ? "server-key" : "heuristic", status };
}

export function isAi(mode: AiMode): boolean {
  return mode === "user-key" || mode === "server-key";
}
