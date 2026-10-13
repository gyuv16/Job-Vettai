"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  Flame,
  Gauge,
  Handshake,
  MessagesSquare,
  Radar,
  Send,
  Sparkles,
  Trophy,
  UserRound,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BarList, Histogram, ORDINAL_RAMP } from "@/components/charts";
import { Aurora, fadeUp, NumberTicker, RadialGauge, SpotlightCard, stagger } from "@/components/motion/effects";
import { toast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn } from "@/components/ui/primitives";
import { daysSince, daysUntil, relativeDays, verdictTone } from "@/lib/framework";
import { buildSample } from "@/lib/sample";
import { profileCompleteness, useStore } from "@/lib/store";
import type { AppStatus } from "@/lib/types";

const STAGES: { status: AppStatus; label: string }[] = [
  { status: "applied", label: "Applied" },
  { status: "screening", label: "Screening" },
  { status: "interview", label: "Interview" },
  { status: "offer", label: "Offer" },
  { status: "hired", label: "Hired" },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { profile, jobs, applications, settings, importAll } = useStore();
  const jobList = useMemo(() => Object.values(jobs), [jobs]);
  const completeness = profileCompleteness(profile);
  const firstName = profile.name.split(" ")[0];

  const stats = useMemo(() => {
    const sent = applications.filter((a) => a.status !== "draft");
    const reached = (idx: number) =>
      sent.filter((a) => {
        const all = [a.status, ...a.events.map((e) => e.status)];
        return all.some((s) => STAGES.findIndex((st) => st.status === s) >= idx);
      }).length;
    const scored = applications.filter((a) => a.fitScore != null);
    return {
      sent: sent.length,
      interviews: reached(2),
      offers: reached(3),
      avgFit: scored.length ? Math.round(scored.reduce((s, a) => s + (a.fitScore ?? 0), 0) / scored.length) : 0,
      responseRate: sent.length ? Math.round((reached(1) / sent.length) * 100) : 0,
      funnel: STAGES.map((st, i) => ({ label: st.label, value: reached(i), hint: `${reached(i)} of ${sent.length} applications reached ${st.label.toLowerCase()}` })),
    };
  }, [applications]);

  const ranked = jobList.filter((j) => j.rank && j.status !== "expired").sort((a, b) => (b.rank?.overall ?? 0) - (a.rank?.overall ?? 0));
  const bins = [
    { label: "<30", min: 0, max: 29 },
    { label: "30-44", min: 30, max: 44 },
    { label: "45-59", min: 45, max: 59 },
    { label: "60-74", min: 60, max: 74 },
    { label: "75+", min: 75, max: 100 },
  ].map((b) => ({ label: b.label, value: ranked.filter((j) => (j.rank?.overall ?? -1) >= b.min && (j.rank?.overall ?? -1) <= b.max).length }));

  const channels = Object.entries(
    applications.reduce<Record<string, number>>((acc, a) => {
      const k = a.channel || "Unspecified";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));

  const quiet = applications.filter((a) => ["applied", "screening"].includes(a.status) && (daysSince(a.updatedAt) ?? 0) >= settings.followupDays);
  const newJobs = jobList.filter((j) => j.status === "new");
  const closing = jobList.filter((j) => {
    const d = daysUntil(j.rank?.deadline);
    return d !== null && d >= 0 && d <= 7 && j.status !== "applied";
  });

  const actions = [
    completeness < 70 && { icon: <UserRound className="h-4 w-4" />, text: `Profile is ${completeness}% complete. Richer profiles produce sharper applications.`, href: "/profile", cta: "Complete profile" },
    newJobs.length > 0 && { icon: <Trophy className="h-4 w-4" />, text: `${newJobs.length} new job${newJobs.length > 1 ? "s" : ""} waiting to be ranked.`, href: "/rank", cta: "Rank now" },
    closing.length > 0 && { icon: <Flame className="h-4 w-4" />, text: `${closing.length} shortlisted job${closing.length > 1 ? "s close" : " closes"} within 7 days.`, href: "/rank", cta: "View" },
    quiet.length > 0 && { icon: <BellRing className="h-4 w-4" />, text: `${quiet.length} application${quiet.length > 1 ? "s have" : " has"} been quiet for ${settings.followupDays}+ days.`, href: "/tracker", cta: "Follow up" },
    jobList.length === 0 && { icon: <Radar className="h-4 w-4" />, text: "No jobs collected yet. Scan the portals for matches.", href: "/search", cta: "Search" },
  ].filter(Boolean) as { icon: React.ReactNode; text: string; href: string; cta: string }[];

  const activity = applications
    .flatMap((a) => a.events.map((e) => ({ ...e, company: a.company, role: a.role, id: a.id })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const empty = !profile.name && applications.length === 0 && jobList.length === 0;

  const loadSample = () => {
    importAll(buildSample());
    toast.success("Sample data loaded", "Explore every page with a fictional tax professional's job hunt.");
  };

  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="space-y-5">
      {/* Hero */}
      <motion.section variants={fadeUp} className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <Aurora />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <Badge tone="brand" icon={<Sparkles className="h-3 w-3" />}>
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </Badge>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {empty ? (
                <>
                  Hunt smarter. <span className="text-gradient">Apply sharper.</span>
                </>
              ) : (
                <>
                  Your job hunt, <span className="text-gradient">at a glance.</span>
                </>
              )}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
              {empty
                ? "Build your profile once. Then scan portals, rank every posting against an honest fit framework, draft tailored CVs and cover letters with a reviewer pass, and prep for interviews."
                : `${stats.sent} applications sent, ${ranked.length} jobs ranked, ${stats.interviews} reached interview.`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {empty ? (
                <>
                  <Link href="/profile">
                    <Button icon={<UserRound className="h-4 w-4" />}>Build my profile</Button>
                  </Link>
                  <Button variant="secondary" icon={<Sparkles className="h-4 w-4" />} onClick={loadSample}>
                    Load sample data
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/search">
                    <Button icon={<Radar className="h-4 w-4" />}>Find jobs</Button>
                  </Link>
                  <Link href="/apply">
                    <Button variant="secondary" icon={<WandSparkles className="h-4 w-4" />}>
                      Apply to a job
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 self-start rounded-2xl border border-line bg-[color-mix(in_oklab,var(--bg-elev)_60%,transparent)] p-4 lg:self-auto">
            <RadialGauge value={completeness} size={96} stroke={8} label="profile" />
            <div className="text-sm">
              <div className="font-semibold">Profile strength</div>
              <div className="max-w-[12rem] text-xs text-muted">The single biggest factor in output quality.</div>
              <Link href="/profile" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                Improve <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Stat tiles */}
      <motion.section variants={stagger(0.08)} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Applications sent", value: stats.sent, icon: Send, sub: `${applications.filter((a) => a.status === "draft").length} drafts in progress` },
          { label: "Reached interview", value: stats.interviews, icon: MessagesSquare, sub: `${stats.responseRate}% got a response` },
          { label: "Offers", value: stats.offers, icon: Handshake, sub: stats.offers ? "Congratulations" : "Keep going" },
          { label: "Average fit", value: stats.avgFit, icon: Gauge, sub: "Across tracked applications", suffix: "" },
        ].map((s) => (
          <motion.div key={s.label} variants={fadeUp}>
            <SpotlightCard className="h-full p-4 sm:p-5" tilt>
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-muted">{s.label}</span>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
                  <s.icon className="h-4 w-4" />
                </span>
              </div>
              <NumberTicker value={s.value} className="mt-2 block font-display text-3xl font-bold sm:text-4xl" />
              <div className="mt-1 text-[11px] text-subtle">{s.sub}</div>
            </SpotlightCard>
          </motion.div>
        ))}
      </motion.section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Next best actions */}
        <motion.div variants={fadeUp} className="lg:col-span-1">
          <Card className="shimmer-border h-full">
            <CardHeader title="Next best actions" subtitle="What will move your search forward" icon={<Sparkles className="h-4 w-4" />} />
            <div className="space-y-2 p-4">
              {actions.length === 0 && <p className="py-6 text-center text-sm text-muted">You are all caught up. Nice work.</p>}
              {actions.map((a, i) => (
                <motion.div key={a.text} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }}>
                  <Link href={a.href} className="group flex items-center gap-3 rounded-xl border border-line p-3 transition hover:border-[var(--ring)] hover:bg-brand-soft">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white">{a.icon}</span>
                    <span className="flex-1 text-xs leading-relaxed text-muted group-hover:text-fg">{a.text}</span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-brand">
                      {a.cta}
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Funnel */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader title="Application funnel" subtitle="How far applications got" icon={<BriefcaseBusiness className="h-4 w-4" />} />
            <div className="p-5">
              <BarList data={stats.funnel} colors={ORDINAL_RAMP} max={Math.max(1, stats.sent)} emptyText="Track an application to see your funnel." />
            </div>
          </Card>
        </motion.div>

        {/* Fit distribution */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader title="Fit score distribution" subtitle={`${ranked.length} ranked jobs`} icon={<Gauge className="h-4 w-4" />} />
            <div className="p-5">
              {ranked.length ? <Histogram bins={bins} /> : <p className="py-10 text-center text-xs text-subtle">Rank some jobs to see how they score.</p>}
            </div>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Top ranked */}
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader
              title="Top matches"
              subtitle="Highest fit across ranked postings"
              icon={<Trophy className="h-4 w-4" />}
              action={
                <Link href="/rank" className="text-xs font-semibold text-brand">
                  View all
                </Link>
              }
            />
            <div className="divide-y divide-[var(--card-border)]">
              {ranked.slice(0, 5).map((j, i) => (
                <motion.div key={j.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.07 }} className="flex items-center gap-4 px-5 py-3">
                  <RadialGauge value={j.rank?.overall ?? 0} size={46} stroke={5} delay={i * 0.1} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{j.title}</div>
                    <div className="truncate text-xs text-muted">
                      {j.company} · {j.location || "—"}
                    </div>
                  </div>
                  {j.rank && <Badge tone={verdictTone(j.rank.verdict)}>{j.rank.verdict}</Badge>}
                </motion.div>
              ))}
              {ranked.length === 0 && <p className="px-5 py-10 text-center text-xs text-subtle">Nothing ranked yet.</p>}
            </div>
          </Card>
        </motion.div>

        {/* Activity */}
        <motion.div variants={fadeUp}>
          <Card className="h-full">
            <CardHeader title="Recent activity" subtitle="Latest application events" icon={<CalendarClock className="h-4 w-4" />} />
            <ol className="relative space-y-4 p-5 before:absolute before:bottom-6 before:left-[25px] before:top-6 before:w-px before:bg-[var(--card-border)]">
              {activity.map((e, i) => (
                <motion.li key={`${e.id}-${i}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.06 }} className="relative flex gap-3 pl-0">
                  <span className={cn("relative z-10 mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 border-[var(--card-solid)]", e.status === "offer" || e.status === "hired" ? "bg-good" : e.status === "rejected" ? "bg-critical" : "bg-brand")} />
                  <div className="min-w-0 text-xs">
                    <div className="truncate font-medium text-fg">
                      {e.company} · <span className="capitalize">{e.status}</span>
                    </div>
                    <div className="truncate text-subtle">
                      {e.role} · {relativeDays(e.date)}
                    </div>
                  </div>
                </motion.li>
              ))}
              {activity.length === 0 && <li className="py-6 text-center text-xs text-subtle">No activity yet.</li>}
            </ol>
          </Card>
        </motion.div>
      </div>

      {channels.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader title="Applications by channel" subtitle="Where your applications go" icon={<Send className="h-4 w-4" />} />
            <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-2">
              <BarList data={channels} />
              <p className="self-center text-xs leading-relaxed text-muted">
                Tip from the framework: before applying, call the listed contact only when you have a substantive question about the role. Use what you learn to tailor the application, and mention the conversation naturally in your cover letter.
              </p>
            </div>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
