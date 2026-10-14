import "server-only";

import type { z } from "zod";
import {
  checkAccessCode,
  claudeChat,
  claudePing,
  claudeStructured,
  envVar,
  HttpError,
  serverClaude,
  toHttpError,
  visitorClaude,
  type ChatMessage,
  type ClaudeCtx,
  type Effort,
  type KeySource,
  type UserContent,
} from "./claude";
import { compatChat, compatPing, compatStructured, EngineError, freeProviders, type Provider } from "./openai-compat";
import { pdfToText } from "./pdf";
import { untrusted } from "./prompts";

// Every AI route goes through here. The engine order is:
//   1. the visitor's own Claude key, if they saved one in Settings (and only that);
//   2. otherwise this deployment's engines: Mistral (free), then Groq (free), then
//      Claude (paid, only if ANTHROPIC_API_KEY is set).
// When every engine fails for a temporary reason, the browser switches to the
// built-in engine for an hour (code AI_UNAVAILABLE), so the site keeps working.

export type EngineId = "mistral" | "groq" | "claude";

type Engine = { kind: "free"; id: EngineId; label: string; provider: Provider } | { kind: "claude"; id: "claude"; label: string; ctx: () => ClaudeCtx | null };

function engines(req: Request): Engine[] {
  const visitor = visitorClaude(req);
  if (visitor) return [{ kind: "claude", id: "claude", label: "Claude (your key)", ctx: () => visitor }];
  const list: Engine[] = freeProviders().map((p) => ({ kind: "free", id: p.id, label: p.label, provider: p }));
  // Built lazily, so a bad ANTHROPIC_WORKSPACE_ID only fails Claude, not the free engines before it.
  if (envVar("ANTHROPIC_API_KEY")) list.push({ kind: "claude", id: "claude", label: "Claude", ctx: () => serverClaude(req) });
  if (!list.length) {
    throw new HttpError(401, "No AI engine is set up on this site. Add MISTRAL_API_KEY or GROQ_API_KEY (both free, no card) in Vercel and redeploy, or keep using the free built-in engine.", "NO_KEY");
  }
  checkAccessCode(req);
  return list;
}

function claudeCtx(e: Extract<Engine, { kind: "claude" }>): ClaudeCtx {
  const ctx = e.ctx();
  if (!ctx) throw new HttpError(401, "ANTHROPIC_API_KEY is not set.", "NO_KEY");
  return ctx;
}

/**
 * Plain text for engines that can't read PDFs: PDF blocks become their extracted
 * text (done once per request). With `pdfOptional` (the visitor also pasted the
 * text), an unreadable PDF is skipped instead of failing the request.
 */
function flattener(user: UserContent, pdfOptional: boolean): () => Promise<string> {
  let cached: Promise<string> | undefined;
  return () => (cached ??= flatten(user, pdfOptional));
}

async function flatten(user: UserContent, pdfOptional: boolean): Promise<string> {
  if (typeof user === "string") return user;
  const parts: string[] = [];
  for (const b of user) {
    if (b.type === "text") parts.push(b.text);
    else if (b.type === "document" && b.source.type === "base64" && b.source.media_type === "application/pdf") {
      try {
        parts.push(`Attached PDF (text extracted):\n${untrusted("cv_pdf", (await pdfToText(b.source.data)).slice(0, 60000))}`);
      } catch (error) {
        if (!pdfOptional || !(error instanceof HttpError) || !INPUT.has(error.code)) throw error;
        parts.push("(The attached PDF has no readable text, so use the pasted CV text below.)");
      }
    }
  }
  return parts.join("\n\n");
}

// Problems with the input itself: no other engine will do better.
const INPUT = new Set(["PDF_NO_TEXT", "PDF_BAD"]);
// Set-up problems the site owner must fix; switching browsers to the built-in engine would hide them.
const CONFIG = new Set(["NO_KEY", "BAD_KEY", "PERMISSION", "MODEL", "NOT_FOUND", "WORKSPACE_ID", "BAD_WORKSPACE_ID"]);
// Busy, out of quota or down: worth resting on the built-in engine for a while.
const TRANSIENT = new Set(["RATE_LIMIT", "QUOTA", "CONNECTION", "API", "BILLING"]);

const SHORT: Record<string, string> = {
  RATE_LIMIT: "busy or out of free quota",
  BILLING: "credit balance empty",
  QUOTA: "free allowance used up",
  CONNECTION: "not reachable or too slow",
  API: "server error",
  MAX_TOKENS: "answer cut off",
  PARSE: "unusable answer",
  TOO_LARGE: "input too large",
  REFUSAL: "declined",
  NO_KEY: "no key",
  BAD_KEY: "key rejected",
  PERMISSION: "access refused",
  MODEL: "model unavailable",
  NOT_FOUND: "not found",
  WORKSPACE_ID: "needs ANTHROPIC_WORKSPACE_ID",
  BAD_WORKSPACE_ID: "workspace ID malformed",
  BAD_REQUEST: "request rejected",
};

function shortReason(e: HttpError): string {
  const base = SHORT[e.code] ?? e.message.slice(0, 120);
  return e instanceof EngineError && e.reason ? `${base} (${e.reason.length > 90 ? `${e.reason.slice(0, 90)}…` : e.reason})` : base;
}

const HOUR = 60 * 60 * 1000;

/**
 * How long browsers should rest on the built-in engine: a couple of minutes when an
 * engine only hit a per-minute limit (it reset soon), an hour for daily or monthly
 * quotas, outages and anything without a hint.
 */
function restFor(failures: Array<{ error: HttpError }>): number {
  const soon = failures.flatMap((f) => (f.error instanceof EngineError && f.error.code === "RATE_LIMIT" && f.error.retryAfterMs !== undefined && f.error.retryAfterMs <= 5 * 60_000 ? [f.error.retryAfterMs] : []));
  return soon.length ? Math.max(2 * 60_000, Math.min(...soon)) : HOUR;
}

function combine(list: Engine[], failures: Array<{ engine: Engine; error: HttpError }>, kind: "structured" | "chat"): HttpError {
  // A lone Claude key keeps its own detailed message (an empty balance switches the browser to the built-in engine).
  if (list.length === 1 && list[0].kind === "claude") return failures[0].error;
  const input = failures.find((f) => INPUT.has(f.error.code));
  if (input) return input.error;
  const summary = failures.map((f) => `${f.engine.label}: ${shortReason(f.error)}`).join("; ");
  if (failures.every((f) => CONFIG.has(f.error.code))) {
    return new HttpError(502, `No AI engine could be used. ${summary}. Fix the key in Vercel → Settings → Environment Variables and redeploy. Settings → Test AI connection checks each engine.`, "AI_CONFIG");
  }
  if (failures.every((f) => TRANSIENT.has(f.error.code) || CONFIG.has(f.error.code))) {
    const restMs = restFor(failures);
    const span = restMs >= HOUR ? "the next hour" : `about ${Math.round(restMs / 60_000)} minutes`;
    const next = kind === "chat" ? "Mock interviews need AI, so try this answer again after that; the rest of the site uses the free built-in engine meanwhile." : "Your next try uses it, and AI comes back by itself.";
    const e = new HttpError(503, `The AI engines can't answer right now (${summary}). Job Vettai switched this browser to the free built-in engine for ${span}. ${next}`, "AI_UNAVAILABLE");
    e.restMs = restMs;
    return e;
  }
  // Something about this particular request (declined, unusable or cut-off answer): other requests may still work.
  return new HttpError(502, `The AI engines couldn't complete this request (${summary}). Try again; if it keeps failing, shorten the input.`, "AI_FAILED");
}

// Time kept back for each engine still to come, so one slow engine can't starve the backup.
const RESERVE_PER_ENGINE_MS = 40_000;

async function runChain<R>(list: Engine[], budgetMs: number, kind: "structured" | "chat", run: (e: Engine, deadline: number, hasBackup: boolean) => Promise<R>): Promise<R> {
  const deadline = Date.now() + budgetMs;
  const failures: Array<{ engine: Engine; error: HttpError }> = [];
  for (const [i, e] of list.entries()) {
    const remaining = deadline - Date.now();
    if (remaining < 5000) {
      failures.push({ engine: e, error: new EngineError(504, `${e.label} was skipped: no time left.`, "CONNECTION", "skipped, no time left") });
      continue;
    }
    const later = list.length - i - 1;
    const reserve = later ? Math.min(later * RESERVE_PER_ENGINE_MS, Math.floor(remaining / 2)) : 0;
    try {
      return await run(e, deadline - reserve, later > 0);
    } catch (error) {
      failures.push({ engine: e, error: toHttpError(error) });
    }
  }
  throw combine(list, failures, kind);
}

/** One structured-output call through the engine chain. Returns the schema-validated object. */
export async function structured<T extends z.ZodType>({
  req,
  schema,
  system,
  user,
  effort = "medium",
  maxTokens,
  budgetMs = 270_000,
  pdfOptional = false,
}: {
  req: Request;
  schema: T;
  system: string;
  user: UserContent;
  effort?: Effort;
  maxTokens?: number;
  /** Total time for every engine together; keep it under the route's maxDuration. */
  budgetMs?: number;
  /** The user also pasted text, so a PDF without readable text can be skipped by engines that need text. */
  pdfOptional?: boolean;
}): Promise<z.infer<T>> {
  const list = engines(req);
  const text = flattener(user, pdfOptional);
  return runChain(list, budgetMs, "structured", async (e, deadline, hasBackup) => {
    if (e.kind === "free") return compatStructured(e.provider, { schema, system, user: await text(), deadline, hasBackup });
    return claudeStructured(claudeCtx(e), { schema, system, user, effort, maxTokens, timeoutMs: list.length > 1 ? deadline - Date.now() : undefined });
  });
}

/** Plain-text call through the engine chain (the mock interview chat). */
export async function chat({ req, system, messages, effort = "low", budgetMs = 110_000 }: { req: Request; system: string; messages: ChatMessage[]; effort?: Effort; budgetMs?: number }): Promise<string> {
  const list = engines(req);
  return runChain(list, budgetMs, "chat", async (e, deadline, hasBackup) => {
    if (e.kind === "free") return compatChat(e.provider, { system, messages, deadline, hasBackup });
    return claudeChat(claudeCtx(e), { system, messages, effort, timeoutMs: list.length > 1 ? deadline - Date.now() : undefined });
  });
}

/** The free way out of an empty Anthropic balance, if this site offers one. */
function billingAlternative(source: KeySource): string {
  const free = freeProviders().length > 0;
  if (source === "server") return free ? ", or delete ANTHROPIC_API_KEY in Vercel to rely on the free engines" : ", or add a free MISTRAL_API_KEY or GROQ_API_KEY in Vercel";
  return free || envVar("ANTHROPIC_API_KEY") ? ", or remove your key in Settings to use this site's AI" : "";
}

export interface EngineCheck {
  engine: EngineId;
  label: string;
  ok: boolean;
  model?: string;
  source?: KeySource;
  workspace?: boolean;
  code?: string;
  message?: string;
  ms: number;
}

/** Settings → Test AI connection: one tiny request to every engine this request could use, side by side. */
export async function pingAll(req: Request): Promise<{ results: EngineCheck[] }> {
  const list = engines(req);
  const deadline = Date.now() + 40_000;
  const results = await Promise.all(
    list.map(async (e): Promise<EngineCheck> => {
      const t0 = Date.now();
      try {
        if (e.kind === "free") {
          const r = await compatPing(e.provider, deadline);
          return { engine: e.id, label: e.label, ok: true, model: r.model, ms: Date.now() - t0 };
        }
        const r = await claudePing(claudeCtx(e), deadline - Date.now());
        return { engine: "claude", label: e.label, ok: true, model: r.model, source: r.source, workspace: r.workspace, ms: Date.now() - t0 };
      } catch (error) {
        const h = toHttpError(error);
        // The usual billing text says the browser was switched to the built-in engine; a test switches nothing.
        const message =
          h.code === "BILLING"
            ? `The Anthropic credit balance is empty. Add credits in Anthropic Console → Plans & Billing${billingAlternative(e.label === "Claude" ? "server" : "visitor")}.`
            : h.message;
        return { engine: e.id, label: e.label, ok: false, code: h.code, message, ms: Date.now() - t0 };
      }
    }),
  );
  return { results };
}
