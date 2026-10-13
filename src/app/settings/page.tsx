"use client";

import { motion } from "framer-motion";
import { Database, Download, Eye, EyeOff, KeyRound, Laptop, Moon, Palette, Settings, ShieldCheck, Sparkles, Sun, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { fadeUp, PageHeader, stagger } from "@/components/motion/effects";
import { Modal, toast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn, Field, Input, Select, Switch } from "@/components/ui/primitives";
import { useAiMode } from "@/lib/api";
import { download } from "@/lib/docs";
import { today } from "@/lib/framework";
import { buildSample } from "@/lib/sample";
import { useStore } from "@/lib/store";

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
                  <b className="text-fg">2. This site's key</b> if the deployment sets <code>ANTHROPIC_API_KEY</code>{status?.accessCodeRequired ? " and you enter its access code" : ""}. {status?.serverKey ? "This deployment has one." : "This deployment does not have one."}
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
