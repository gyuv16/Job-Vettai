"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { BellRing, BriefcaseBusiness, ClipboardCopy, Download, ExternalLink, FileText, Mail, MessagesSquare, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState, PageHeader, RadialGauge } from "@/components/motion/effects";
import { Modal, toast } from "@/components/ui/overlay";
import { Badge, Button, cn, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { api, isAi, useAiMode } from "@/lib/api";
import { download } from "@/lib/docs";
import { daysSince, relativeDays, today } from "@/lib/framework";
import { useStore } from "@/lib/store";
import type { Application, AppStatus } from "@/lib/types";

const COLUMNS: { id: string; label: string; statuses: AppStatus[]; accent: string }[] = [
  { id: "draft", label: "Draft", statuses: ["draft"], accent: "var(--fg-subtle)" },
  { id: "applied", label: "Applied", statuses: ["applied"], accent: "var(--seq-250)" },
  { id: "screening", label: "Screening", statuses: ["screening"], accent: "var(--seq-350)" },
  { id: "interview", label: "Interview", statuses: ["interview"], accent: "var(--seq-450)" },
  { id: "offer", label: "Offer", statuses: ["offer"], accent: "var(--good)" },
  { id: "hired", label: "Hired", statuses: ["hired"], accent: "var(--good)" },
  { id: "closed", label: "Closed", statuses: ["rejected", "withdrawn"], accent: "var(--critical)" },
];

const ALL_STATUSES: AppStatus[] = ["draft", "applied", "screening", "interview", "offer", "hired", "rejected", "withdrawn"];

export default function TrackerPage() {
  const applications = useStore((s) => s.applications);
  const moveApplication = useStore((s) => s.moveApplication);
  const followupDays = useStore((s) => s.settings.followupDays);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const byCol = useMemo(() => {
    const m: Record<string, Application[]> = {};
    for (const c of COLUMNS) m[c.id] = applications.filter((a) => c.statuses.includes(a.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return m;
  }, [applications]);

  const exportCsv = () => {
    const esc = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula-injection guard
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = [
      ["date", "company", "role", "channel", "status", "fit_rating", "notes", "source", "deadline"],
      ...applications.map((a) => [a.appliedAt ?? a.createdAt.slice(0, 10), a.company, a.role, a.channel, a.status, a.fitScore ?? "", a.notes, a.url, a.deadline ?? ""]),
    ];
    download(`job_search_tracker_${today()}.csv`, rows.map((r) => r.map(esc).join(",")).join("\n"), "text/csv");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Outcome"
        icon={<BriefcaseBusiness className="h-3 w-3" />}
        title="Application tracker"
        subtitle="Drag cards between stages to record what happened. Quiet applications pulse when it is time for a polite follow-up."
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!applications.length}>
              CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              Add application
            </Button>
          </>
        }
      />

      {applications.length === 0 ? (
        <EmptyState icon={<BriefcaseBusiness className="h-7 w-7" />} title="Your board is empty" body="Applications appear here when you evaluate a job in the Apply Studio, or add ones you made elsewhere." action={<Button onClick={() => setAdding(true)}>Add application</Button>} />
      ) : (
        <LayoutGroup>
          <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            <div className="flex min-w-max gap-3">
              {COLUMNS.map((col, ci) => (
                <motion.section
                  key={col.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ci * 0.06, type: "spring", stiffness: 220, damping: 24 }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(col.id);
                  }}
                  onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    setDragOver(null);
                    if (id) moveApplication(id, col.statuses[0], `Moved to ${col.label}`);
                  }}
                  className={cn("glass flex w-72 shrink-0 flex-col rounded-2xl transition-shadow", dragOver === col.id && "shadow-[0_0_0_2px_var(--ring),0_20px_50px_-20px_var(--ring)]")}
                  aria-label={`${col.label} column`}
                >
                  <header className="flex items-center justify-between px-4 pb-2 pt-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.accent }} />
                      <h2 className="text-sm font-semibold">{col.label}</h2>
                    </div>
                    <motion.span key={byCol[col.id].length} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-brand">
                      {byCol[col.id].length}
                    </motion.span>
                  </header>
                  <div className="flex min-h-40 flex-1 flex-col gap-2.5 p-3 pt-1">
                    <AnimatePresence>
                      {byCol[col.id].map((a) => {
                        const quiet = ["applied", "screening"].includes(a.status) && (daysSince(a.updatedAt) ?? 0) >= followupDays;
                        return (
                          <motion.div key={a.id} layoutId={a.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} whileHover={{ y: -3, rotate: -0.6 }} transition={{ type: "spring", stiffness: 350, damping: 28 }}>
                            <div
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", a.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={() => setSelected(a.id)}
                              onKeyDown={(e) => e.key === "Enter" && setSelected(a.id)}
                              role="button"
                              tabIndex={0}
                              className="cursor-grab rounded-xl border border-line bg-[var(--card-solid)] p-3 shadow-sm transition hover:border-[var(--ring)] active:cursor-grabbing"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">{a.company}</p>
                                  <p className="truncate text-xs text-muted">{a.role}</p>
                                </div>
                                {a.fitScore != null && <RadialGauge value={a.fitScore} size={38} stroke={4} />}
                              </div>
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] text-subtle">
                                {a.channel && <span className="rounded-md bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] px-1.5 py-0.5">{a.channel}</span>}
                                <span>{relativeDays(a.updatedAt)}</span>
                                {a.status === "withdrawn" && <Badge tone="neutral">withdrawn</Badge>}
                                {quiet && (
                                  <span className="relative ml-auto inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--warning)_20%,transparent)] px-1.5 py-0.5 font-medium text-fg">
                                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[color-mix(in_oklab,var(--warning)_30%,transparent)]" />
                                    <BellRing className="relative h-3 w-3" /> <span className="relative">follow up</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {byCol[col.id].length === 0 && <div className="grid flex-1 place-items-center rounded-xl border-2 border-dashed border-line text-[11px] text-subtle">Drop here</div>}
                  </div>
                </motion.section>
              ))}
            </div>
          </div>
        </LayoutGroup>
      )}

      <AppDetail id={selected} onClose={() => setSelected(null)} />
      <AddAppModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AppDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { mode } = useAiMode();
  const app = useStore((s) => s.applications.find((a) => a.id === id));
  const profile = useStore((s) => s.profile);
  const moveApplication = useStore((s) => s.moveApplication);
  const updateApplication = useStore((s) => s.updateApplication);
  const removeApplication = useStore((s) => s.removeApplication);
  const [busy, setBusy] = useState<"followup" | "thankyou" | null>(null);

  if (!app) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const followupCount = app.followups.filter((f) => f.kind === "followup").length;

  const draftMessage = async (kind: "followup" | "thankyou") => {
    setBusy(kind);
    try {
      let text: string;
      if (isAi(mode)) {
        const r = await api<{ subject: string; message: string; channel: string; timing: string }>("/api/followup", {
          profile,
          kind,
          application: {
            company: app.company,
            role: app.role,
            contact: app.contact,
            appliedAt: app.appliedAt,
            lastEvent: app.events.at(-1)?.status ?? app.status,
            submittedSummary: app.drafts ? `${app.drafts.cv.summary}\n${app.drafts.coverLetter.paragraphs[0] ?? ""}` : app.evaluation?.strengths.join("; ") ?? "",
          },
        });
        text = `Subject: ${r.subject}\n\n${r.message}\n\n(${r.channel} · ${r.timing})`;
      } else {
        text =
          kind === "followup"
            ? `Subject: ${app.role} application - checking in\n\nDear ${app.contact || "Hiring team"},\n\nI applied for the ${app.role} role on ${app.appliedAt ?? "recently"} and wanted to check whether there is any update on the timeline. I remain very interested in the position and happy to share anything else that would help.\n\nKind regards,\n${profile.name}`
            : `Subject: Thank you - ${app.role} interview\n\nDear ${app.contact || "Hiring team"},\n\nThank you for your time today. I enjoyed learning more about the team and the ${app.role} role, and our conversation strengthened my interest in joining ${app.company}.\n\nKind regards,\n${profile.name}`;
      }
      updateApplication(app.id, { followups: [...app.followups, { date: today(), text, kind }] });
      toast.success("Draft ready", "Review it, then send it yourself. Nothing is sent automatically.");
    } catch (e) {
      toast.error("Could not draft", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={!!app} onClose={onClose} title={`${app.role} · ${app.company}`} wide>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Stage</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_STATUSES.map((s) => (
              <button key={s} onClick={() => moveApplication(app.id, s)} className={cn("relative rounded-full border px-3 py-1 text-xs font-medium capitalize", app.status === s ? "border-transparent text-white" : "border-line text-muted hover:text-fg")}>
                {app.status === s && <motion.span layoutId="status-pill" className="absolute inset-0 rounded-full bg-brand-gradient" />}
                <span className="relative">{s}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Contact person">{(fid) => <Input id={fid} value={app.contact} onChange={(e) => updateApplication(app.id, { contact: e.target.value })} />}</Field>
            <Field label="Channel">{(fid) => <Input id={fid} value={app.channel} onChange={(e) => updateApplication(app.id, { channel: e.target.value })} placeholder="LinkedIn, referral, company site…" />}</Field>
            <Field label="Notes">{(fid) => <Textarea id={fid} value={app.notes} onChange={(e) => updateApplication(app.id, { notes: e.target.value })} placeholder="Interviewer names, feedback, salary discussed…" />}</Field>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Timeline</p>
            <ol className="relative space-y-3 border-l border-line pl-4">
              {app.events.map((e, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative text-xs">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-gradient" />
                  <span className="font-medium capitalize">{e.status}</span> <span className="text-subtle">· {e.date}</span>
                  {e.note && <p className="text-muted">{e.note}</p>}
                </motion.li>
              ))}
            </ol>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Link href={`/apply?app=${app.id}`}>
            <Button size="sm" variant="secondary" icon={<FileText className="h-3.5 w-3.5" />}>
              Open in Apply Studio
            </Button>
          </Link>
          <Link href={`/interview?app=${app.id}`}>
            <Button size="sm" variant="secondary" icon={<MessagesSquare className="h-3.5 w-3.5" />}>
              Interview prep
            </Button>
          </Link>
          <Button size="sm" variant="secondary" icon={<BellRing className="h-3.5 w-3.5" />} loading={busy === "followup"} onClick={() => draftMessage("followup")} disabled={followupCount >= 2} title={followupCount >= 2 ? "At most two follow-ups per application" : undefined}>
            Draft follow-up
          </Button>
          <Button size="sm" variant="secondary" icon={<Mail className="h-3.5 w-3.5" />} loading={busy === "thankyou"} onClick={() => draftMessage("thankyou")}>
            Draft thank-you
          </Button>
          {app.url && (
            <a href={app.url} target="_blank" rel="noopener noreferrer nofollow">
              <Button size="sm" variant="ghost" icon={<ExternalLink className="h-3.5 w-3.5" />}>
                Posting
              </Button>
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-critical"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={() => {
              if (window.confirm(`Delete the ${app.company} application?`)) {
                removeApplication(app.id);
                onClose();
              }
            }}
          >
            Delete
          </Button>
        </div>

        {app.followups.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Drafted messages</p>
            {app.followups.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative rounded-xl border border-line p-3">
                <button onClick={() => navigator.clipboard.writeText(f.text).then(() => toast.success("Copied"))} className="absolute right-2 top-2 rounded-lg p-1.5 text-subtle hover:bg-brand-soft hover:text-fg" aria-label="Copy message">
                  <ClipboardCopy className="h-3.5 w-3.5" />
                </button>
                <p className="mb-1 text-[10px] text-subtle">{f.date}</p>
                <pre className="whitespace-pre-wrap font-sans text-xs text-muted">{f.text}</pre>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function AddAppModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createApplication = useStore((s) => s.createApplication);
  const [f, setF] = useState({ company: "", role: "", url: "", channel: "", status: "applied" as AppStatus });
  return (
    <Modal open={open} onClose={onClose} title="Add an application">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.company.trim() || !f.role.trim()) return toast.error("Company and role are required");
          createApplication({ ...f, company: f.company.trim(), role: f.role.trim() });
          toast.success("Application added");
          setF({ company: "", role: "", url: "", channel: "", status: "applied" });
          onClose();
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Company">{(id) => <Input id={id} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />}</Field>
          <Field label="Role">{(id) => <Input id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />}</Field>
          <Field label="Posting URL">{(id) => <Input id={id} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />}</Field>
          <Field label="Channel">{(id) => <Input id={id} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })} placeholder="Referral" />}</Field>
          <Field label="Stage">
            {(id) => (
              <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as AppStatus })}>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add</Button>
        </div>
      </form>
    </Modal>
  );
}
