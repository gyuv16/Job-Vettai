import "server-only";

import { z } from "zod";
import { apiSchema, envVar, HttpError, type ChatMessage } from "./claude";

// Free AI engines that speak the OpenAI chat-completions dialect. Both have a
// free tier that needs no card: Mistral ("Experiment" plan) is the main engine,
// Groq the backup. Each falls back to a smaller model of its own first.

export type ProviderId = "mistral" | "groq";

export interface Provider {
  id: ProviderId;
  label: string;
  keyVar: string;
  key: string;
  baseUrl: string;
  models: string[];
  /** Output cap; Groq's free tier allows only 8K tokens a minute, input and output together. */
  maxOutput: number;
  /** System + user characters that fit the free tier's per-request budget. */
  maxInputChars: number;
  tokenParam: "max_tokens" | "max_completion_tokens";
  /** Extra request fields for a given model. */
  extra: (model: string) => Record<string, unknown>;
  /** Whether the model enforces a JSON schema; others get JSON mode with the schema in the prompt. */
  strictSchema: (model: string) => boolean;
  temperature?: number;
}

/** The free engines this deployment has keys for, in the order they are tried. */
export function freeProviders(): Provider[] {
  const list: Provider[] = [];
  const mistral = envVar("MISTRAL_API_KEY");
  if (mistral) {
    list.push({
      id: "mistral",
      label: "Mistral",
      keyVar: "MISTRAL_API_KEY",
      key: mistral,
      baseUrl: envVar("MISTRAL_BASE_URL") ?? "https://api.mistral.ai/v1",
      models: unique([envVar("MISTRAL_MODEL") ?? "mistral-medium-latest", "mistral-small-latest"]),
      maxOutput: 8000,
      maxInputChars: 200_000,
      tokenParam: "max_tokens",
      extra: () => ({}),
      strictSchema: () => true, // every current Mistral chat model supports custom structured outputs
      temperature: 0.3,
    });
  }
  const groq = envVar("GROQ_API_KEY");
  if (groq) {
    list.push({
      id: "groq",
      label: "Groq",
      keyVar: "GROQ_API_KEY",
      key: groq,
      baseUrl: envVar("GROQ_BASE_URL") ?? "https://api.groq.com/openai/v1",
      models: unique([envVar("GROQ_MODEL") ?? "openai/gpt-oss-120b", "openai/gpt-oss-20b"]),
      maxOutput: 3000,
      maxInputChars: 15_000,
      tokenParam: "max_completion_tokens",
      // Strict schemas and reasoning_effort "low" are gpt-oss features on Groq.
      extra: (model) => (GPT_OSS.test(model) ? { reasoning_effort: "low" } : {}),
      strictSchema: (model) => GPT_OSS.test(model),
    });
  }
  return list;
}

const GPT_OSS = /^openai\/gpt-oss/;

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

/** An engine failure that carries the provider's own reason and any Retry-After hint. */
export class EngineError extends HttpError {
  constructor(
    status: number,
    message: string,
    code: string,
    public reason = "",
    public retryAfterMs?: number,
  ) {
    super(status, message, code);
  }
  /** When the engine gave up: how soon one of its rate-limited models said it would be free again. */
  resetMs?: number;
}

const TRIM_MARK = "\n\n[… middle trimmed to fit the free AI engine's size limit …]\n\n";

/** Keep the start and the end (where the task instructions usually sit) and drop the middle. */
export function trimMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = Math.max(0, max - TRIM_MARK.length);
  const head = Math.ceil(room * 0.6);
  return text.slice(0, head) + TRIM_MARK + text.slice(text.length - (room - head));
}

// Postings and CVs are wrapped in <untrusted_…> tags by the prompt builders.
const DATA_BLOCK = /<(untrusted_[a-z_]+)>([\s\S]*?)<\/\1>/g;

/**
 * Fit a prompt into `max` characters by shrinking the untrusted data blocks
 * (postings, CVs) in proportion to their size, so tags, job keys, headers and
 * instructions survive. Cutting the middle of the whole prompt is the last resort.
 */
export function fitText(text: string, max: number): string {
  if (text.length <= max) return text;
  const blocks = [...text.matchAll(DATA_BLOCK)];
  const inner = blocks.reduce((n, m) => n + m[2].length, 0);
  if (inner > 0) {
    const excess = text.length - max + blocks.length * TRIM_MARK.length;
    const keep = Math.max(0, (inner - excess) / inner);
    text = text.replace(DATA_BLOCK, (_, tag: string, body: string) => `<${tag}>${trimMiddle(body, Math.max(300, Math.floor(body.length * keep)))}</${tag}>`);
  }
  return trimMiddle(text, max);
}

/** The provider's error text, which never contains our key. */
function reasonFrom(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as { error?: unknown; message?: unknown; detail?: unknown };
  const err = b.error as { message?: unknown } | string | undefined;
  const msg = typeof err === "string" ? err : typeof err?.message === "string" ? err.message : typeof b.message === "string" ? b.message : b.detail !== undefined ? JSON.stringify(b.detail) : "";
  // Groq names the owner's organisation in rate-limit errors; that has no business reaching visitors.
  return String(msg)
    .replace(/\b(org|proj|project)_[A-Za-z0-9]+/g, "$1_…")
    .slice(0, 300);
}

function retryAfter(res: Response): number | undefined {
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(h);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

function statusError(p: Provider, res: Response, reason: string): EngineError {
  const said = reason ? ` ${p.label} said: ${reason}` : "";
  const s = res.status;
  if (s === 401) return new EngineError(401, `${p.label} rejected ${p.keyVar}. Check it in Vercel's environment variables, then redeploy.${said}`, "BAD_KEY", reason);
  if (s === 403) return new EngineError(403, `${p.label} refused this request: the account may not be verified, or the key's plan may not include this model.${said}`, "PERMISSION", reason);
  if (s === 404) return new EngineError(404, `${p.label} doesn't offer the requested model to this key.${said}`, "MODEL", reason);
  if (s === 413) return new EngineError(413, `The request is too large for ${p.label}'s free limit.${said}`, "TOO_LARGE", reason);
  if (s === 429) return new EngineError(429, `${p.label} is busy or this key has used its free quota for now.${said}`, "RATE_LIMIT", reason, retryAfter(res));
  if (s === 402) return new EngineError(402, `${p.label}'s free allowance is used up for now (Mistral's resets monthly), unless pay-as-you-go is turned on.${said}`, "QUOTA", reason);
  if (s === 400 && /json_validate_failed|failed to generate json|schema/i.test(reason)) return new EngineError(502, `${p.label} returned output that did not match the expected format.${said}`, "PARSE", reason);
  if (s === 400 || s === 422) return new EngineError(400, `${p.label} rejected the request.${said}`, "BAD_REQUEST", reason);
  return new EngineError(502, `${p.label} had a server error (${s}).${said}`, "API", reason);
}

type Message = { role: "system" | "user" | "assistant"; content: string };

interface CallOptions {
  messages: Message[];
  schema?: z.ZodType;
  maxOutput: number;
  /** Absolute time (ms) by which the call must finish. */
  deadline: number;
  /** Retry the same model once after a short rate limit, and fall back to the next model. */
  persistent: boolean;
  /** Another engine follows: on a hung or unreachable host, hand it the time instead of trying the smaller model. */
  hasBackup?: boolean;
}

// One model attempt never takes more than this, so a hung engine still leaves time for the next one.
const ATTEMPT_CAP_MS = 150_000;
const MIN_ATTEMPT_MS = 4_000;

async function once(p: Provider, model: string, o: CallOptions, timeoutMs: number): Promise<{ text: string; model: string }> {
  const body: Record<string, unknown> = {
    model,
    messages: o.messages,
    [p.tokenParam]: Math.min(o.maxOutput, p.maxOutput),
    ...p.extra(model),
    ...(p.temperature !== undefined ? { temperature: p.temperature } : {}),
  };
  if (o.schema && p.strictSchema(model)) {
    body.response_format = { type: "json_schema", json_schema: { name: "result", schema: apiSchema(o.schema), strict: true } };
  } else if (o.schema) {
    // JSON mode only guarantees valid JSON, so the schema goes in the prompt; zod still checks the result.
    body.response_format = { type: "json_object" };
    body.messages = o.messages.map((m, i) => (i === 0 && m.role === "system" ? { ...m, content: `${m.content}\n\nJSON schema to follow exactly:\n${JSON.stringify(apiSchema(o.schema!))}` } : m));
  }

  // AbortSignal.timeout needs a whole, positive number of milliseconds.
  const signal = AbortSignal.timeout(Math.max(1, Math.floor(timeoutMs)));
  let res: Response;
  try {
    res = await fetch(`${p.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new EngineError(504, timedOut ? `${p.label} didn't answer in time.` : `Could not reach ${p.label}.`, "CONNECTION", timedOut ? "timed out" : "network error");
  }
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const e = statusError(p, res, reasonFrom(data));
    console.warn(`[${p.id}]`, res.status, model, e.code, e.reason);
    throw e;
  }
  const choice = (data as { choices?: Array<{ finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }> } | null)?.choices?.[0];
  const content = choice?.message?.content;
  // Mistral can return content as chunks ({type:"text"} next to {type:"thinking"}).
  const text = typeof content === "string" ? content : Array.isArray(content) ? content.flatMap((c) => (c && typeof c === "object" && (c as { type?: string }).type === "text" ? [String((c as { text?: unknown }).text ?? "")] : [])).join("") : "";
  if (typeof choice?.message?.refusal === "string" && choice.message.refusal) throw new EngineError(422, `${p.label} declined this request. Try rephrasing the input.`, "REFUSAL", choice.message.refusal.slice(0, 200));
  if (choice?.finish_reason === "content_filter") throw new EngineError(422, `${p.label} declined this request. Try rephrasing the input.`, "REFUSAL", "content filter");
  if (choice?.finish_reason === "length") throw new EngineError(502, `${p.label}'s answer was cut off before it finished.`, "MAX_TOKENS", "output limit reached");
  if (!text.trim()) throw new EngineError(502, `${p.label} returned an empty answer.`, "PARSE", "empty answer");
  return { text, model: (data as { model?: string }).model ?? model };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Per-minute limits clear within a minute; anything longer (daily or monthly quota) isn't worth waiting for.
const MAX_RATE_WAIT_MS = 65_000;
const MAX_RATE_RETRIES = 2;

/**
 * Try each of the provider's models in turn, within the deadline. Each model has
 * its own rate limit, so a rate-limited model hands over to the next one first;
 * when every model is rate-limited, wait for the soonest per-minute reset that fits.
 */
async function call<R>(p: Provider, o: CallOptions, accept: (answer: { text: string; model: string }) => R): Promise<R> {
  let last: EngineError | undefined;
  const queue = o.persistent ? [...p.models] : p.models.slice(0, 1);
  const limited: Array<{ model: string; at: number }> = [];
  let retries = 0;
  // Whichever model failed last, remember the soonest reset any of them reported (it sets the browser's rest).
  const giveUp = (e: EngineError, pending = limited): EngineError => {
    const soonest = Math.min(...pending.map((l) => l.at));
    if (Number.isFinite(soonest)) e.resetMs = Math.max(0, soonest - Date.now());
    return e;
  };
  for (;;) {
    let model = queue.shift();
    if (!model) {
      limited.sort((a, b) => a.at - b.at);
      const next = limited[0];
      const wait = next ? Math.max(1000, next.at - Date.now()) : Infinity;
      if (!next || !o.persistent || retries >= MAX_RATE_RETRIES || wait > MAX_RATE_WAIT_MS || o.deadline - Date.now() < wait + 15_000) {
        throw giveUp(last ?? new EngineError(500, `${p.label}: no model configured.`, "INTERNAL"));
      }
      limited.shift();
      retries++;
      await sleep(wait);
      model = next.model;
    }
    const remaining = o.deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) throw giveUp(last ?? new EngineError(504, `${p.label} had no time left to answer.`, "CONNECTION", "out of time"));
    try {
      // Checking the answer inside the loop lets an unusable answer fall back to the next model too.
      return accept(await once(p, model, o, Math.min(remaining, ATTEMPT_CAP_MS)));
    } catch (error) {
      last = error instanceof EngineError ? error : new EngineError(500, `${p.label}: unexpected error.`, "INTERNAL", error instanceof Error ? error.message.slice(0, 200) : "");
      // Same key and host for every model: a rejected key won't work on the next one either, and with
      // a backup engine waiting, a hung or unreachable host would only eat the time the backup needs.
      if (last.code === "BAD_KEY" || (last.code === "CONNECTION" && o.hasBackup) || !o.persistent) throw giveUp(last);
      if (last.code === "RATE_LIMIT") limited.push({ model, at: Date.now() + (last.retryAfterMs ?? 1500) });
      // Anything else (model missing, refused for this plan, bad output): try the next model.
    }
  }
}

function fitMessages(p: Provider, system: string, rest: Message[]): Message[] {
  const total = system.length + rest.reduce((n, m) => n + m.content.length, 0);
  if (total <= p.maxInputChars) return [{ role: "system", content: system }, ...rest];
  // Keep the system prompt (task + honesty rules) whole when it is small, and trim the user data instead.
  const sys = fitText(system, Math.max(2000, Math.floor(p.maxInputChars * 0.6)));
  let room = p.maxInputChars - sys.length;
  if (rest.length === 1) return [{ role: "system", content: sys }, { ...rest[0], content: fitText(rest[0].content, Math.max(2000, room)) }];
  // Chat: keep the most recent turns that fit.
  const kept: Message[] = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const m = rest[i];
    if (m.content.length > room && kept.length) break;
    const content = m.content.length > room ? trimMiddle(m.content, Math.max(1000, room)) : m.content;
    kept.unshift({ ...m, content });
    room -= content.length;
  }
  // Some engines insist the conversation opens with the user.
  if (kept[0]?.role === "assistant") kept.unshift({ role: "user", content: "(Earlier conversation trimmed.)" });
  return [{ role: "system", content: sys }, ...kept];
}

function parseJson(p: Provider, text: string): unknown {
  const raw = text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1");
  try {
    return JSON.parse(raw);
  } catch {
    throw new EngineError(502, `${p.label} returned output that was not valid JSON.`, "PARSE", "invalid JSON");
  }
}

export async function compatStructured<T extends z.ZodType>(p: Provider, { schema, system, user, deadline, hasBackup }: { schema: T; system: string; user: string; deadline: number; hasBackup?: boolean }): Promise<z.infer<T>> {
  const messages = fitMessages(p, `${system}\n\nReply with one JSON object that follows the response schema, and nothing else.`, [{ role: "user", content: user }]);
  return call(p, { messages, schema, maxOutput: p.maxOutput, deadline, persistent: true, hasBackup }, ({ text }) => {
    const parsed = schema.safeParse(parseJson(p, text));
    if (!parsed.success) throw new EngineError(502, `${p.label} returned output that did not match the expected format.`, "PARSE", "schema mismatch");
    return parsed.data as z.infer<T>;
  });
}

export async function compatChat(p: Provider, { system, messages, deadline, hasBackup }: { system: string; messages: ChatMessage[]; deadline: number; hasBackup?: boolean }): Promise<string> {
  return call(p, { messages: fitMessages(p, system, messages), maxOutput: 1500, deadline, persistent: true, hasBackup }, ({ text }) => text.trim());
}

/** Smallest real request, for Settings → Test AI connection. Uses the main model only. */
export async function compatPing(p: Provider, deadline: number): Promise<{ model: string; reply: string }> {
  return call(p, { messages: [{ role: "user", content: "Reply with the single word OK." }], maxOutput: 300, deadline, persistent: false }, ({ text, model }) => ({ model, reply: text.trim().slice(0, 40) }));
}
