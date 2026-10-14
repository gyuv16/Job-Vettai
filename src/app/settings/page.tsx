"use client";

import { motion } from "framer-motion";
import { Activity, CircleCheck, CircleX, Database, Download, Eye, EyeOff, KeyRound, Laptop, Moon, Palette, Settings, ShieldCheck, Sparkles, Sun, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fadeUp, PageHeader, stagger } from "@/components/motion/effects";
import { Modal, toast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn, Field, Input, Select, Switch } from "@/components/ui/primitives";
import { api, refreshStatus, serverEngines, useAiMode } from "@/lib/api";
import { download } from "@/lib/docs";
import { today } from "@/lib/framework";
import { buildSample } from "@/lib/sample";
import { useStore } from "@/lib/store";
import type { ServerStatus, Settings as AppSettings } from "@/lib/types";

export default function SettingsPage() {
  const { mode, status } = useAiMode();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const importAll = useStore((s) => s.importAll);
  const [show, setShow] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const engines = serverEngines(status);
  const chain = engineChain(engines);
  // Saved settings from before Free mode existed have no freeMode field.
  const freeMode = settings.freeMode ?? "off";

  const exportData = () => {
    const { profile, jobs, applications, upskill } = useStore.getState();
    download(`job-vettai-backup-${today()}.json`, JSON.stringify({ app: "job-vettai", version: 1, exportedAt: new Date().toISOString(), profile, jobs, applications, upskill }, null, 2), "application/json");
  };

  const importData = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.app !== "job-vettai") throw new Error("This is not a Job Vettai backup file.");
      importAll({ profile: data.profile, jobs: data.jobs, applications: data.applications, upskill: data.upskill });
      toast.success("Backup restored");
    } catch (e) {
      toast.error("Import failed", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Settings" icon={<Settings className="h-3 w-3" />} title="Settings and data" subtitle="Choose the AI engine, tune the look and feel, and back up everything you have built." />
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <ConnectionCheck status={status} settings={settings} onRemoveKey={() => setSettings({ apiKey: "", workspaceId: "" })} />
        </motion.div>
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <Card>
            <CardHeader
              title="AI engine"
              subtitle="Free AI (Mistral, Groq) or Claude powers evaluation, drafting, review, interview prep and upskilling"
              icon={<Sparkles className="h-4 w-4" />}
              action={
                <Badge tone={mode === "heuristic" || mode === "locked" ? "warning" : mode === "loading" ? "neutral" : "good"}>
                  {mode === "user-key" ? "Using your Claude key" : mode === "server-key" ? (engines.mistral || engines.groq ? "Using free AI" : "Using this site's Claude") : mode === "free" ? (freeMode === "limit" ? "Built-in · AI resting" : "Built-in engine") : mode === "locked" ? "Access code needed" : mode === "heuristic" ? "Built-in engine" : "Checking…"}
                </Badge>
              }
            />
            <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
              <div className="space-y-4">
                <div className={cn("flex items-center justify-between gap-3 rounded-xl border p-3", freeMode !== "off" ? "border-[color-mix(in_oklab,var(--good)_45%,transparent)]" : "border-line")}>
                  <div>
                    <p className="text-sm font-medium">Built-in engine only</p>
                    <p className="text-xs leading-relaxed text-muted">{builtInNote(freeMode, settings.freeModeUntil)}</p>
                  </div>
                  <Switch checked={freeMode !== "off"} onChange={(v) => setSettings({ freeMode: v ? "manual" : "off", freeModeUntil: undefined })} label="Built-in engine only" />
                </div>
                <Field label="Your own Anthropic API key (optional, paid)" hint="Only if you want Claude and pay Anthropic for it yourself. Leave empty to use this site's free AI. Stored only in this browser and passed to Anthropic for your requests, never stored on the server.">
                  {(id) => (
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                      <Input id={id} type={show ? "text" : "password"} value={settings.apiKey} onChange={(e) => setSettings({ apiKey: e.target.value.trim() })} placeholder="sk-ant-…" className="pl-9 pr-10 font-mono" autoComplete="off" spellCheck={false} />
                      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide key" : "Show key"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle hover:text-fg">
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  )}
                </Field>
                {settings.apiKey && (
                  <Field label="Workspace ID (only if your key needs it)" hint="Keys created at organisation level, not inside a workspace, must name a workspace. Find it in the Anthropic Console under Settings → Workspaces.">
                    {(id) => (
                      <Input
                        id={id}
                        value={settings.workspaceId ?? ""}
                        onChange={(e) => setSettings({ workspaceId: e.target.value.trim() })}
                        placeholder="wrkspc_01…"
                        className="font-mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </Field>
                )}
                {status?.accessCodeRequired && !settings.apiKey && (
                  <Field label="Access code" hint="This deployment protects its own AI key with an access code.">
                    {(id) => <Input id={id} type="password" value={settings.accessCode} onChange={(e) => setSettings({ accessCode: e.target.value })} />}
                  </Field>
                )}
                {(settings.apiKey || engines.claude) && (
                  <Field label="Claude model">
                    {(id) => (
                      <Select id={id} value={settings.model} onChange={(e) => setSettings({ model: e.target.value })}>
                        <option value="">Default ({status?.defaultModel ?? "claude-opus-5-5"})</option>
                        {(status?.models ?? []).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                )}
              </div>
              <div className="space-y-3 rounded-2xl border border-line bg-[color-mix(in_oklab,var(--bg-elev)_60%,transparent)] p-4 text-xs leading-relaxed text-muted">
                <p className="flex items-center gap-2 font-semibold text-fg">
                  <ShieldCheck className="h-4 w-4 text-good" /> How the engine is chosen
                </p>
                <p>
                  <b className="text-fg">1. Your Claude key</b> if you enter one here (you pay Anthropic for your own usage).
                </p>
                <p>
                  <b className="text-fg">2. This site's AI</b>{status?.accessCodeRequired ? " (after you enter its access code)" : ""}: <b className="text-fg">Mistral</b> (free, <code>MISTRAL_API_KEY</code>), then <b className="text-fg">Groq</b> (free backup, <code>GROQ_API_KEY</code>), then <b className="text-fg">Claude</b> (paid, <code>ANTHROPIC_API_KEY</code>) if set. {chain.length ? `This deployment has: ${chain.join(", ")}.` : "This deployment has none yet."}
                </p>
                <p>
                  <b className="text-fg">3. Built-in engine</b> otherwise, and for an hour whenever every AI engine is busy: keyword scoring and template drafts that work offline, so every page stays usable.
                </p>
                <p>Postings, CVs and company pages are always treated as untrusted data: instructions hidden inside them are ignored.</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader title="Appearance" icon={<Palette className="h-4 w-4" />} />
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["dark", "Dark", Moon],
                    ["light", "Light", Sun],
                    ["system", "System", Laptop],
                  ] as const
                ).map(([v, label, Icon]) => (
                  <button key={v} onClick={() => setSettings({ theme: v })} className={cn("relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-xs font-medium transition", settings.theme === v ? "border-transparent text-white" : "border-line text-muted hover:text-fg")}>
                    {settings.theme === v && <motion.span layoutId="theme-pick" className="absolute inset-0 rounded-2xl bg-brand-gradient" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                    <Icon className="relative h-5 w-5" />
                    <span className="relative">{label}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line p-3">
                <div>
                  <p className="text-sm font-medium">Reduce motion</p>
                  <p className="text-xs text-muted">Turns off decorative animation (your OS setting is also respected).</p>
                </div>
                <Switch checked={settings.reduceMotion} onChange={(v) => setSettings({ reduceMotion: v })} label="Reduce motion" />
              </div>
              <Field label="Follow-up reminder after (days of silence)">
                {(id) => <Input id={id} type="number" min={3} max={60} value={settings.followupDays} onChange={(e) => setSettings({ followupDays: Math.max(3, Math.min(60, Number(e.target.value) || 10)) })} />}
              </Field>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader title="Your data" subtitle="Everything lives in this browser's local storage" icon={<Database className="h-4 w-4" />} />
            <div className="space-y-3 p-5">
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => importData(e.target.files?.[0])} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportData}>
                  Export backup
                </Button>
                <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
                  Import backup
                </Button>
                <Button
                  variant="secondary"
                  icon={<Sparkles className="h-4 w-4" />}
                  onClick={() => {
                    if (window.confirm("Replace your current data with the fictional sample data?")) {
                      importAll(buildSample());
                      toast.success("Sample data loaded");
                    }
                  }}
                >
                  Load sample data
                </Button>
                <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setResetOpen(true)}>
                  Reset…
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-subtle">Clearing browser data deletes everything here. Export a backup regularly, especially before switching devices.</p>
              <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-subtle">
                Workflow adapted from the open-source{" "}
                <a href="https://github.com/MadsLorentzen/ai-job-search" target="_blank" rel="noopener noreferrer" className="underline hover:text-fg">
                  ai-job-search
                </a>{" "}
                framework (MIT). Job listings come from LinkedIn's public guest pages and freehire.me.
              </p>
            </div>
          </Card>
        </motion.div>
      </motion.div>
      <ResetModal open={resetOpen} onClose={() => setResetOpen(false)} />
    </div>
  );
}

function engineChain(e: { mistral: boolean; groq: boolean; claude: boolean }): string[] {
  return [e.mistral && "Mistral", e.groq && "Groq", e.claude && "Claude"].filter((x): x is string => !!x);
}

function builtInNote(freeMode: AppSettings["freeMode"], until?: number): string {
  if (freeMode === "billing") return "Switched on because the Anthropic credit ran out. Every page uses the free built-in engine. Turn it off after adding credit or a free Mistral / Groq key.";
  if (freeMode === "limit") {
    const at = until ? new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "soon";
    return `Switched on until ${at} because the AI engines were busy or out of today's free quota. AI comes back by itself, or turn this off to retry now.`;
  }
  return "Skip AI and always use the free built-in engine (keyword scoring and template drafts, no keys needed).";
}

interface EngineCheck {
  engine: "mistral" | "groq" | "claude";
  label: string;
  ok: boolean;
  model?: string;
  source?: "visitor" | "server";
  workspace?: boolean;
  code?: string;
  message?: string;
  ms: number;
}

interface PingResult {
  results: EngineCheck[];
}

function CheckRow({ label, detail, tone, text, i }: { label: string; detail?: string; tone: "good" | "warning" | "critical" | "neutral"; text: string; i: number }) {
  return (
    <motion.li initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail && <p className="text-[11px] leading-relaxed text-muted">{detail}</p>}
      </div>
      <Badge tone={tone} className="shrink-0">
        {text}
      </Badge>
    </motion.li>
  );
}

/** Shows how this deployment is configured and runs one tiny real request against each AI engine. */
function ConnectionCheck({ status, settings, onRemoveKey }: { status: ServerStatus | null; settings: AppSettings; onRemoveKey: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; data: PingResult } | { ok: false; message: string } | null>(null);
  const setSettings = useStore((s) => s.setSettings);
  const usingOwnKey = !!settings.apiKey;
  const freeMode = settings.freeMode ?? "off";
  const engines = serverEngines(status);
  const chain = engineChain(engines);
  const locked = !usingOwnKey && !!status?.serverKey && status.accessCodeRequired && !settings.accessCode;

  // Always show the deployment as it is now, not as it was when this tab first loaded.
  useEffect(() => {
    refreshStatus();
  }, []);

  const test = async () => {
    setBusy(true);
    setResult(null);
    try {
      const [, data] = await Promise.all([refreshStatus(), api<PingResult>("/api/test", {})]);
      setResult({ ok: true, data });
      if ((freeMode === "billing" || freeMode === "limit") && data.results.some((r) => r.ok)) {
        // It switched on automatically; an engine answers again, so go back to AI.
        setSettings({ freeMode: "off", freeModeUntil: undefined });
        toast.success("AI is back on", "An AI engine answered, so the built-in-only switch is off again.");
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const version = status?.commit ? `${status.commit}${status.branch ? ` · ${status.branch}` : ""}${status.environment ? ` · ${status.environment}` : ""}` : "Local or unknown build";
  const ws = status?.serverWorkspace ?? "unset";
  const anyOk = result?.ok && result.data.results.some((r) => r.ok);
  let i = 0;

  return (
    <Card>
      <CardHeader
        title="Connection check"
        subtitle="What this deployment has configured, and a live test request"
        icon={<Activity className="h-4 w-4" />}
        action={
          <Button size="sm" onClick={test} loading={busy} icon={<Activity className="h-3.5 w-3.5" />}>
            Test AI connection
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
        <ul className="divide-y divide-[var(--card-border)]">
          <CheckRow i={i++} label="Site version" detail="Should match the latest commit on main after you merge and Vercel redeploys." tone="neutral" text={version} />
          <CheckRow i={i++} label="Mistral (MISTRAL_API_KEY)" detail="Free main AI engine. Key from console.mistral.ai, no card needed." tone={engines.mistral ? "good" : engines.groq ? "neutral" : "warning"} text={engines.mistral ? "Set" : "Not set"} />
          <CheckRow i={i++} label="Groq (GROQ_API_KEY)" detail="Free backup engine, used when Mistral is busy. Key from console.groq.com." tone={engines.groq ? "good" : "neutral"} text={engines.groq ? "Set" : "Not set"} />
          <CheckRow i={i++} label="Claude (ANTHROPIC_API_KEY)" detail="Optional and paid. Tried after the free engines." tone="neutral" text={engines.claude ? "Set" : "Not set"} />
          {engines.claude && (
            <CheckRow
              i={i++}
              label="Workspace ID (ANTHROPIC_WORKSPACE_ID)"
              detail="Only needed when the Claude key was created at organisation level, not inside a workspace."
              tone={ws === "set" ? "good" : ws === "invalid" ? "critical" : "neutral"}
              text={ws === "set" ? "Set" : ws === "invalid" ? "Wrong format" : "Not set"}
            />
          )}
          {engines.claude && status?.modelSetting === "invalid" && (
            <CheckRow i={i++} label="Model (ANTHROPIC_MODEL)" detail={`Not a supported model, so ${status.defaultModel} is used. Supported: ${status.models.join(", ")}.`} tone="warning" text="Ignored" />
          )}
          <CheckRow i={i++} label="Access code (APP_ACCESS_CODE)" tone={status?.accessCodeRequired ? (settings.accessCode ? "good" : "warning") : "neutral"} text={status?.accessCodeRequired ? (settings.accessCode ? "Required · entered" : "Required · not entered") : "Not required"} />
          {freeMode !== "off" && (
            <CheckRow i={i++} label="Built-in engine only" detail={builtInNote(freeMode, settings.freeModeUntil)} tone="good" text={freeMode === "billing" ? "On · credit empty" : freeMode === "limit" ? "On · AI resting" : "On"} />
          )}
          <CheckRow
            i={i++}
            label="Engine used for AI requests"
            detail={usingOwnKey ? "A Claude key saved in this browser overrides this site's AI." : locked ? "Enter the access code in the AI engine section below to use this site's AI." : chain.length > 1 ? "Tried in this order; the next one answers when one is busy." : undefined}
            tone={usingOwnKey || locked ? "warning" : chain.length ? "good" : "neutral"}
            text={usingOwnKey ? "Your browser's Claude key" : locked ? "None · access code needed" : chain.length ? chain.join(" → ") : "Built-in engine"}
          />
        </ul>
        <div className="flex flex-col gap-3">
          {usingOwnKey && (
            <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_45%,transparent)] p-3 text-xs leading-relaxed">
              <p className="font-semibold">Your browser key is overriding this site's AI</p>
              <p className="mt-1 text-muted">Remove the Claude key saved here to use the site's own engines{chain.length ? ` (${chain.join(", ")})` : ""}.</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => {
                  onRemoveKey();
                  setResult(null); // the old result was for the removed key
                }}
              >
                Remove my browser key
              </Button>
            </div>
          )}
          {result === null && !busy && <p className="rounded-xl border border-dashed border-line p-4 text-xs text-muted">Press “Test AI connection” to send one tiny request to each AI engine, using exactly the same keys as the rest of the app.</p>}
          {result && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className={cn("rounded-xl border p-4 text-xs leading-relaxed", anyOk ? "border-[color-mix(in_oklab,var(--good)_40%,transparent)]" : "border-[color-mix(in_oklab,var(--critical)_40%,transparent)]")} role={anyOk ? "status" : "alert"}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {anyOk ? <CircleCheck className="h-4 w-4 text-good" /> : <CircleX className="h-4 w-4 text-critical" />}
                {anyOk ? "AI is connected" : "Connection failed"}
              </p>
              {result.ok ? (
                <ul className="mt-2 space-y-2">
                  {result.data.results.map((r, n) => (
                    <motion.li key={r.engine} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * n }} className="rounded-lg border border-line p-2.5">
                      <p className="flex items-center justify-between gap-2 font-medium text-fg">
                        <span className="flex items-center gap-1.5">
                          {r.ok ? <CircleCheck className="h-3.5 w-3.5 text-good" /> : <CircleX className="h-3.5 w-3.5 text-critical" />}
                          {r.label}
                        </span>
                        <Badge tone={r.ok ? "good" : "critical"}>{r.ok ? `${(r.ms / 1000).toFixed(1)} s` : (r.code ?? "Failed")}</Badge>
                      </p>
                      <p className="mt-1 break-words text-muted">
                        {r.ok ? `Answered on ${r.model}${r.source === "visitor" ? " with your browser's key" : ""}${r.workspace ? " and a workspace ID" : ""}.` : r.message}
                      </p>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted">{result.message}</p>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </Card>
  );
}

function ResetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reset = useStore((s) => s.reset);
  const [what, setWhat] = useState<"profile" | "data" | "all">("profile");
  const [confirm, setConfirm] = useState("");
  const desc = { profile: "Clears your profile (skills, experience, stories). Jobs and applications stay.", data: "Deletes saved jobs, applications and the upskill report. Your profile stays.", all: "Deletes everything." }[what];
  return (
    <Modal open={open} onClose={onClose} title="Reset data">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {(["profile", "data", "all"] as const).map((w) => (
            <button key={w} onClick={() => setWhat(w)} className={cn("rounded-xl border px-3 py-2 text-xs font-medium capitalize", what === w ? "border-critical bg-[color-mix(in_oklab,var(--critical)_12%,transparent)] text-critical" : "border-line text-muted")}>
              {w === "data" ? "Jobs & apps" : w}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{desc}</p>
        <Field label='Type "RESET" to confirm'>{(id) => <Input id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}</Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={confirm !== "RESET"}
            onClick={() => {
              reset(what);
              setConfirm("");
              onClose();
              toast.success("Reset complete");
            }}
          >
            Reset {what === "data" ? "jobs & apps" : what}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
