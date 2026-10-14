"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bot, Building2, CheckCircle2, Circle, HelpCircle, Lightbulb, MessagesSquare, RotateCw, Send, Sparkles, Target, UserRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { EmptyState, fadeUp, FlipCard, PageHeader, stagger } from "@/components/motion/effects";
import { toast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn, Select, Tabs, Textarea } from "@/components/ui/primitives";
import { api, isAi, useAiMode } from "@/lib/api";
import { cvPlainText } from "@/lib/docs";
import { heuristicInterview } from "@/lib/heuristics";
import { useStore } from "@/lib/store";
import type { InterviewPack, InterviewQuestion } from "@/lib/types";

const STAGES = ["Phone screen", "First interview", "Technical / case interview", "Final round", "HR & offer discussion"];
const CATS: { value: "all" | InterviewQuestion["category"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "behavioral", label: "Behavioral" },
  { value: "technical", label: "Role-specific" },
  { value: "motivation", label: "Motivation" },
  { value: "gap", label: "Gaps" },
  { value: "culture", label: "Culture" },
];

export default function InterviewPage() {
  return (
    <Suspense fallback={null}>
      <Interview />
    </Suspense>
  );
}

function Interview() {
  const params = useSearchParams();
  const { mode, why } = useAiMode();
  const profile = useStore((s) => s.profile);
  const applications = useStore((s) => s.applications);
  const updateApplication = useStore((s) => s.updateApplication);
  const [appId, setAppId] = useState(params.get("app") ?? "");
  const [stage, setStage] = useState(STAGES[1]);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"pack" | "mock">("pack");
  const [cat, setCat] = useState<(typeof CATS)[number]["value"]>("all");

  const candidates = [...applications].sort((a, b) => {
    const order = ["interview", "screening", "offer", "applied", "draft", "hired", "rejected", "withdrawn"];
    return order.indexOf(a.status) - order.indexOf(b.status);
  });
  useEffect(() => {
    if (!appId && candidates[0]) setAppId(candidates[0].id);
  }, [appId, candidates]);
  const app = applications.find((a) => a.id === appId);
  const pack = app?.interviewPack ?? null;

  const build = async () => {
    if (!app) return;
    // While AI is unavailable, a rebuild would quietly swap the AI pack for a built-in one.
    if (!isAi(mode) && pack?.mode === "ai" && !window.confirm(`Replace the AI prep pack with a built-in one? ${why}`)) return;
    setBusy(true);
    try {
      let p: InterviewPack;
      if (isAi(mode)) {
        const r = await api<Omit<InterviewPack, "stage" | "mode" | "createdAt">>("/api/interview", {
          profile,
          stage,
          application: {
            company: app.company,
            role: app.role,
            postingText: app.postingText,
            gaps: app.evaluation?.gaps ?? [],
            submittedCv: app.drafts ? cvPlainText(profile, app.drafts.cv) : "",
            history: app.events.map((e) => `${e.date}: ${e.status}${e.note ? ` (${e.note})` : ""}`),
          },
        });
        p = { ...r, stage, mode: "ai", createdAt: new Date().toISOString() };
      } else {
        await new Promise((r) => setTimeout(r, 500));
        p = { ...heuristicInterview(profile, app), stage };
      }
      updateApplication(app.id, { interviewPack: p });
      toast.success("Prep pack ready", `${p.questions.length} likely questions mapped to your stories.`);
    } catch (e) {
      toast.error("Could not build the prep pack", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!applications.length) {
    return (
      <div>
        <PageHeader eyebrow="Interview" icon={<MessagesSquare className="h-3 w-3" />} title="Interview prep" />
        <EmptyState
          icon={<MessagesSquare className="h-7 w-7" />}
          title="No applications to prep for"
          body="Interview prep builds from a tracked application: the exact posting, the CV the interviewer read, and the feedback recorded so far."
          action={
            <Link href="/apply">
              <Button>Start an application</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const questions = (pack?.questions ?? []).filter((q) => cat === "all" || q.category === cat);

  return (
    <div>
      <PageHeader
        eyebrow="Interview"
        icon={<MessagesSquare className="h-3 w-3" />}
        title="Interview prep"
        subtitle="A stage-specific prep pack from the application's own archive, mapped to your STAR stories. Gaps get honest bridge answers, never invented experience."
      />

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
          <Select value={appId} onChange={(e) => setAppId(e.target.value)} aria-label="Application">
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.role} · {a.company} ({a.status})
              </option>
            ))}
          </Select>
          <Select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Interview stage">
            {STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Button onClick={build} loading={busy} icon={pack ? <RotateCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}>
            {pack ? "Rebuild pack" : "Build prep pack"}
          </Button>
        </div>
      </Card>

      <Tabs
        layoutId="iv-tab"
        value={view}
        onChange={setView}
        className="mb-5"
        tabs={[
          { value: "pack", label: "Prep pack", icon: <Lightbulb className="h-4 w-4" /> },
          { value: "mock", label: "Mock interview", icon: <Bot className="h-4 w-4" /> },
        ]}
      />

      <AnimatePresence mode="wait">
        {view === "pack" ? (
          <motion.div key="pack" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            {!pack ? (
              <EmptyState icon={<Lightbulb className="h-7 w-7" />} title="No prep pack yet" body={`Pick the stage and build a pack for ${app?.role ?? "this role"} at ${app?.company ?? "the company"}.`} />
            ) : (
              <div className="space-y-5">
                <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <motion.div variants={fadeUp}>
                    <Card className="h-full">
                      <CardHeader title="Company brief" subtitle="Verify anything not in the posting before you use it" icon={<Building2 className="h-4 w-4" />} />
                      <ul className="space-y-1.5 p-5 text-xs text-muted">
                        {pack.companyBrief.map((s) => (
                          <li key={s}>• {s}</li>
                        ))}
                      </ul>
                    </Card>
                  </motion.div>
                  <motion.div variants={fadeUp}>
                    <Card className="h-full">
                      <CardHeader title="What they will probe" subtitle={pack.stage} icon={<Target className="h-4 w-4" />} />
                      <div className="flex flex-wrap gap-1.5 p-5">
                        {pack.roleFocus.map((s, i) => (
                          <motion.span key={s} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.05 }}>
                            <Badge tone="brand" icon={false}>
                              {s}
                            </Badge>
                          </motion.span>
                        ))}
                      </div>
                    </Card>
                  </motion.div>
                </motion.div>

                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-semibold">Likely questions</h2>
                    <div className="flex flex-wrap gap-1">
                      {CATS.map((c) => (
                        <button key={c.value} onClick={() => setCat(c.value)} className={cn("relative rounded-full px-3 py-1 text-xs font-medium", cat === c.value ? "text-white" : "text-muted hover:text-fg")}>
                          {cat === c.value && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-full bg-brand-gradient" />}
                          <span className="relative">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mb-3 text-xs text-subtle">Tap a card to flip it and see the answer outline.</p>
                  <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence>
                      {questions.map((q, i) => (
                        <motion.div key={q.question} layout initial={{ opacity: 0, rotateY: -30, scale: 0.9 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ delay: i * 0.04, type: "spring", stiffness: 220, damping: 22 }} style={{ transformPerspective: 1200 }}>
                          <FlipCard
                            className="h-64"
                            front={
                              <div className="flex h-full flex-col">
                                <Badge tone={q.category === "gap" ? "serious" : q.category === "technical" ? "info" : "brand"} icon={false} className="self-start capitalize">
                                  {q.category}
                                </Badge>
                                <p className="mt-3 font-display text-[15px] font-semibold leading-snug">{q.question}</p>
                                <p className="mt-auto text-[11px] text-subtle">{q.why}</p>
                              </div>
                            }
                            back={
                              <div className="text-xs">
                                <p className="mb-2 font-semibold text-brand">How to answer</p>
                                <p className="leading-relaxed text-muted">{q.outline}</p>
                                {q.starStory && (
                                  <p className="mt-3 rounded-lg bg-brand-soft p-2 text-fg">
                                    ★ Use story: <b>{q.starStory}</b>
                                  </p>
                                )}
                              </div>
                            }
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </div>

                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardHeader title="Gap bridges" subtitle="Acknowledge, bridge to adjacent experience, show how you are closing it" icon={<HelpCircle className="h-4 w-4" />} />
                    <div className="divide-y divide-[var(--card-border)]">
                      {pack.gapBridges.length === 0 && <p className="p-5 text-xs text-muted">No gaps recorded for this application.</p>}
                      {pack.gapBridges.map((g) => (
                        <details key={g.gap} className="group px-5 py-3">
                          <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                            <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                            {g.gap}
                          </summary>
                          <p className="mt-2 pl-4 text-xs leading-relaxed text-muted">{g.answer}</p>
                        </details>
                      ))}
                    </div>
                  </Card>
                  <div className="space-y-4">
                    <Card className="p-5">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Questions to ask them</p>
                      <ul className="space-y-1.5 text-xs text-muted">
                        {pack.questionsToAsk.map((q) => (
                          <li key={q}>• {q}</li>
                        ))}
                      </ul>
                    </Card>
                    <Checklist items={pack.checklist} />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="mock" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
            {app && <MockInterview key={app.id + stage} company={app.company} role={app.role} stage={stage} postingText={app.postingText} enabled={isAi(mode)} why={why} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<string[]>([]);
  return (
    <Card className="p-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">
        Day-before checklist · {done.length}/{items.length}
      </p>
      <ul className="space-y-1">
        {items.map((it) => {
          const on = done.includes(it);
          return (
            <li key={it}>
              <button onClick={() => setDone(on ? done.filter((x) => x !== it) : [...done, it])} className="flex w-full items-start gap-2 rounded-lg p-1.5 text-left text-xs hover:bg-brand-soft">
                <motion.span key={String(on)} initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 15 }}>
                  {on ? <CheckCircle2 className="h-4 w-4 text-good" /> : <Circle className="h-4 w-4 text-subtle" />}
                </motion.span>
                <span className={cn(on ? "text-subtle line-through" : "text-muted")}>{it}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function MockInterview({ company, role, stage, postingText, enabled, why }: { company: string; role: string; stage: string; postingText: string; enabled: boolean; why: string }) {
  const profile = useStore((s) => s.profile);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages, typing]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    const next = content ? [...messages, { role: "user" as const, content }] : messages;
    setMessages(next);
    setInput("");
    setTyping(true);
    try {
      const r = await api<{ reply: string }>("/api/interview/mock", { profile, company, role, stage, postingText: postingText.slice(0, 20000), messages: next });
      setMessages([...next, { role: "assistant", content: r.reply }]);
    } catch (e) {
      // Undo the turn, and give a typed answer back so a failure never swallows it.
      setMessages(messages);
      if (text === undefined) setInput(content);
      toast.error("Interviewer unavailable", e instanceof Error ? e.message : String(e));
    } finally {
      setTyping(false);
    }
  };

  // A conversation in progress stays on screen (sending pauses) when AI goes away mid-interview.
  if (!enabled && messages.length === 0) {
    return <EmptyState icon={<Bot className="h-7 w-7" />} title="Mock interviews need AI" body={`Practise with an AI interviewer who gives feedback after every answer. ${why}`} action={<Link href="/settings"><Button>Open Settings</Button></Link>} />;
  }

  return (
    <Card className="flex h-[min(70vh,640px)] flex-col overflow-hidden">
      <CardHeader title={`Mock ${stage.toLowerCase()}`} subtitle={`${role} at ${company} · feedback after each answer`} icon={<Bot className="h-4 w-4" />} action={
          messages.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMessages([]);
                setInput("");
              }}
            >
              Restart
            </Button>
          ) : undefined
        } />
      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        {messages.length === 0 && !typing && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="text-sm text-muted">The interviewer asks one question at a time. Answer as you would in the room.</p>
              <Button className="mt-4" onClick={() => send("I'm ready. Please start the interview.")} icon={<Sparkles className="h-4 w-4" />}>
                Start interview
              </Button>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12, x: m.role === "user" ? 20 : -20, scale: 0.96 }} animate={{ opacity: 1, y: 0, x: 0, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}>
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", m.role === "user" ? "bg-brand-soft text-brand" : "bg-brand-gradient text-white")}>{m.role === "user" ? <UserRound className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</span>
              <div className={cn("max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed", m.role === "user" ? "rounded-tr-sm bg-brand-gradient text-white" : "rounded-tl-sm border border-line bg-[var(--card-solid)]")}>{m.content}</div>
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient text-white">
              <Bot className="h-4 w-4" />
            </span>
            <div className="flex gap-1 rounded-2xl border border-line bg-[var(--card-solid)] px-4 py-3">
              {[0, 1, 2].map((d) => (
                <motion.span key={d} className="h-2 w-2 rounded-full bg-subtle" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: d * 0.15 }} />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>
      {!enabled && (
        <p role="status" className="border-t border-line bg-[color-mix(in_oklab,var(--warning)_10%,transparent)] px-4 py-2.5 text-xs leading-relaxed text-muted">
          The interview is paused. {why}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) send();
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.trim()) send();
            }
          }}
          placeholder={messages.length ? "Your answer… (Enter to send, Shift+Enter for a new line)" : "Start the interview first"}
          className="min-h-11 flex-1 resize-none"
          rows={1}
          disabled={!messages.length || typing || !enabled}
        />
        <Button type="submit" size="icon" className="h-11 w-11" disabled={!input.trim() || typing || !enabled || !messages.length} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
