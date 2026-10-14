"use client";

import { motion } from "framer-motion";
import { BookOpen, ExternalLink, Flag, GraduationCap, Play, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, PageHeader } from "@/components/motion/effects";
import { toast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn } from "@/components/ui/primitives";
import { api, isAi, useAiMode } from "@/lib/api";
import { heuristicUpskill } from "@/lib/heuristics";
import { useStore } from "@/lib/store";
import type { SkillGap, UpskillReport } from "@/lib/types";

// Sequential (one hue, light -> dark) ramp for demand. Text flips to white on the dark steps.
const RAMP = ["var(--seq-250)", "var(--seq-350)", "var(--seq-450)", "var(--seq-550)", "var(--seq-650)"];
const rampIndex = (demand: number) => Math.min(4, Math.floor(demand / 20));

const LEVEL_LABEL: Record<SkillGap["currentLevel"], string> = { none: "Not yet", basic: "Basic", working: "Working", strong: "Strong" };

export default function UpskillPage() {
  const { mode } = useAiMode();
  const profile = useStore((s) => s.profile);
  const jobs = useStore((s) => s.jobs);
  const applications = useStore((s) => s.applications);
  const report = useStore((s) => s.upskill);
  const setUpskill = useStore((s) => s.setUpskill);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const sources = useMemo(() => {
    const ranked = Object.values(jobs).filter((j) => (j.rank?.overall ?? 0) >= 45);
    return [
      ...applications.map((a) => ({ label: `${a.role} @ ${a.company}`, score: a.fitScore, gaps: a.evaluation?.gaps ?? [], excerpt: a.postingText.slice(0, 2500) })),
      ...ranked
        .filter((j) => !applications.some((a) => a.company.toLowerCase() === j.company.toLowerCase() && a.role.toLowerCase() === j.title.toLowerCase()))
        .map((j) => ({ label: `${j.title} @ ${j.company}`, score: j.rank?.overall ?? null, gaps: j.rank?.gaps ?? [], excerpt: (j.description ?? "").slice(0, 2500) })),
    ].slice(0, 40);
  }, [jobs, applications]);

  const run = async () => {
    if (!sources.length) return toast.error("Nothing to analyse", "Rank some jobs or track applications first.");
    setBusy(true);
    try {
      let r: UpskillReport;
      if (isAi(mode)) {
        const out = await api<Omit<UpskillReport, "sourceCount" | "mode" | "createdAt">>("/api/upskill", { profile, sources });
        r = { ...out, gaps: out.gaps.map((g) => ({ ...g, demand: Math.max(0, Math.min(100, Math.round(g.demand))) })), sourceCount: sources.length, mode: "ai", createdAt: new Date().toISOString() };
      } else {
        await new Promise((res) => setTimeout(res, 500));
        r = heuristicUpskill(profile, sources);
      }
      setUpskill(r);
      toast.success("Learning plan ready", `${r.gaps.length} gaps across ${r.sourceCount} postings.`);
    } catch (e) {
      toast.error("Analysis failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const gaps = [...(report?.gaps ?? [])].sort((a, b) => b.demand - a.demand);
  const cols = 4;

  return (
    <div>
      <PageHeader
        eyebrow="Upskill"
        icon={<GraduationCap className="h-3 w-3" />}
        title="Close the gaps"
        subtitle="Compares your profile against the jobs you are targeting. Poorly matched roles weigh more, recorded gaps beat inferred ones, and the plan names real, well-known resources."
        actions={
          <Button onClick={run} loading={busy} icon={<Play className="h-4 w-4" />}>
            {report ? "Re-analyse" : "Analyse"} {sources.length} posting{sources.length === 1 ? "" : "s"}
          </Button>
        }
      />

      {!report ? (
        <EmptyState
          icon={<GraduationCap className="h-7 w-7" />}
          title="No analysis yet"
          body={sources.length ? `Ready to analyse ${sources.length} ranked or tracked postings.` : "Rank jobs or track applications first; the analysis uses their recorded gaps."}
          action={
            sources.length ? (
              <Button onClick={run} loading={busy}>
                Analyse now
              </Button>
            ) : (
              <Link href="/rank">
                <Button>Go to ranking</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="relative overflow-hidden p-5">
              <div aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand-gradient" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand" icon={<Sparkles className="h-3 w-3" />}>
                  {report.sourceCount} postings analysed
                </Badge>
                {report.mode === "heuristic" && <Badge tone="warning">Built-in</Badge>}
                <span className="text-[11px] text-subtle">{new Date(report.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed">{report.summary}</p>
            </Card>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_1fr]">
            <Card>
              <CardHeader title="Skill gap heatmap" subtitle="Darker = asked for more often across your target jobs" icon={<Flag className="h-4 w-4" />} />
              <div className="p-5">
                {gaps.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">No gaps detected. Your profile covers what these postings ask for.</p>
                ) : (
                  <>
                    <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                      {gaps.map((g, i) => {
                        const ri = rampIndex(g.demand);
                        const row = Math.floor(i / cols);
                        const col = i % cols;
                        return (
                          <motion.button
                            key={g.skill}
                            initial={{ opacity: 0, scale: 0.4, rotateX: 60 }}
                            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                            transition={{ delay: (row + col) * 0.07, type: "spring", stiffness: 260, damping: 20 }}
                            whileHover={{ scale: 1.06, zIndex: 10 }}
                            onPointerEnter={() => setHover(g.skill)}
                            onPointerLeave={() => setHover(null)}
                            onFocus={() => setHover(g.skill)}
                            className={cn("relative flex aspect-[4/3] flex-col justify-between rounded-[6px] p-2 text-left", ri >= 2 ? "text-white" : "text-slate-900")}
                            style={{ background: RAMP[ri], transformPerspective: 600 }}
                            aria-label={`${g.skill}: demand ${g.demand}, your level ${LEVEL_LABEL[g.currentLevel]}`}
                          >
                            <span className="line-clamp-2 text-[11px] font-semibold leading-tight">{g.skill}</span>
                            <span className="flex items-end justify-between text-[10px]">
                              <span className="font-bold tabular-nums">{g.demand}</span>
                              <span className="opacity-80">P{g.priority}</span>
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-[var(--chart-muted)]">
                      Low demand
                      <div className="flex h-2 flex-1 overflow-hidden rounded-full">
                        {RAMP.map((c) => (
                          <span key={c} className="flex-1" style={{ background: c }} />
                        ))}
                      </div>
                      High demand
                    </div>
                    <div className="mt-4 min-h-16 rounded-xl border border-line p-3 text-xs">
                      {hover ? (
                        (() => {
                          const g = gaps.find((x) => x.skill === hover)!;
                          return (
                            <>
                              <p className="font-semibold">
                                {g.skill} <span className="font-normal text-muted">· {g.category} · your level: {LEVEL_LABEL[g.currentLevel]} · priority {g.priority}</span>
                              </p>
                              <p className="mt-1 text-muted">Asked for by: {g.evidence.join("; ") || "—"}</p>
                            </>
                          );
                        })()
                      ) : (
                        <p className="text-subtle">Hover or focus a tile to see which postings asked for it.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Quick wins" subtitle="Things you may already have but have not written down" icon={<Zap className="h-4 w-4" />} />
              <ul className="space-y-2 p-5">
                {report.quickWins.map((q, i) => (
                  <motion.li key={q} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }} className="flex gap-3 rounded-xl border border-line p-3 text-xs">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white">
                      <Zap className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-muted">{q}</span>
                  </motion.li>
                ))}
                {report.quickWins.length === 0 && <li className="text-xs text-muted">None found.</li>}
              </ul>
              <div className="px-5 pb-5">
                <Link href="/profile">
                  <Button size="sm" variant="secondary">
                    Update profile skills
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {report.plan.length > 0 && <LearningPath plan={report.plan} />}
        </div>
      )}
    </div>
  );
}

function LearningPath({ plan }: { plan: UpskillReport["plan"] }) {
  const totalWeeks = plan.reduce((s, p) => s + p.weeks, 0);
  return (
    <Card>
      <CardHeader title="Learning path" subtitle={`${plan.length} phases · about ${totalWeeks} weeks`} icon={<BookOpen className="h-4 w-4" />} />
      <div className="relative p-5 sm:p-8">
        <motion.div
          aria-hidden
          className="absolute bottom-8 left-[39px] top-8 w-1 origin-top rounded-full bg-gradient-to-b from-[var(--brand-1)] via-[var(--brand-2)] to-[var(--brand-3)] sm:left-1/2 sm:-translate-x-1/2"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        />
        <ol className="relative space-y-8">
          {plan.map((p, i) => {
            const left = i % 2 === 0;
            return (
              <motion.li key={p.phase + i} initial={{ opacity: 0, x: left ? -40 : 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ type: "spring", stiffness: 160, damping: 22, delay: 0.1 }} className={cn("relative pl-14 sm:w-1/2 sm:pl-0", left ? "sm:pr-10" : "sm:ml-auto sm:pl-10")}>
                <span className={cn("absolute left-[22px] top-3 grid h-9 w-9 place-items-center rounded-full bg-brand-gradient font-display text-sm font-bold text-white shadow-[0_0_0_6px_var(--bg)] sm:top-3", left ? "sm:left-auto sm:-right-[18px]" : "sm:-left-[18px]")}>{i + 1}</span>
                <div className="rounded-2xl border border-line bg-[var(--card-solid)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display font-semibold">{p.phase}</h3>
                    <Badge tone="brand" icon={false}>
                      {p.weeks} week{p.weeks === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{p.focus}</p>
                  {p.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.skills.map((s) => (
                        <Badge key={s} tone="info" icon={false}>
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <ul className="mt-3 space-y-1.5">
                    {p.resources.map((r) => (
                      <li key={r.title} className="flex items-start gap-2 text-xs">
                        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
                        <a href={`https://www.google.com/search?q=${encodeURIComponent(`${r.title} ${r.provider}`)}`} target="_blank" rel="noopener noreferrer" className="group text-muted hover:text-fg">
                          {r.title} <span className="text-subtle">· {r.provider}</span> {r.free && <span className="text-good-text">· free</span>}
                          <ExternalLink className="ml-1 inline h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 rounded-lg bg-brand-soft p-2 text-[11px]">
                    <b>Milestone:</b> {p.milestone}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </Card>
  );
}
