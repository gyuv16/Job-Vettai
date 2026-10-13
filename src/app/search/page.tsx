"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Building2, Clock3, ExternalLink, Link2, MapPin, Plus, Radar, Search, SlidersHorizontal, Trophy, WandSparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Burst, EmptyState, fadeUp, PageHeader, SpotlightCard, stagger } from "@/components/motion/effects";
import { Modal, toast } from "@/components/ui/overlay";
import { Badge, Button, Card, cn, Field, Input, Select, Skeleton, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { relativeDays, uid } from "@/lib/framework";
import { useStore } from "@/lib/store";
import type { JobSearchResult, JobSource } from "@/lib/types";

const SOURCES: { id: Exclude<JobSource, "manual">; label: string; note: string }[] = [
  { id: "linkedin", label: "LinkedIn", note: "Public guest listings, any country. Personal use, keep volume low." },
  { id: "freehire", label: "freehire.me", note: "Open tech-job aggregator with structured skills and salary." },
];

interface FetchedPosting {
  url: string;
  title: string;
  company: string;
  location: string;
  text: string;
}

export default function SearchPage() {
  const profile = useStore((s) => s.profile);
  const jobs = useStore((s) => s.jobs);
  const addJobs = useStore((s) => s.addJobs);
  const router = useRouter();
  const [query, setQuery] = useState(profile.searchQueries[0] ?? "");
  const [location, setLocation] = useState(profile.searchLocation || "India");
  const [days, setDays] = useState(14);
  const [workMode, setWorkMode] = useState<"any" | "remote" | "hybrid" | "onsite">("any");
  const [sources, setSources] = useState<string[]>(["linkedin", "freehire"]);
  const [results, setResults] = useState<JobSearchResult[] | null>(null);
  const [errors, setErrors] = useState<{ source: string; message: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [bursts, setBursts] = useState<Record<string, number>>({});

  const savedCount = Object.keys(jobs).length;

  const run = async (q = query) => {
    if (!q.trim()) return toast.error("Add a search query", "Try a role title like 'GST manager'.");
    if (!sources.length) return toast.error("Pick at least one source");
    setQuery(q);
    setLoading(true);
    setResults(null);
    try {
      const r = await api<{ results: JobSearchResult[]; errors: { source: string; message: string }[] }>("/api/search", { query: q, location, days, workMode, sources });
      setResults(r.results);
      setErrors(r.errors);
      if (r.errors.length && !r.results.length) toast.error("Sources unavailable", r.errors.map((e) => `${e.source}: ${e.message}`).join(" · "));
    } catch (e) {
      toast.error("Search failed", e instanceof Error ? e.message : String(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const save = (r: JobSearchResult) => {
    const n = addJobs([r]);
    setBursts((b) => ({ ...b, [r.key]: Date.now() }));
    if (n) toast.success("Saved to your pipeline", `${r.title} at ${r.company}`);
  };

  const saveAll = () => {
    const n = addJobs(visible.filter((r) => !jobs[r.key]));
    toast.success(`${n} job${n === 1 ? "" : "s"} saved`, "Rank them to get a shortlist.");
  };

  const visible = useMemo(() => {
    const f = filter.toLowerCase();
    return (results ?? []).filter((r) => !f || `${r.title} ${r.company} ${r.location}`.toLowerCase().includes(f));
  }, [results, filter]);

  return (
    <div>
      <PageHeader
        eyebrow="Scrape"
        icon={<Radar className="h-3 w-3" />}
        title="Scan the job portals"
        subtitle="Search public listings, dedupe across portals, and save the ones worth ranking. Postings are treated as untrusted data throughout."
        actions={
          <>
            <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setManualOpen(true)}>
              Add job manually
            </Button>
            <Link href="/rank">
              <Button icon={<Trophy className="h-4 w-4" />}>
                Rank saved
                <motion.span key={savedCount} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="ml-1 rounded-full bg-white/25 px-1.5 text-xs tabular-nums">
                  {savedCount}
                </motion.span>
              </Button>
            </Link>
          </>
        }
      />

      {/* Command bar */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run();
            }}
            className="grid grid-cols-1 gap-3 lg:grid-cols-12"
          >
            <div className="group relative lg:col-span-5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle transition-colors group-focus-within:text-brand" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Role, skill or keyword" className="h-12 pl-10 text-base" aria-label="Search query" />
            </div>
            <div className="relative lg:col-span-3">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="h-12 pl-10" aria-label="Location" />
            </div>
            <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-12 lg:col-span-2" aria-label="Posted within">
              {[1, 3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  Last {d} day{d > 1 ? "s" : ""}
                </option>
              ))}
            </Select>
            <Button type="submit" size="lg" loading={loading} icon={<Radar className="h-4 w-4" />} className="h-12 lg:col-span-2">
              Scan
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-subtle" />
            {(["any", "remote", "hybrid", "onsite"] as const).map((m) => (
              <button key={m} onClick={() => setWorkMode(m)} className={cn("relative rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors", workMode === m ? "text-white" : "text-muted hover:text-fg")}>
                {workMode === m && <motion.span layoutId="wm-pill" className="absolute inset-0 rounded-full bg-brand-gradient" />}
                <span className="relative">{m === "any" ? "Any mode" : m}</span>
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-[var(--card-border)]" />
            {SOURCES.map((s) => {
              const on = sources.includes(s.id);
              return (
                <button key={s.id} title={s.note} onClick={() => setSources(on ? sources.filter((x) => x !== s.id) : [...sources, s.id])} className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", on ? "border-[var(--ring)] bg-brand-soft text-brand" : "border-line text-subtle")}>
                  {on ? "✓ " : ""}
                  {s.label}
                </button>
              );
            })}
          </div>
          {profile.searchQueries.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-subtle">From your profile:</span>
              {profile.searchQueries.map((q, i) => (
                <motion.button key={q} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} onClick={() => run(q)} className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted hover:border-[var(--ring)] hover:text-fg">
                  {q}
                </motion.button>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Results */}
      <div className="mt-6">
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="space-y-3 p-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {!loading && results === null && (
          <EmptyState icon={<Radar className="h-7 w-7" />} title="Ready to scan" body="Search LinkedIn's public listings and freehire.me together. Results are deduped on company + title, and anything you save is remembered so you never see it twice." />
        )}

        {!loading && results !== null && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{visible.length} results</span>
                {errors.map((e) => (
                  <Badge key={e.source} tone="warning">
                    {e.source} unavailable
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter results" className="h-9 w-48" aria-label="Filter results" />
                {visible.length > 0 && (
                  <Button size="sm" variant="secondary" icon={<Bookmark className="h-3.5 w-3.5" />} onClick={saveAll}>
                    Save all
                  </Button>
                )}
              </div>
            </div>
            {visible.length === 0 ? (
              <EmptyState icon={<Search className="h-7 w-7" />} title="No matches" body="Try a broader query, a longer time window, or another location." />
            ) : (
              <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence>
                  {visible.map((r) => {
                    const saved = !!jobs[r.key];
                    return (
                      <motion.div key={r.key} variants={fadeUp} layout exit={{ opacity: 0, scale: 0.9 }}>
                        <SpotlightCard className="flex h-full flex-col p-5" glow={r.source === "linkedin" ? "var(--series-1)" : "var(--series-3)"}>
                          <div className="flex items-start justify-between gap-3">
                            <Badge tone={r.source === "linkedin" ? "info" : "good"} icon={false}>
                              {r.source === "linkedin" ? "LinkedIn" : "freehire"}
                            </Badge>
                            <button onClick={() => save(r)} aria-label={saved ? "Saved" : "Save job"} className={cn("relative grid h-8 w-8 place-items-center rounded-lg transition", saved ? "bg-brand-soft text-brand" : "text-subtle hover:bg-brand-soft hover:text-brand")}>
                              <motion.span key={String(saved)} initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
                                {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                              </motion.span>
                              <Burst trigger={bursts[r.key] ?? 0} />
                            </button>
                          </div>
                          <h3 className="mt-3 line-clamp-2 font-display text-[15px] font-semibold leading-snug">{r.title}</h3>
                          <div className="mt-2 space-y-1 text-xs text-muted">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{r.company}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{r.location || "—"}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5 shrink-0" />
                              {relativeDays(r.postedDate)}
                              {r.workMode && <span className="capitalize">· {r.workMode}</span>}
                            </div>
                          </div>
                          {r.salary && <div className="mt-2 text-xs font-semibold text-good-text">{r.salary}</div>}
                          {r.skills.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {r.skills.slice(0, 5).map((s) => (
                                <span key={s} className="rounded-md bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] px-1.5 py-0.5 text-[10px] text-muted">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-auto flex items-center gap-2 pt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              icon={<WandSparkles className="h-3.5 w-3.5" />}
                              onClick={() => {
                                addJobs([r]);
                                router.push(`/apply?job=${encodeURIComponent(r.key)}`);
                              }}
                            >
                              Apply
                            </Button>
                            <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-muted hover:bg-brand-soft hover:text-fg">
                              <ExternalLink className="h-3.5 w-3.5" /> Open
                            </a>
                          </div>
                        </SpotlightCard>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        )}
      </div>

      <ManualJobModal open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}

function ManualJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addJobs = useStore((s) => s.addJobs);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [text, setText] = useState("");
  const [fetching, setFetching] = useState(false);

  const fetchIt = async () => {
    setFetching(true);
    try {
      const p = await api<FetchedPosting>("/api/posting", { url });
      setTitle(p.title || title);
      setCompany(p.company || company);
      setLocation(p.location || location);
      setText(p.text);
      toast.success("Posting fetched", "Check the details, then save.");
    } catch (e) {
      toast.error("Could not fetch", e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  };

  const save = () => {
    if (!title.trim() || !text.trim()) return toast.error("Title and posting text are required");
    addJobs([
      {
        key: `manual:${uid("job")}`,
        source: "manual",
        title: title.trim(),
        company: company.trim() || "Unknown company",
        location: location.trim(),
        url: url.trim(),
        postedDate: null,
        description: text.trim(),
        skills: [],
        salary: null,
        workMode: null,
      },
    ]);
    toast.success("Job added", "It is ready to rank.");
    setUrl("");
    setTitle("");
    setCompany("");
    setLocation("");
    setText("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add a job manually" wide>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Posting URL (optional)" className="pl-9" />
          </div>
          <Button variant="secondary" onClick={fetchIt} loading={fetching} disabled={!url}>
            Fetch
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Title">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <Field label="Company">{(id) => <Input id={id} value={company} onChange={(e) => setCompany(e.target.value)} />}</Field>
          <Field label="Location">{(id) => <Input id={id} value={location} onChange={(e) => setLocation(e.target.value)} />}</Field>
        </div>
        <Field label="Posting text" hint="Paste the full description if the site blocks fetching.">
          {(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} className="min-h-48 text-xs" />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} icon={<Plus className="h-4 w-4" />}>
            Save job
          </Button>
        </div>
      </div>
    </Modal>
  );
}
