"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { ChevronDown, Crown, ExternalLink, Flame, Hourglass, Play, RotateCcw, Trash2, TriangleAlert, Trophy, WandSparkles, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, PageHeader, RadialGauge, scoreColor } from "@/components/motion/effects";
import { toast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn, Select, Switch } from "@/components/ui/primitives";
import { api, ApiError, isAi, useAiMode } from "@/lib/api";
import { daysSince, daysUntil, DIMENSIONS, today, verdictTone } from "@/lib/framework";
import { heuristicRank } from "@/lib/heuristics";
import { useStore } from "@/lib/store";
import type { Job, RankResult } from "@/lib/types";

interface RankResponse {
  results: { key: string; expired: boolean; rank?: RankResult; description: string | null }[];
}

function flags(j: Job) {
  const out: { icon: React.ReactNode; text: string; tone: "warning" | "serious" }[] = [];
  const r = j.rank;
  if (!r) return out;
  const dl = daysUntil(r.deadline);
  if (dl !== null && dl >= 0 && dl <= 7) out.push({ icon: <Flame className="h-3 w-3" />, text: dl === 0 ? "Closes today" : `Closes in ${dl}d`, tone: "serious" });
  if (r.locationVerdict === "FLAG") out.push({ icon: <TriangleAlert className="h-3 w-3" />, text: "Location flag", tone: "warning" });
  if (r.languageGate === "FLAG") out.push({ icon: <TriangleAlert className="h-3 w-3" />, text: "Language bar", tone: "warning" });
  const age = daysSince(j.postedDate);
  if (age !== null && age > 30) out.push({ icon: <Hourglass className="h-3 w-3" />, text: `Posted ${Math.round(age / 30)} mo ago`, tone: "warning" });
  return out;
}

export default function RankPage() {
  const { mode, why } = useAiMode();
  const jobsMap = useStore((s) => s.jobs);
  const profile = useStore((s) => s.profile);
  const setRank = useStore((s) => s.setRank);
  const updateJob = useStore((s) => s.updateJob);
  const removeJob = useStore((s) => s.removeJob);
  const [all, setAll] = useState(false);
  const [limit, setLimit] = useState(10);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [open, setOpen] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);

  const jobs = useMemo(() => Object.values(jobsMap), [jobsMap]);
  const candidates = jobs.filter((j) => (all ? j.status !== "applied" : j.status === "new"));

  const ranked = jobs
    .filter((j) => j.rank && j.status !== "expired" && j.rank.locationVerdict !== "FAIL" && j.rank.languageGate !== "FAIL")
    .sort((a, b) => {
      const d = (b.rank?.overall ?? 0) - (a.rank?.overall ?? 0);
      if (d !== 0) return d;
      const ua = daysUntil(a.rank?.deadline) ?? 999;
      const ub = daysUntil(b.rank?.deadline) ?? 999;
      return ua - ub; // urgency wins ties
    });
  const shortlist = ranked.filter((j) => (j.rank?.overall ?? 0) >= 45);
  const below = ranked.filter((j) => (j.rank?.overall ?? 0) < 45);
  const excluded = jobs.filter((j) => j.status === "expired" || j.rank?.locationVerdict === "FAIL" || j.rank?.languageGate === "FAIL");

  const sweep = () => {
    let expired = 0;
    for (const j of jobs) {
      const d = daysUntil(j.rank?.deadline);
      if (j.status === "ranked" && d !== null && d < 0) {
        updateJob(j.key, { status: "expired" });
        expired++;
      }
    }
    return expired;
  };

  const run = async () => {
    if (!profile.name && !profile.skills.strong.length) return toast.error("Profile first", "Ranking scores jobs against your profile. Fill it in, or load sample data from the dashboard.");
    const batch = candidates.slice(0, limit);
    if (!batch.length) {
      const n = sweep();
      return toast.info("Nothing new to rank", n ? `Swept ${n} past-deadline job(s) to expired.` : "Search for more jobs, or turn on re-rank all.");
    }
    setRunning(true);
    setProgress({ done: 0, total: batch.length });
    let failed = 0;
    let builtIn = 0;
    let keptAi = 0;
    // The built-in engine never overwrites an AI score; it only fills jobs without one.
    const builtInRank = (j: Job) => {
      if (j.rank?.mode === "ai") keptAi++;
      else {
        setRank(j.key, heuristicRank(profile, j));
        if (isAi(mode)) builtIn++;
      }
    };
    try {
      if (isAi(mode)) {
        for (let i = 0; i < batch.length; i += 5) {
          const chunk = batch.slice(i, i + 5);
          try {
            const r = await api<RankResponse>("/api/rank", { profile, jobs: chunk.map((j) => ({ key: j.key, title: j.title, company: j.company, location: j.location, url: j.url, description: j.description })) });
            for (const res of r.results) {
              if (res.description && !jobsMap[res.key]?.description) updateJob(res.key, { description: res.description });
              if (res.expired) updateJob(res.key, { status: "expired" });
              else if (res.rank) setRank(res.key, res.rank);
              else failed++;
            }
          } catch (e) {
            if (e instanceof ApiError && (e.code === "AI_UNAVAILABLE" || e.code === "BILLING")) {
              // This browser just switched to the built-in engine: finish the run with it rather than failing every batch left.
              batch.slice(i).forEach(builtInRank);
              toast.info("AI is busy, finished with the built-in engine", e.message);
              setProgress({ done: batch.length, total: batch.length });
              break;
            }
            failed += chunk.length;
            toast.error("A batch failed", e instanceof Error ? e.message : String(e));
          }
          setProgress({ done: Math.min(batch.length, i + 5), total: batch.length });
        }
      } else {
        for (let i = 0; i < batch.length; i++) {
          await new Promise((r) => setTimeout(r, 220));
          builtInRank(batch[i]);
          setProgress({ done: i + 1, total: batch.length });
        }
      }
      const swept = sweep();
      const deferred = candidates.length - batch.length;
      const ranked = batch.length - failed - keptAi;
      toast.success(`Ranked ${ranked} job${ranked === 1 ? "" : "s"}`, [swept && `${swept} expired by deadline.`, deferred > 0 && `${deferred} deferred to the next run.`, builtIn > 0 && `${builtIn} scored by the built-in engine.`, keptAi > 0 && `Kept ${keptAi} existing AI score${keptAi === 1 ? "" : "s"}.`, !isAi(mode) && `Built-in triage. ${why}`].filter(Boolean).join(" ") || undefined);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Rank"
        icon={<Trophy className="h-3 w-3" />}
        title="Rank and shortlist"
        subtitle="Triage scores from the posting text only, using the five-dimension fit framework. Deal-breakers veto, deadlines add urgency. The Apply Studio always re-evaluates in depth before drafting."
        actions={
          <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-2 pl-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              <Switch checked={all} onChange={setAll} label="Re-rank all" /> Re-rank all
            </label>
            <Select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="h-9 w-24 text-xs" aria-label="Limit">
              {[5, 10, 20, 40].map((n) => (
                <option key={n} value={n}>
                  {n} jobs
                </option>
              ))}
            </Select>
            <Button onClick={run} loading={running} icon={all ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}>
              {candidates.length ? `Rank ${Math.min(limit, candidates.length)} ${all ? "again" : "new"}` : all ? "Re-rank" : "Rank new"}
            </Button>
          </div>
        }
      />

      <AnimatePresence>
        {running && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
            <Card className="p-4">
              <div className="mb-2 flex justify-between text-xs">
                <span className="font-medium">Scoring postings against your profile…</span>
                <span className="tabular-nums text-muted">
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-brand-soft">
                <motion.div className="h-full rounded-full bg-brand-gradient bg-[length:200%_100%] animate-gradient" animate={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-7 w-7" />}
          title="No jobs to rank yet"
          body="Save postings from Job Search, or add one manually, then come back to score them all at once."
          action={
            <Link href="/search">
              <Button>Find jobs</Button>
            </Link>
          }
        />
      ) : (
        <LayoutGroup>
          {shortlist.length >= 3 && <Podium jobs={shortlist.slice(0, 3)} />}

          <Card className="mt-5">
            <CardHeader title={`Shortlist · ${shortlist.length}`} subtitle="Moderate fit (45) and above, sorted by score, urgency breaks ties" icon={<Crown className="h-4 w-4" />} action={candidates.length > 0 && !running ? <Badge tone="brand">{candidates.length} unranked</Badge> : undefined} />
            <ul className="divide-y divide-[var(--card-border)]">
              <AnimatePresence initial={false}>
                {shortlist.map((j, i) => (
                  <RankRow key={j.key} job={j} index={i} open={open === j.key} onToggle={() => setOpen(open === j.key ? null : j.key)} onRemove={() => removeJob(j.key)} />
                ))}
              </AnimatePresence>
              {shortlist.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted">No shortlisted jobs yet. Rank your saved postings.</li>}
            </ul>
          </Card>

          {below.length > 0 && (
            <Card className="mt-5">
              <CardHeader title={`Below threshold · ${below.length}`} subtitle="Weak or poor fit: probably skip unless there is a strategic reason" />
              <ul className="divide-y divide-[var(--card-border)]">
                {below.map((j, i) => (
                  <RankRow key={j.key} job={j} index={shortlist.length + i} open={open === j.key} onToggle={() => setOpen(open === j.key ? null : j.key)} onRemove={() => removeJob(j.key)} muted />
                ))}
              </ul>
            </Card>
          )}

          {excluded.length > 0 && (
            <Card className="mt-5">
              <button onClick={() => setShowExcluded((s) => !s)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <XCircle className="h-4 w-4 text-critical" /> Excluded · {excluded.length}
                </span>
                <motion.span animate={{ rotate: showExcluded ? 180 : 0 }}>
                  <ChevronDown className="h-4 w-4 text-subtle" />
                </motion.span>
              </button>
              <AnimatePresence>
                {showExcluded && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line">
                    {excluded.map((j) => (
                      <li key={j.key} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                        <span className="font-medium">{j.title}</span>
                        <span className="text-muted">at {j.company}</span>
                        <Badge tone="critical">{j.status === "expired" ? "Expired / unreachable" : j.rank?.locationVerdict === "FAIL" ? "Location deal-breaker" : "Language requirement"}</Badge>
                        {j.rank?.languageNote && <span className="text-xs text-subtle">{j.rank.languageNote}</span>}
                        <button onClick={() => removeJob(j.key)} className="ml-auto text-xs text-subtle hover:text-critical">
                          Remove
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </Card>
          )}
          <p className="mt-4 text-center text-[11px] text-subtle">Triage scores only: the Apply Studio re-runs a full evaluation before anything is drafted. Last sweep {today()}.</p>
        </LayoutGroup>
      )}
    </div>
  );
}

function Podium({ jobs }: { jobs: Job[] }) {
  const order = [jobs[1], jobs[0], jobs[2]];
  const heights = [120, 160, 96];
  const medals = ["2", "1", "3"];
  return (
    <div className="glass relative overflow-hidden rounded-3xl px-4 pb-0 pt-6">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[color-mix(in_oklab,var(--brand-1)_18%,transparent)] to-transparent" />
      <div className="relative grid grid-cols-3 items-end gap-3 sm:gap-6">
        {order.map((j, i) => (
          <motion.div key={j.key} layout className="flex min-w-0 flex-col items-center text-center">
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.6 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.5 + i * 0.12, type: "spring", stiffness: 260, damping: 18 }}>
              <RadialGauge value={j.rank?.overall ?? 0} size={i === 1 ? 84 : 66} stroke={i === 1 ? 7 : 6} delay={0.6} />
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 + i * 0.1 }} className="mt-2 w-full px-1">
              <div className="truncate text-xs font-semibold sm:text-sm">{j.title}</div>
              <div className="truncate text-[11px] text-muted">{j.company}</div>
            </motion.div>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: heights[i] }}
              transition={{ delay: 0.15 * i, type: "spring", stiffness: 90, damping: 16 }}
              className={cn("mt-3 grid w-full place-items-start justify-center rounded-t-2xl pt-3 font-display text-2xl font-bold text-white", i === 1 ? "bg-brand-gradient" : "bg-[color-mix(in_oklab,var(--brand-1)_45%,var(--bg-elev))]")}
            >
              {medals[i]}
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RankRow({ job: j, index, open, onToggle, onRemove, muted }: { job: Job; index: number; open: boolean; onToggle: () => void; onRemove: () => void; muted?: boolean }) {
  const r = j.rank!;
  const f = flags(j);
  return (
    <motion.li layout="position" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className={cn(muted && "opacity-75")}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-soft sm:gap-4 sm:px-5" aria-expanded={open}>
        <span className="w-5 text-center font-display text-sm font-bold tabular-nums text-subtle">{index + 1}</span>
        <RadialGauge value={r.overall} size={48} stroke={5} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{j.title}</span>
            {f.map((x) => (
              <Badge key={x.text} tone={x.tone} icon={x.icon}>
                {x.text}
              </Badge>
            ))}
          </div>
          <div className="truncate text-xs text-muted">
            {j.company} · {j.location || "—"}
          </div>
        </div>
        <Badge tone={verdictTone(r.verdict)} className="hidden sm:inline-flex">
          {r.verdict}
        </Badge>
        {r.mode === "heuristic" && <span className="hidden text-[10px] uppercase tracking-wide text-subtle lg:inline">heuristic</span>}
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="h-4 w-4 text-subtle" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid grid-cols-1 gap-5 border-t border-line bg-[color-mix(in_oklab,var(--bg-elev)_50%,transparent)] px-5 py-4 md:grid-cols-3">
              <div className="space-y-2.5">
                {DIMENSIONS.map((d, i) => (
                  <div key={d.key}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted">{d.label}</span>
                      <span className="font-semibold tabular-nums">{r.scores[d.key]}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--fg)_8%,transparent)]">
                      <motion.div className="h-full rounded-full" style={{ background: scoreColor(r.scores[d.key]) }} initial={{ width: 0 }} animate={{ width: `${r.scores[d.key]}%` }} transition={{ delay: i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs">
                <p className="mb-1.5 font-semibold text-good-text">Strengths</p>
                <ul className="space-y-1 text-muted">
                  {r.strengths.map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
                <p className="mb-1.5 mt-3 font-semibold text-serious">Gaps</p>
                <ul className="space-y-1 text-muted">
                  {r.gaps.length ? r.gaps.map((s) => <li key={s}>• {s}</li>) : <li>None recorded</li>}
                </ul>
              </div>
              <div className="flex flex-col gap-2 text-xs">
                {r.languageNote && <p className="rounded-lg border border-line p-2 text-muted">⚠ {r.languageNote}</p>}
                {r.deadline && <p className="text-muted">Deadline: {r.deadline}</p>}
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link href={`/apply?job=${encodeURIComponent(j.key)}`}>
                    <Button size="sm" icon={<WandSparkles className="h-3.5 w-3.5" />}>
                      Apply
                    </Button>
                  </Link>
                  {j.url && (
                    <a href={j.url} target="_blank" rel="noopener noreferrer nofollow">
                      <Button size="sm" variant="secondary" icon={<ExternalLink className="h-3.5 w-3.5" />}>
                        Posting
                      </Button>
                    </a>
                  )}
                  <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={onRemove}>
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
