"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CircleDashed,
  ClipboardCopy,
  Download,
  FileSearch,
  FileText,
  Gauge,
  Link2,
  Mail,
  MessagesSquare,
  PenLine,
  Printer,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  SpellCheck2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { fadeUp, PageHeader, RadarChart, RadialGauge, stagger } from "@/components/motion/effects";
import { toast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn, Field, Input, Select, Tabs, Textarea, type Tone } from "@/components/ui/primitives";
import { api, isAi, useAiMode } from "@/lib/api";
import { atsCheck, contactLine, cvToMarkdown, download, letterToMarkdown, slug } from "@/lib/docs";
import { DIMENSIONS, VERDICT_ADVICE, verdictTone, verifyHost } from "@/lib/framework";
import { heuristicDrafts, heuristicEvaluate } from "@/lib/heuristics";
import { useStore } from "@/lib/store";
import type { CoverLetter, CvDoc, Drafts, Evaluation, Gate, HostCheck, Review } from "@/lib/types";

type StepId = "parse" | "evaluate" | "draft" | "review" | "revise" | "ats";
type StepState = "idle" | "active" | "done" | "skipped" | "error";
const STEPS: { id: StepId; label: string; sub: string; icon: ReactNode }[] = [
  { id: "parse", label: "Parse posting", sub: "Fetch & verify source", icon: <FileSearch className="h-4 w-4" /> },
  { id: "evaluate", label: "Evaluate fit", sub: "Gates + 4 dimensions", icon: <Gauge className="h-4 w-4" /> },
  { id: "draft", label: "Draft", sub: "Tailored CV & letter", icon: <PenLine className="h-4 w-4" /> },
  { id: "review", label: "Reviewer critique", sub: "Fresh-eyes hiring proxy", icon: <SpellCheck2 className="h-4 w-4" /> },
  { id: "revise", label: "Revise", sub: "Apply the fixes", icon: <RefreshCw className="h-4 w-4" /> },
  { id: "ats", label: "ATS check", sub: "Keyword coverage", icon: <ShieldCheck className="h-4 w-4" /> },
];

interface Posting {
  text: string;
  url: string;
  company: string;
  role: string;
  location: string;
}

const EMPTY_POSTING: Posting = { text: "", url: "", company: "", role: "", location: "" };

export default function ApplyPage() {
  return (
    <Suspense fallback={null}>
      <ApplyStudio />
    </Suspense>
  );
}

function ApplyStudio() {
  const params = useSearchParams();
  const { mode, why } = useAiMode();
  const profile = useStore((s) => s.profile);
  const jobs = useStore((s) => s.jobs);
  const applications = useStore((s) => s.applications);
  const createApplication = useStore((s) => s.createApplication);
  const updateApplication = useStore((s) => s.updateApplication);
  const moveApplication = useStore((s) => s.moveApplication);
  const updateJob = useStore((s) => s.updateJob);

  const [source, setSource] = useState<"saved" | "url" | "paste">("paste");
  const [jobKey, setJobKey] = useState<string>("");
  const [posting, setPosting] = useState<Posting>(EMPTY_POSTING);
  const [hostCheck, setHostCheck] = useState<HostCheck | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<StepId, StepState>>({ parse: "idle", evaluate: "idle", draft: "idle", review: "idle", revise: "idle", ats: "idle" });
  const [busy, setBusy] = useState<"evaluate" | "draft" | null>(null);

  const mark = (id: StepId, s: StepState) => setSteps((prev) => ({ ...prev, [id]: s }));

  // Load from ?job= (a saved job) or ?app= (an existing application).
  useEffect(() => {
    const appParam = params.get("app");
    const jobParam = params.get("job");
    if (appParam) {
      const a = applications.find((x) => x.id === appParam);
      if (a) {
        setAppId(a.id);
        setJobKey(a.jobKey ?? "");
        setPosting({ text: a.postingText, url: a.url, company: a.company, role: a.role, location: a.location });
        setHostCheck(a.hostCheck);
        setEvaluation(a.evaluation);
        setDrafts(a.drafts);
        setSteps({
          parse: "done",
          evaluate: a.evaluation ? "done" : "idle",
          draft: a.drafts ? "done" : "idle",
          review: a.drafts?.review ? "done" : a.drafts ? "skipped" : "idle",
          revise: a.drafts?.stage === "final" ? "done" : a.drafts ? "skipped" : "idle",
          ats: a.drafts ? "done" : "idle",
        });
      }
    } else if (jobParam && jobs[jobParam]) {
      const j = jobs[jobParam];
      setSource("saved");
      setJobKey(j.key);
      setPosting({ text: j.description ?? "", url: j.url, company: j.company, role: j.title, location: j.location });
    }
  }, [params]);

  const savedJobs = useMemo(() => Object.values(jobs).filter((j) => j.status !== "expired").sort((a, b) => (b.rank?.overall ?? 0) - (a.rank?.overall ?? 0)), [jobs]);

  const reset = () => {
    setPosting(EMPTY_POSTING);
    setEvaluation(null);
    setDrafts(null);
    setAppId(null);
    setHostCheck(null);
    setJobKey("");
    setSteps({ parse: "idle", evaluate: "idle", draft: "idle", review: "idle", revise: "idle", ats: "idle" });
  };

  // ---------------------------------------------------------------- evaluate
  // AI work for this application, on screen or saved: built-in output shouldn't replace it without asking.
  const hasAiWork = (what: "evaluation" | "drafts"): boolean => {
    const saved = appId ? applications.find((a) => a.id === appId) : undefined;
    return what === "evaluation" ? evaluation?.mode === "ai" || saved?.evaluation?.mode === "ai" || hasAiWork("drafts") : drafts?.mode === "ai" || saved?.drafts?.mode === "ai";
  };

  const evaluate = async () => {
    if (!isAi(mode) && hasAiWork("evaluation") && !window.confirm(`Replace the AI evaluation with a built-in estimate? ${why}`)) return;
    let p = { ...posting };
    const before = { evaluation, drafts };
    setBusy("evaluate");
    setEvaluation(null);
    setDrafts(null);
    setSteps({ parse: "active", evaluate: "idle", draft: "idle", review: "idle", revise: "idle", ats: "idle" });
    try {
      if (!p.text.trim() && p.url.trim()) {
        const f = await api<{ url: string; title: string; company: string; location: string; text: string; active: boolean }>("/api/posting", { url: p.url.trim() });
        if (!f.active) toast.info("This posting may be closed", "LinkedIn shows it is no longer accepting applications.");
        p = { text: f.text, url: f.url, company: p.company || f.company, role: p.role || f.title, location: p.location || f.location };
        setPosting(p);
        if (jobKey) updateJob(jobKey, { description: f.text });
      }
      if (p.text.trim().length < 80) throw new Error("Add the posting text (at least a few sentences), or a URL that can be fetched.");
      const hc = p.url ? verifyHost(p.url) : verifyHost("");
      setHostCheck(hc);
      mark("parse", "done");
      mark("evaluate", "active");

      const ev = isAi(mode)
        ? await api<Evaluation>("/api/apply/evaluate", { profile, posting: p })
        : (await new Promise((r) => setTimeout(r, 700)), heuristicEvaluate(profile, p.text, { company: p.company, role: p.role, location: p.location }));
      setEvaluation(ev);
      mark("evaluate", "done");

      const payload = { company: ev.company || p.company, role: ev.role || p.role, url: p.url, location: ev.location || p.location, postingText: p.text, hostCheck: hc, evaluation: ev, fitScore: ev.overall, deadline: ev.deadline, jobKey: jobKey || null };
      if (appId) updateApplication(appId, payload);
      else setAppId(createApplication({ ...payload, status: "draft", channel: jobKey ? jobs[jobKey]?.source ?? "" : p.url ? hc.host : "Direct" }));
    } catch (e) {
      setSteps((s) => ({ ...s, parse: s.parse === "active" ? "error" : s.parse, evaluate: s.evaluate === "active" ? "error" : s.evaluate }));
      // A failed re-run keeps the previous results on screen.
      setEvaluation(before.evaluation);
      setDrafts(before.drafts);
      toast.error("Evaluation failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  // ---------------------------------------------------------------- draft → review → revise
  const draftAll = async () => {
    if (!evaluation) return;
    const fails = [evaluation.eligibility.verdict === "FAIL" && "eligibility", evaluation.languageGate.verdict === "FAIL" && "language", evaluation.locationGate.verdict === "FAIL" && "location"].filter(Boolean);
    if (fails.length && !window.confirm(`This role failed the ${fails.join(" and ")} gate. The framework says not to draft. Draft anyway?`)) return;
    if (!isAi(mode) && hasAiWork("drafts") && !window.confirm(`Replace the AI draft with a template from the built-in engine? ${why}`)) return;
    setBusy("draft");
    setSteps((s) => ({ ...s, draft: "active", review: "idle", revise: "idle", ats: "idle" }));
    const p = { text: posting.text, url: posting.url || undefined, company: posting.company || evaluation.company, role: posting.role || evaluation.role, location: posting.location || undefined };
    let partial = "";
    try {
      let d: Drafts;
      if (isAi(mode)) {
        const first = await api<{ cv: CvDoc; coverLetter: CoverLetter; changelog: string[] }>("/api/apply/draft", { profile, posting: p, evaluation });
        d = { ...first, review: null, stage: "draft", mode: "ai", updatedAt: new Date().toISOString() };
        setDrafts(d);
        mark("draft", "done");
        try {
          mark("review", "active");
          const review = await api<Review>("/api/apply/review", { profile, posting: p, evaluation, cv: d.cv, coverLetter: d.coverLetter });
          d = { ...d, review, stage: "reviewed" };
          setDrafts(d);
          mark("review", "done");
          mark("revise", "active");
          const revised = await api<{ cv: CvDoc; coverLetter: CoverLetter; changelog: string[] }>("/api/apply/revise", { profile, posting: p, cv: d.cv, coverLetter: d.coverLetter, review });
          d = { ...d, cv: revised.cv, coverLetter: revised.coverLetter, changelog: [...first.changelog, ...revised.changelog], stage: "final", updatedAt: new Date().toISOString() };
          mark("revise", "done");
        } catch (e) {
          // Keep (and save) the AI draft already written; only the later passes are missing.
          setSteps((s) => ({ ...s, review: s.review === "active" ? "error" : s.review, revise: s.revise === "active" ? "error" : s.revise === "idle" ? "skipped" : s.revise }));
          partial = `${d.review ? "The review is saved too; only the revision didn't finish." : "The reviewer pass didn't finish."} ${e instanceof Error ? e.message : String(e)}`;
        }
      } else {
        await new Promise((r) => setTimeout(r, 600));
        d = heuristicDrafts(profile, evaluation);
        mark("draft", "done");
        mark("review", "skipped");
        mark("revise", "skipped");
      }
      mark("ats", "active");
      await new Promise((r) => setTimeout(r, 400));
      setDrafts(d);
      mark("ats", "done");
      if (appId) updateApplication(appId, { drafts: d });
      if (partial) toast.info("AI draft saved", partial);
      else toast.success("Application drafted", isAi(mode) ? "Drafted, reviewed and revised. Read every line before you send it." : `Template drafts ready. ${why}`);
    } catch (e) {
      setSteps((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === "active" ? "error" : v])) as Record<StepId, StepState>);
      toast.error("Drafting stopped", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const app = applications.find((a) => a.id === appId);

  return (
    <div>
      <PageHeader
        eyebrow="Apply"
        icon={<WandSparkles className="h-3 w-3" />}
        title="Apply Studio"
        subtitle="Drafter-reviewer workflow: evaluate fit against your profile, draft a tailored CV and cover letter, let a second pass critique them, revise, then check ATS keyword coverage."
        actions={
          (evaluation || posting.text) && (
            <Button variant="secondary" icon={<X className="h-4 w-4" />} onClick={reset}>
              New application
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Stepper steps={steps} />
        </div>

        <div className="min-w-0 space-y-5">
          {/* Input */}
          <Card>
            <CardHeader title="Job posting" subtitle="Saved job, URL, or pasted text. The posting is treated as untrusted data." icon={<FileText className="h-4 w-4" />} />
            <div className="space-y-4 p-5">
              <Tabs
                layoutId="apply-src"
                value={source}
                onChange={setSource}
                tabs={[
                  { value: "saved", label: "Saved job" },
                  { value: "url", label: "From URL", icon: <Link2 className="h-3.5 w-3.5" /> },
                  { value: "paste", label: "Paste text" },
                ]}
              />
              {source === "saved" && (
                <Select
                  value={jobKey}
                  onChange={(e) => {
                    const j = jobs[e.target.value];
                    setJobKey(e.target.value);
                    if (j) setPosting({ text: j.description ?? "", url: j.url, company: j.company, role: j.title, location: j.location });
                  }}
                  aria-label="Saved job"
                >
                  <option value="">Choose a saved job…</option>
                  {savedJobs.map((j) => (
                    <option key={j.key} value={j.key}>
                      {j.rank ? `[${j.rank.overall}] ` : ""}
                      {j.title} · {j.company}
                    </option>
                  ))}
                </Select>
              )}
              {source === "url" && <Input value={posting.url} onChange={(e) => setPosting({ ...posting, url: e.target.value, text: "" })} placeholder="https://company.greenhouse.io/jobs/123 or a LinkedIn job link" />}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Role">{(id) => <Input id={id} value={posting.role} onChange={(e) => setPosting({ ...posting, role: e.target.value })} placeholder="Detected automatically" />}</Field>
                <Field label="Company">{(id) => <Input id={id} value={posting.company} onChange={(e) => setPosting({ ...posting, company: e.target.value })} placeholder="Detected automatically" />}</Field>
                <Field label="Location">{(id) => <Input id={id} value={posting.location} onChange={(e) => setPosting({ ...posting, location: e.target.value })} />}</Field>
              </div>
              {(source === "paste" || posting.text) && (
                <Textarea value={posting.text} onChange={(e) => setPosting({ ...posting, text: e.target.value })} placeholder="Paste the full job description…" className="min-h-40 text-xs" />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge tone={isAi(mode) ? "good" : "warning"}>{isAi(mode) ? "AI evaluation" : "Built-in evaluation"}</Badge>
                <Button onClick={evaluate} loading={busy === "evaluate"} disabled={!!busy || (!posting.text.trim() && !posting.url.trim())} icon={<Gauge className="h-4 w-4" />}>
                  {evaluation ? "Re-evaluate" : "Evaluate fit"}
                </Button>
              </div>
            </div>
          </Card>

          <AnimatePresence>{evaluation && <EvaluationPanel key="ev" ev={evaluation} host={hostCheck} onDraft={draftAll} drafting={busy === "draft"} hasDrafts={!!drafts} />}</AnimatePresence>

          <AnimatePresence>
            {drafts && evaluation && (
              <DocumentsPanel
                key="docs"
                drafts={drafts}
                evaluation={evaluation}
                onApplied={() => {
                  if (appId) moveApplication(appId, "applied", "Submitted from Apply Studio");
                  toast.success("Marked as applied", "Track it on the Tracker board. Good luck!");
                }}
                applied={!!app && app.status !== "draft"}
                appId={appId}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Stepper with travelling beam

function Stepper({ steps }: { steps: Record<StepId, StepState> }) {
  const doneCount = STEPS.filter((s) => steps[s.id] === "done" || steps[s.id] === "skipped").length;
  const activeIdx = STEPS.findIndex((s) => steps[s.id] === "active");
  const progress = activeIdx >= 0 ? (activeIdx + 0.5) / STEPS.length : doneCount / STEPS.length;
  return (
    <Card className="relative overflow-hidden p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-subtle">Workflow</p>
      <div className="relative">
        <div className="absolute bottom-5 left-[17px] top-5 w-0.5 rounded-full bg-[color-mix(in_oklab,var(--fg)_8%,transparent)]" />
        <motion.div className="absolute left-[17px] top-5 w-0.5 rounded-full bg-gradient-to-b from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)]" animate={{ height: `calc(${progress * 100}% - ${progress * 40}px)` }} transition={{ type: "spring", stiffness: 80, damping: 18 }} />
        {activeIdx >= 0 && (
          <motion.div aria-hidden className="absolute left-[13px] h-3 w-3 rounded-full bg-[var(--brand-3)] shadow-[0_0_14px_4px_var(--brand-3)]" animate={{ top: [`${(activeIdx / STEPS.length) * 100}%`, `${((activeIdx + 0.9) / STEPS.length) * 100}%`] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }} />
        )}
        <ol className="relative space-y-4">
          {STEPS.map((s, i) => {
            const st = steps[s.id];
            return (
              <motion.li key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3">
                <div className="relative grid h-9 w-9 shrink-0 place-items-center">
                  {st === "active" && <span className="absolute inset-0 animate-spin-slow rounded-full bg-[conic-gradient(var(--brand-1),var(--brand-2),var(--brand-3),var(--brand-1))] p-[2px] [mask:radial-gradient(farthest-side,transparent_calc(100%-2px),#000_0)]" />}
                  <motion.div
                    key={st}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full border text-xs",
                      st === "done" && "border-transparent bg-brand-gradient text-white",
                      st === "active" && "border-transparent bg-[var(--card-solid)] text-brand",
                      st === "idle" && "border-line bg-[var(--card-solid)] text-subtle",
                      st === "skipped" && "border-dashed border-line bg-[var(--card-solid)] text-subtle",
                      st === "error" && "border-transparent bg-critical text-white",
                    )}
                  >
                    {st === "done" ? <Check className="h-4 w-4" /> : st === "skipped" ? <CircleDashed className="h-4 w-4" /> : st === "error" ? <X className="h-4 w-4" /> : s.icon}
                  </motion.div>
                </div>
                <div className="min-w-0">
                  <div className={cn("text-sm font-medium", st === "idle" || st === "skipped" ? "text-muted" : "text-fg")}>{s.label}</div>
                  <div className="text-[11px] text-subtle">{st === "skipped" ? "Needs AI mode" : st === "error" ? "Failed, retry" : s.sub}</div>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ Evaluation

function gateTone(v: Gate | "UNVERIFIED"): Tone {
  return v === "PASS" ? "good" : v === "FAIL" ? "critical" : "warning";
}

function EvaluationPanel({ ev, host, onDraft, drafting, hasDrafts }: { ev: Evaluation; host: HostCheck | null; onDraft: () => void; drafting: boolean; hasDrafts: boolean }) {
  const hostTone: Tone = !host || host.category === "pasted" ? "neutral" : host.category === "unverified" ? "warning" : "good";
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", stiffness: 200, damping: 26 }}>
      <Card className="overflow-hidden">
        <div className="relative border-b border-line p-5">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[color-mix(in_oklab,var(--brand-1)_10%,transparent)] to-transparent" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <RadialGauge value={ev.overall} size={112} stroke={9} label="overall" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={verdictTone(ev.verdict)}>{ev.verdict}</Badge>
                {host && (
                  <Badge tone={hostTone} icon={host.category === "unverified" ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}>
                    {host.label}
                    {host.host ? `: ${host.host}` : ""}
                  </Badge>
                )}
                {ev.mode === "heuristic" && <Badge tone="neutral">Built-in</Badge>}
              </div>
              <h2 className="mt-2 font-display text-xl font-bold">
                {ev.role} <span className="text-muted">at</span> {ev.company}
              </h2>
              <p className="text-xs text-muted">
                {[ev.location, ev.department, ev.deadline && `Deadline ${ev.deadline}`, ev.postingLanguage].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-semibold">{VERDICT_ADVICE[ev.verdict]}</span> <span className="text-muted">{ev.recommendation}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Gates */}
        <motion.div variants={stagger(0.08, 0.2)} initial="hidden" animate="show" className="grid grid-cols-1 gap-3 border-b border-line p-5 sm:grid-cols-3">
          {[
            { label: "Eligibility", g: ev.eligibility },
            { label: "Language", g: ev.languageGate },
            { label: "Location", g: ev.locationGate },
          ].map(({ label, g }) => (
            <motion.div key={label} variants={fadeUp} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{label} gate</span>
                <Badge tone={gateTone(g.verdict)}>{g.verdict}</Badge>
              </div>
              {g.note && <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{g.note}</p>}
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[minmax(0,300px)_1fr]">
          <div className="grid place-items-center">
            <RadarChart axes={DIMENSIONS.map((d) => ({ label: d.short, value: ev[d.key].score }))} />
          </div>
          <div className="space-y-3">
            {DIMENSIONS.map((d, i) => (
              <motion.div key={d.key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{d.label}</span>
                  <span className="tabular-nums text-muted">
                    <b className="text-fg">{ev[d.key].score}</b>/100
                  </span>
                </div>
                {ev[d.key].note && <p className="mt-1 text-[11px] leading-relaxed text-muted">{ev[d.key].note}</p>}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 border-t border-line p-5 md:grid-cols-2">
          <ListBlock title="Key strengths for this role" items={ev.strengths} tone="good" />
          <ListBlock title="Gaps to address" items={ev.gaps} tone="serious" />
        </div>

        {ev.requirements.length > 0 && (
          <div className="border-t border-line p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">Requirement coverage</p>
            <motion.ul variants={stagger(0.04)} initial="hidden" animate="show" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ev.requirements.map((r) => (
                <motion.li key={r.requirement} variants={fadeUp} className="flex gap-2.5 rounded-xl border border-line p-2.5 text-xs">
                  <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-white", r.status === "match" ? "bg-good" : r.status === "partial" ? "bg-warning" : "bg-critical")} aria-label={r.status}>
                    {r.status === "match" ? <Check className="h-3 w-3" /> : r.status === "partial" ? "~" : <X className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium text-fg">{r.requirement}</span>
                    <span className="block text-muted">{r.evidence}</span>
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        )}

        {ev.callQuestions.length > 0 && (
          <div className="border-t border-line p-5 text-xs">
            <p className="mb-2 font-semibold">Worth calling the contact about</p>
            <ul className="space-y-1 text-muted">
              {ev.callQuestions.map((q) => (
                <li key={q}>• {q}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-[color-mix(in_oklab,var(--bg-elev)_50%,transparent)] p-5">
          <p className="text-sm font-medium">Proceed with drafting the CV and cover letter for this role?</p>
          <Button onClick={onDraft} loading={drafting} size="lg" icon={<Sparkles className="h-4 w-4" />}>
            {hasDrafts ? "Redraft" : "Draft application"}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone: "good" | "serious" }) {
  return (
    <div>
      <p className={cn("mb-2 text-xs font-semibold", tone === "good" ? "text-good-text" : "text-serious")}>{title}</p>
      <ul className="space-y-1.5 text-xs text-muted">
        {items.length ? (
          items.map((s, i) => (
            <motion.li key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.06 }} className="flex gap-2">
              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone === "good" ? "bg-good" : "bg-serious")} />
              {s}
            </motion.li>
          ))
        ) : (
          <li>None</li>
        )}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ Documents

function DocumentsPanel({ drafts, evaluation, onApplied, applied, appId }: { drafts: Drafts; evaluation: Evaluation; onApplied: () => void; applied: boolean; appId: string | null }) {
  const profile = useStore((s) => s.profile);
  const [tab, setTab] = useState<"cv" | "letter" | "review" | "ats">("cv");
  const ats = useMemo(() => atsCheck(profile, drafts.cv, evaluation.keywords), [profile, drafts.cv, evaluation.keywords]);
  const base = `${slug(evaluation.company)}_${slug(evaluation.role)}`;

  const md = tab === "letter" ? letterToMarkdown(profile, drafts.coverLetter) : cvToMarkdown(profile, drafts.cv);
  const print = () => {
    document.getElementById(tab === "letter" ? "doc-letter" : "doc-cv")?.classList.add("print-area");
    window.print();
    setTimeout(() => document.querySelectorAll(".print-area").forEach((n) => n.classList.remove("print-area")), 500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 160, damping: 24 }} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          layoutId="doc-tab"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "cv", label: "CV", icon: <FileText className="h-4 w-4" /> },
            { value: "letter", label: "Cover letter", icon: <Mail className="h-4 w-4" /> },
            { value: "review", label: "Review", icon: <SpellCheck2 className="h-4 w-4" /> },
            { value: "ats", label: `ATS ${ats.coverage}%`, icon: <ShieldCheck className="h-4 w-4" /> },
          ]}
        />
        <div className="no-print flex flex-wrap gap-2">
          {(tab === "cv" || tab === "letter") && (
            <>
              <Button size="sm" variant="secondary" icon={<Printer className="h-3.5 w-3.5" />} onClick={print}>
                PDF
              </Button>
              <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => download(`${tab === "cv" ? "cv" : "cover"}_${base}.md`, md)}>
                .md
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<ClipboardCopy className="h-3.5 w-3.5" />}
                onClick={() => navigator.clipboard.writeText(md.replace(/[#*]/g, "")).then(() => toast.success("Copied as plain text"))}
              >
                Copy
              </Button>
            </>
          )}
          {applied ? (
            appId && (
              <Link href={`/interview?app=${appId}`}>
                <Button size="sm" icon={<MessagesSquare className="h-3.5 w-3.5" />}>
                  Prep interview
                </Button>
              </Link>
            )
          ) : (
            <Button size="sm" icon={<Send className="h-3.5 w-3.5" />} onClick={onApplied}>
              Mark as applied
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 30, rotateX: 10 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -20, rotateX: -6 }} transition={{ type: "spring", stiffness: 220, damping: 26 }} style={{ transformPerspective: 1600, transformOrigin: "top center" }}>
          {tab === "cv" && <CvPaper cv={drafts.cv} />}
          {tab === "letter" && <LetterPaper letter={drafts.coverLetter} />}
          {tab === "review" && <ReviewView drafts={drafts} />}
          {tab === "ats" && <AtsView ats={ats} />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function Paper({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="mx-auto max-w-[820px] rounded-xl bg-white px-6 py-8 text-[13px] leading-relaxed text-slate-800 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] ring-1 ring-black/5 sm:px-12 sm:py-12">
      {children}
    </div>
  );
}

function CvPaper({ cv }: { cv: CvDoc }) {
  const profile = useStore((s) => s.profile);
  const H = ({ children }: { children: ReactNode }) => <h3 className="mb-2 mt-6 border-b-2 border-violet-600 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">{children}</h3>;
  return (
    <Paper id="doc-cv">
      <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">{profile.name || "Your Name"}</h1>
      <p className="mt-0.5 font-semibold text-violet-700">{cv.headline}</p>
      <p className="mt-1 text-xs text-slate-500">{contactLine(profile)}</p>
      <H>Profile</H>
      <p>{cv.summary}</p>
      {cv.skillGroups.length > 0 && (
        <>
          <H>Skills</H>
          <dl className="space-y-1">
            {cv.skillGroups.map((g) => (
              <div key={g.group} className="grid grid-cols-1 gap-x-3 sm:grid-cols-[150px_1fr]">
                <dt className="font-semibold text-slate-900">{g.group}</dt>
                <dd>{g.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {cv.experience.length > 0 && (
        <>
          <H>Experience</H>
          <div className="space-y-4">
            {cv.experience.map((e, i) => (
              <motion.div key={`${e.company}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="break-inside-avoid">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold text-slate-900">
                    {e.title}, <span className="font-normal">{e.company}</span>
                  </p>
                  <p className="text-xs text-slate-500">{[e.location, e.period].filter(Boolean).join(" · ")}</p>
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {e.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </>
      )}
      {cv.education.length > 0 && (
        <>
          <H>Education</H>
          {cv.education.map((e) => (
            <p key={e.degree + e.institution}>
              <b className="text-slate-900">{e.degree}</b>, {e.institution} ({e.year}){e.details ? `. ${e.details}` : ""}
            </p>
          ))}
        </>
      )}
      {(cv.certifications.length > 0 || cv.languages.length > 0) && (
        <>
          <H>Certifications & languages</H>
          {cv.certifications.length > 0 && <p>{cv.certifications.join(" · ")}</p>}
          {cv.languages.length > 0 && <p className="mt-1">{cv.languages.join(" · ")}</p>}
        </>
      )}
    </Paper>
  );
}

function LetterPaper({ letter }: { letter: CoverLetter }) {
  const profile = useStore((s) => s.profile);
  return (
    <Paper id="doc-letter">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="font-display text-2xl font-bold text-slate-900">{profile.name || "Your Name"}</p>
          <p className="text-xs text-slate-500">{contactLine(profile)}</p>
        </div>
        <p className="text-xs text-slate-500">{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <p className="mt-6 font-display text-base font-semibold text-violet-700">{letter.subject}</p>
      <p className="mt-4">{letter.greeting}</p>
      <div className="mt-3 space-y-3">
        {letter.paragraphs.slice(0, 1).map((p) => (
          <p key={p}>{p}</p>
        ))}
        {letter.bullets.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">
            {letter.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        {letter.paragraphs.slice(1).map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <p className="mt-6">{letter.closing}</p>
      <p className="mt-1 font-semibold text-slate-900">{letter.signature}</p>
    </Paper>
  );
}

function ReviewView({ drafts }: { drafts: Drafts }) {
  const r = drafts.review;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5 lg:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Reviewer impression</p>
        <p className="mt-2 text-sm">{r ? r.impression : "No reviewer pass yet. Redraft while AI is available to run the drafter-reviewer loop."}</p>
      </Card>
      {r && (
        <>
          <Card className="p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">Issues found ({r.issues.length})</p>
            <ul className="space-y-2">
              {r.issues.map((i, n) => (
                <motion.li key={n} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: n * 0.05 }} className="rounded-xl border border-line p-3 text-xs">
                  <div className="mb-1 flex gap-1.5">
                    <Badge tone={i.severity === "high" ? "critical" : i.severity === "medium" ? "serious" : "neutral"}>{i.severity}</Badge>
                    <Badge tone="neutral" icon={false}>
                      {i.document === "cv" ? "CV" : "Cover letter"}
                    </Badge>
                  </div>
                  <p className="text-fg">{i.issue}</p>
                  <p className="mt-1 text-muted">Fix: {i.fix}</p>
                </motion.li>
              ))}
            </ul>
          </Card>
          <div className="space-y-4">
            <Card className="p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Stretch flags</p>
              {r.stretchFlags.length ? (
                <ul className="space-y-2 text-xs">
                  {r.stretchFlags.map((f) => (
                    <li key={f.claim} className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_45%,transparent)] p-2.5">
                      <p className="text-fg">“{f.claim}”</p>
                      <p className="mt-1 text-muted">{f.why}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No claims failed the interview backtrack test.</p>
              )}
            </Card>
            <Card className="p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">What changed in revision</p>
              <ul className="space-y-1 text-xs text-muted">
                {drafts.changelog.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function AtsView({ ats }: { ats: ReturnType<typeof atsCheck> }) {
  return (
    <Card className="p-5">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <RadialGauge value={ats.coverage} size={120} stroke={10} label="coverage" />
        <div className="flex-1 space-y-4 text-xs">
          <div className="flex flex-wrap gap-2">
            {(["name", "email", "phone"] as const).map((k) => (
              <Badge key={k} tone={ats.contactOk[k] ? "good" : "critical"}>
                {k} {ats.contactOk[k] ? "present" : "missing"}
              </Badge>
            ))}
          </div>
          <div>
            <p className="mb-2 font-semibold">Found in your CV ({ats.found.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {ats.found.map((k, i) => (
                <motion.span key={k} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.03, type: "spring", stiffness: 500, damping: 20 }}>
                  <Badge tone="good">{k}</Badge>
                </motion.span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold">Not found ({ats.missing.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {ats.missing.map((k) => (
                <Badge key={k} tone="neutral" icon={false}>
                  {k}
                </Badge>
              ))}
            </div>
            <p className="mt-3 leading-relaxed text-muted">Honesty rule: add a missing keyword only if your profile genuinely supports it. A real gap stays visible, never stuffed in. Plain-text CV export keeps the text layer ATS-readable.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
