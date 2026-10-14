"use client";

import { motion } from "framer-motion";
import { Activity, CircleCheck, CircleX, Database, Download, Eye, EyeOff, KeyRound, Laptop, Moon, Palette, Settings, ShieldCheck, Sparkles, Sun, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { fadeUp, PageHeader, stagger } from "@/components/motion/effects";
import { Modal, toast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn, Field, Input, Select, Switch } from "@/components/ui/primitives";
import { api, useAiMode } from "@/lib/api";
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
              subtitle="Claude powers evaluation, drafting, review, interview prep and upskilling"
              icon={<Sparkles className="h-4 w-4" />}
              action={<Badge tone={mode === "heuristic" ? "warning" : mode === "loading" ? "neutral" : "good"}>{mode === "user-key" ? "Using your key" : mode === "server-key" ? "Using this site's key" : mode === "heuristic" ? "Heuristic mode" : "Checking…"}</Badge>}
            />
            <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
              <div className="space-y-4">
                <Field label="Your Anthropic API key (optional)" hint="Stored only in this browser. Sent to this site's own API routes, which pass it to Anthropic for your requests and never store it.">
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
                <Field label="Model">
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
              </div>
              <div className="space-y-3 rounded-2xl border border-line bg-[color-mix(in_oklab,var(--bg-elev)_60%,transparent)] p-4 text-xs leading-relaxed text-muted">
                <p className="flex items-center gap-2 font-semibold text-fg">
                  <ShieldCheck className="h-4 w-4 text-good" /> How the engine is chosen
                </p>
                <p>
                  <b className="text-fg">1. Your key</b> if you enter one here (you pay for your own usage).
                </p>
                <p>
                  <b className="text-fg">2. This site's key</b> if the deployment sets <code>ANTHROPIC_API_KEY</code> (and <code>ANTHROPIC_WORKSPACE_ID</code> when that key isn't tied to a workspace){status?.accessCodeRequired ? " and you enter its access code" : ""}. {status?.serverKey ? "This deployment has one." : "This deployment does not have one."}
                </p>
                <p>
                  <b className="text-fg">3. Heuristic mode</b> otherwise: keyword-overlap scoring and template drafts that work offline, so every page stays usable.
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

interface PingResult {
  ok: true;
  source: "visitor" | "server";
  workspace: boolean;
  model: string;
  reply: string;
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

/** Shows how this deployment is configured and runs one tiny real Claude request. */
function ConnectionCheck({ status, settings, onRemoveKey }: { status: ServerStatus | null; settings: AppSettings; onRemoveKey: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; data: PingResult } | { ok: false; message: string } | null>(null);
  const usingOwnKey = !!settings.apiKey;

  const test = async () => {
    setBusy(true);
    setResult(null);
    try {
      setResult({ ok: true, data: await api<PingResult>("/api/test", {}) });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const version = status?.commit ? `${status.commit}${status.branch ? ` · ${status.branch}` : ""}${status.environment ? ` · ${status.environment}` : ""}` : "Local or unknown build";
  const ws = status?.serverWorkspace ?? "unset";

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
          <CheckRow i={0} label="Site version" detail="Should match the latest commit on main after you merge and Vercel redeploys." tone="neutral" text={version} />
          <CheckRow i={1} label="Site key (ANTHROPIC_API_KEY)" tone={status?.serverKey ? "good" : "warning"} text={status?.serverKey ? "Set" : "Not set"} />
          <CheckRow
            i={2}
            label="Workspace ID (ANTHROPIC_WORKSPACE_ID)"
            detail="Only needed when the site key was created at organisation level, not inside a workspace."
            tone={ws === "set" ? "good" : ws === "invalid" ? "critical" : "neutral"}
            text={ws === "set" ? "Set" : ws === "invalid" ? "Wrong format" : "Not set"}
          />
          <CheckRow i={3} label="Access code (APP_ACCESS_CODE)" tone={status?.accessCodeRequired ? (settings.accessCode ? "good" : "warning") : "neutral"} text={status?.accessCodeRequired ? (settings.accessCode ? "Required · entered" : "Required · not entered") : "Not required"} />
          <CheckRow
            i={4}
            label="Key used for AI requests"
            detail={usingOwnKey ? "A key saved in this browser overrides the site key." : undefined}
            tone={usingOwnKey ? "warning" : status?.serverKey ? "good" : "neutral"}
            text={usingOwnKey ? "Your browser's key" : status?.serverKey ? "Site key" : "None · heuristic mode"}
          />
        </ul>
        <div className="flex flex-col gap-3">
          {usingOwnKey && (
            <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_45%,transparent)] p-3 text-xs leading-relaxed">
              <p className="font-semibold">Your browser key is overriding the site key</p>
              <p className="mt-1 text-muted">If you set the key in Vercel, remove the one saved here so the site key (and its workspace ID) is used.</p>
              <Button size="sm" variant="secondary" className="mt-2" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={onRemoveKey}>
                Remove my browser key
              </Button>
            </div>
          )}
          {result === null && !busy && <p className="rounded-xl border border-dashed border-line p-4 text-xs text-muted">Press “Test AI connection” to send one tiny request to Claude using exactly the same key and workspace as the rest of the app.</p>}
          {result && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }} className={cn("rounded-xl border p-4 text-xs leading-relaxed", result.ok ? "border-[color-mix(in_oklab,var(--good)_40%,transparent)]" : "border-[color-mix(in_oklab,var(--critical)_40%,transparent)]")} role={result.ok ? "status" : "alert"}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {result.ok ? <CircleCheck className="h-4 w-4 text-good" /> : <CircleX className="h-4 w-4 text-critical" />}
                {result.ok ? "Claude is connected" : "Connection failed"}
              </p>
              {result.ok ? (
                <p className="mt-1 text-muted">
                  Answered using {result.data.source === "visitor" ? "your browser's key" : "the site key"}
                  {result.data.workspace ? " with a workspace ID" : ""} on {result.data.model}.
                </p>
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
