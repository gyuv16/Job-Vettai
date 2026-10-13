"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpenCheck,
  Briefcase,
  FileUp,
  GraduationCap,
  Plus,
  Save,
  ScanText,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserRound,
  Wand2,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { fadeUp, PageHeader, popIn, RadialGauge, stagger } from "@/components/motion/effects";
import { toast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, ChipInput, cn, Field, Input, Select, Switch, Tabs, Textarea } from "@/components/ui/primitives";
import { api, isAi, useAiMode } from "@/lib/api";
import { uid } from "@/lib/framework";
import { heuristicProfileFromText, newStory } from "@/lib/heuristics";
import { profileCompleteness, useStore } from "@/lib/store";
import type { Profile } from "@/lib/types";

type Section = "import" | "basics" | "skills" | "experience" | "motivation" | "stories";
const ORDER: Section[] = ["import", "basics", "skills", "experience", "motivation", "stories"];

type ExtractedProfile = Omit<Profile, "experience" | "education" | "starStories" | "updatedAt" | "energizing" | "draining" | "dealBreakers" | "workAuthorization" | "preferredWorkMode" | "willingToRelocate" | "behavioral" | "searchLocation"> & {
  experience: Omit<Profile["experience"][number], "id">[];
  education: Omit<Profile["education"][number], "id">[];
  starStories: Omit<Profile["starStories"][number], "id">[];
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const [section, setSection] = useState<Section>(profile.name ? "basics" : "import");
  const [dir, setDir] = useState(1);
  const completeness = profileCompleteness(profile);

  const go = (s: Section) => {
    setDir(ORDER.indexOf(s) > ORDER.indexOf(section) ? 1 : -1);
    setSection(s);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Setup"
        icon={<UserRound className="h-3 w-3" />}
        title="Your candidate profile"
        subtitle="The single source of truth for every evaluation, CV and cover letter. Nothing here is ever invented later: if a fact is not in your profile, drafts will not claim it."
        actions={
          <div className="glass flex items-center gap-3 rounded-2xl px-3 py-2">
            <RadialGauge value={completeness} size={52} stroke={5} />
            <div className="text-xs">
              <div className="font-semibold">Profile strength</div>
              <div className="text-muted">Autosaved in this browser</div>
            </div>
          </div>
        }
      />

      <Tabs
        layoutId="profile-tab"
        value={section}
        onChange={go}
        className="mb-5"
        tabs={[
          { value: "import", label: "Import CV", icon: <FileUp className="h-4 w-4" /> },
          { value: "basics", label: "Basics", icon: <UserRound className="h-4 w-4" /> },
          { value: "skills", label: "Skills", icon: <Sparkles className="h-4 w-4" /> },
          { value: "experience", label: "Experience", icon: <Briefcase className="h-4 w-4" /> },
          { value: "motivation", label: "Goals & search", icon: <Target className="h-4 w-4" /> },
          { value: "stories", label: "STAR stories", icon: <Star className="h-4 w-4" /> },
        ]}
      />

      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={section}
          custom={dir}
          initial={{ opacity: 0, x: dir * 60, rotateY: dir * 8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          exit={{ opacity: 0, x: dir * -60, rotateY: dir * -8 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          style={{ transformPerspective: 1400 }}
        >
          {section === "import" && <ImportSection onDone={() => go("basics")} />}
          {section === "basics" && <BasicsSection profile={profile} set={setProfile} />}
          {section === "skills" && <SkillsSection profile={profile} set={setProfile} />}
          {section === "experience" && <ExperienceSection profile={profile} set={setProfile} />}
          {section === "motivation" && <MotivationSection profile={profile} set={setProfile} />}
          {section === "stories" && <StoriesSection profile={profile} set={setProfile} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

type SectionProps = { profile: Profile; set: (p: Partial<Profile>) => void };

// ------------------------------------------------------------------ Import

function ImportSection({ onDone }: { onDone: () => void }) {
  const { mode } = useAiMode();
  const replaceProfile = useStore((s) => s.replaceProfile);
  const profile = useStore((s) => s.profile);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (f: File | undefined) => {
    if (!f) return;
    if (f.type === "application/pdf") {
      if (f.size > 3_000_000) return toast.error("PDF too large", "Keep CV PDFs under 3 MB.");
      setFile(f);
    } else if (f.type.startsWith("text/") || /\.(txt|md|tex)$/i.test(f.name)) {
      f.text().then(setText);
    } else toast.error("Unsupported file", "Use a PDF, or paste the text.");
  };

  const run = async () => {
    if (!text.trim() && !file) return toast.error("Nothing to import", "Paste your CV text or drop a PDF.");
    setBusy(true);
    try {
      if (isAi(mode)) {
        const pdfBase64 = file ? await fileToBase64(file) : undefined;
        const p = await api<ExtractedProfile>("/api/profile", { text: text || undefined, pdfBase64 });
        replaceProfile({
          ...profile,
          ...p,
          experience: p.experience.map((e) => ({ ...e, id: uid("exp") })),
          education: p.education.map((e) => ({ ...e, id: uid("edu") })),
          starStories: p.starStories.map((s) => ({ ...s, id: uid("star") })),
          updatedAt: new Date().toISOString(),
        });
        toast.success("Profile built", "Review each section and fill in goals and preferences.");
      } else {
        if (file && !text) {
          toast.error("PDF needs AI mode", "Without an API key, paste your CV as text instead.");
          return;
        }
        const p = heuristicProfileFromText(text);
        replaceProfile({ ...profile, ...p, skills: { ...profile.skills, ...p.skills } } as Profile);
        toast.info("Basic details extracted", "Heuristic mode pulled contact details and skills. Add an API key for full extraction.");
      }
      onDone();
    } catch (e) {
      toast.error("Import failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <Card className="relative overflow-hidden lg:col-span-3">
        <CardHeader title="Import your CV" subtitle="PDF or pasted text. Claude extracts a structured profile you can edit." icon={<ScanText className="h-4 w-4" />} />
        <div className="space-y-4 p-5">
          <motion.div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              accept(e.dataTransfer.files[0]);
            }}
            onClick={() => inputRef.current?.click()}
            animate={{ scale: drag ? 1.02 : 1 }}
            className={cn(
              "relative grid cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              drag ? "border-[var(--brand-2)] bg-brand-soft" : "border-line hover:border-[var(--ring)]",
            )}
          >
            <input ref={inputRef} type="file" accept=".pdf,.txt,.md,.tex,application/pdf,text/plain" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
            {busy && (
              <motion.div
                aria-hidden
                className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-[color-mix(in_oklab,var(--brand-3)_35%,transparent)] to-transparent"
                animate={{ y: ["-100%", "400%"] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div className="relative">
              <div className="relative mx-auto mb-3 grid h-14 w-14 place-items-center">
                <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-brand-soft" />
                <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient text-white">
                  <FileUp className="h-6 w-6" />
                </span>
              </div>
              <p className="text-sm font-semibold">{file ? file.name : "Drop your CV PDF here, or click to browse"}</p>
              <p className="mt-1 text-xs text-muted">{file ? `${Math.round(file.size / 1024)} KB · ready` : "PDF up to 3 MB, or a .txt/.md file"}</p>
            </div>
          </motion.div>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-subtle">
            <span className="h-px flex-1 bg-[var(--card-border)]" />
            or paste text
            <span className="h-px flex-1 bg-[var(--card-border)]" />
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your CV, LinkedIn 'About' and experience sections, or any career notes…" className="min-h-48 font-mono text-xs" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge tone={isAi(mode) ? "good" : "warning"}>{isAi(mode) ? "Claude will extract your profile" : "Heuristic mode: basic extraction only"}</Badge>
            <Button onClick={run} loading={busy} icon={<Wand2 className="h-4 w-4" />}>
              {busy ? "Reading your CV…" : "Build my profile"}
            </Button>
          </div>
        </div>
      </Card>
      <motion.div variants={stagger(0.1, 0.15)} initial="hidden" animate="show" className="space-y-3 lg:col-span-2">
        {[
          { icon: <BookOpenCheck className="h-4 w-4" />, title: "Grounded, never invented", body: "Every CV bullet and cover-letter claim is checked against this profile. Facts that live only in chat get stripped as fabrications." },
          { icon: <Sparkles className="h-4 w-4" />, title: "Depth beats breadth", body: "Describe what you actually did in each role: projects, tools, measurable results. A thin profile produces generic applications." },
          { icon: <Target className="h-4 w-4" />, title: "Say what energises you", body: "Goals and energising tasks drive the career-alignment score, so the ranking surfaces roles you would actually enjoy." },
        ].map((t) => (
          <motion.div key={t.title} variants={fadeUp}>
            <Card className="flex gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">{t.icon}</span>
              <div>
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{t.body}</p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

// ------------------------------------------------------------------ Basics

function BasicsSection({ profile: p, set }: SectionProps) {
  return (
    <Card>
      <CardHeader title="Identity & preferences" subtitle="Used in CV headers and the location / eligibility gates" icon={<UserRound className="h-4 w-4" />} />
      <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        {(
          [
            ["Full name", "name", "Kavya Raman"],
            ["Headline", "headline", "Chartered Accountant | Indirect Tax"],
            ["Email", "email", "you@example.com"],
            ["Phone", "phone", "+91 …"],
            ["Location", "location", "Chennai, Tamil Nadu, India"],
            ["Work authorization", "workAuthorization", "Indian citizen"],
          ] as const
        ).map(([label, key, ph]) => (
          <motion.div key={key} variants={fadeUp}>
            <Field label={label}>{(id) => <Input id={id} value={p[key]} placeholder={ph} onChange={(e) => set({ [key]: e.target.value })} />}</Field>
          </motion.div>
        ))}
        <motion.div variants={fadeUp}>
          <Field label="Preferred work mode">
            {(id) => (
              <Select id={id} value={p.preferredWorkMode} onChange={(e) => set({ preferredWorkMode: e.target.value as Profile["preferredWorkMode"] })}>
                <option value="any">Any</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </Select>
            )}
          </Field>
        </motion.div>
        <motion.div variants={fadeUp} className="flex items-end">
          <div className="flex w-full items-center justify-between rounded-xl border border-line px-3 py-2.5">
            <span className="text-sm">Willing to relocate</span>
            <Switch checked={p.willingToRelocate} onChange={(v) => set({ willingToRelocate: v })} label="Willing to relocate" />
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="sm:col-span-2">
          <Field label="Professional summary" hint="3-4 sentences. Specific beats impressive.">
            {(id) => <Textarea id={id} value={p.summary} onChange={(e) => set({ summary: e.target.value })} className="min-h-28" />}
          </Field>
        </motion.div>
        <motion.div variants={fadeUp} className="sm:col-span-2">
          <Field label="Links (LinkedIn, portfolio, GitHub)">{() => <ChipInput values={p.links} onChange={(links) => set({ links })} placeholder="Paste a URL and press Enter" tone="neutral" />}</Field>
        </motion.div>
      </motion.div>
    </Card>
  );
}

// ------------------------------------------------------------------ Skills

function SkillsSection({ profile: p, set }: SectionProps) {
  const cols: { key: keyof Profile["skills"]; title: string; hint: string; tone: "good" | "info" | "warning" }[] = [
    { key: "strong", title: "Strong", hint: "Used repeatedly and recently", tone: "good" },
    { key: "moderate", title: "Moderate", hint: "Real use, not daily", tone: "info" },
    { key: "weak", title: "Weak / learning", hint: "Gaps you know about", tone: "warning" },
  ];
  const domains: { key: keyof Profile["domains"]; title: string }[] = [
    { key: "direct", title: "Direct experience domains" },
    { key: "adjacent", title: "Adjacent domains" },
    { key: "entry", title: "Could enter at junior level" },
  ];
  return (
    <div className="space-y-5">
      <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cols.map((c) => (
          <motion.div key={c.key} variants={popIn}>
            <Card className="h-full">
              <CardHeader title={<span className="flex items-center gap-2">{c.title} <Badge tone={c.tone}>{p.skills[c.key].length}</Badge></span>} subtitle={c.hint} />
              <div className="p-4">
                <ChipInput values={p.skills[c.key]} onChange={(v) => set({ skills: { ...p.skills, [c.key]: v } })} tone={c.tone} placeholder="Add a skill…" />
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
      <Card>
        <CardHeader title="Experience domains" subtitle="Matched on the nature of the work, not job titles" icon={<Briefcase className="h-4 w-4" />} />
        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-3">
          {domains.map((d) => (
            <Field key={d.key} label={d.title}>
              {() => <ChipInput values={p.domains[d.key]} onChange={(v) => set({ domains: { ...p.domains, [d.key]: v } })} />}
            </Field>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Experience

function ExperienceSection({ profile: p, set }: SectionProps) {
  const updateExp = (id: string, patch: Partial<Profile["experience"][number]>) => set({ experience: p.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const updateEdu = (id: string, patch: Partial<Profile["education"][number]>) => set({ education: p.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Work experience"
          subtitle="One bullet per line. Include tools, scope and measurable results."
          icon={<Briefcase className="h-4 w-4" />}
          action={
            <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => set({ experience: [{ id: uid("exp"), title: "", company: "", location: "", start: "", end: "", bullets: [] }, ...p.experience] })}>
              Add role
            </Button>
          }
        />
        <div className="space-y-4 p-5">
          <AnimatePresence initial={false}>
            {p.experience.map((e) => (
              <motion.div key={e.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, scale: 0.95 }} className="overflow-hidden">
                <div className="relative rounded-2xl border border-line p-4 pl-6 before:absolute before:inset-y-4 before:left-0 before:w-1 before:rounded-full before:bg-brand-gradient">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                    <Input className="sm:col-span-2" placeholder="Title" value={e.title} onChange={(ev) => updateExp(e.id, { title: ev.target.value })} />
                    <Input className="sm:col-span-2" placeholder="Company" value={e.company} onChange={(ev) => updateExp(e.id, { company: ev.target.value })} />
                    <Input placeholder="Start" value={e.start} onChange={(ev) => updateExp(e.id, { start: ev.target.value })} />
                    <Input placeholder="End / Present" value={e.end} onChange={(ev) => updateExp(e.id, { end: ev.target.value })} />
                    <Input className="sm:col-span-6" placeholder="Location" value={e.location} onChange={(ev) => updateExp(e.id, { location: ev.target.value })} />
                    <Textarea className="sm:col-span-6" placeholder="What you did, one bullet per line" value={e.bullets.join("\n")} onChange={(ev) => updateExp(e.id, { bullets: ev.target.value.split("\n") })} onBlur={(ev) => updateExp(e.id, { bullets: ev.target.value.split("\n").map((b) => b.trim()).filter(Boolean) })} />
                  </div>
                  <button onClick={() => set({ experience: p.experience.filter((x) => x.id !== e.id) })} aria-label="Remove role" className="absolute right-3 top-3 rounded-lg p-1.5 text-subtle hover:bg-[color-mix(in_oklab,var(--critical)_12%,transparent)] hover:text-critical">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {p.experience.length === 0 && <p className="py-6 text-center text-sm text-muted">No roles yet. Import a CV or add one.</p>}
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Education"
            icon={<GraduationCap className="h-4 w-4" />}
            action={
              <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => set({ education: [...p.education, { id: uid("edu"), degree: "", institution: "", year: "", details: "" }] })}>
                Add
              </Button>
            }
          />
          <div className="space-y-3 p-5">
            {p.education.map((e) => (
              <motion.div key={e.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-6 gap-2">
                <Input className="col-span-3" placeholder="Degree" value={e.degree} onChange={(ev) => updateEdu(e.id, { degree: ev.target.value })} />
                <Input className="col-span-2" placeholder="Institution" value={e.institution} onChange={(ev) => updateEdu(e.id, { institution: ev.target.value })} />
                <div className="flex gap-1">
                  <Input placeholder="Year" value={e.year} onChange={(ev) => updateEdu(e.id, { year: ev.target.value })} />
                </div>
                <Input className="col-span-5" placeholder="Details (honours, thesis…)" value={e.details} onChange={(ev) => updateEdu(e.id, { details: ev.target.value })} />
                <button onClick={() => set({ education: p.education.filter((x) => x.id !== e.id) })} aria-label="Remove education" className="grid place-items-center rounded-lg text-subtle hover:text-critical">
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Certifications & languages" icon={<BookOpenCheck className="h-4 w-4" />} />
          <div className="space-y-4 p-5">
            <Field label="Certifications">{() => <ChipInput values={p.certifications} onChange={(certifications) => set({ certifications })} tone="neutral" />}</Field>
            <Field label="Languages" hint="Format: Language (level). The language gate compares postings against these levels.">
              {() => (
                <ChipInput
                  values={p.languages.map((l) => `${l.name} (${l.level})`)}
                  onChange={(vals) =>
                    set({
                      languages: vals.map((v) => {
                        const m = v.match(/^(.+?)\s*\((.+)\)\s*$/);
                        return m ? { name: m[1].trim(), level: m[2].trim() } : { name: v.trim(), level: "Professional" };
                      }),
                    })
                  }
                  tone="info"
                  placeholder="e.g. Tamil (Native)"
                />
              )}
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Motivation

function MotivationSection({ profile: p, set }: SectionProps) {
  const rows: { key: "careerGoals" | "energizing" | "draining" | "dealBreakers"; title: string; hint: string; tone: "brand" | "good" | "warning" | "critical" }[] = [
    { key: "careerGoals", title: "Career goals", hint: "Drives the career-alignment score", tone: "brand" },
    { key: "energizing", title: "Tasks that energise you", hint: "Not just what you can do, what you want to do", tone: "good" },
    { key: "draining", title: "Tasks that drain you", hint: "Lowers behavioral fit when a role is full of these", tone: "warning" },
    { key: "dealBreakers", title: "Deal-breakers", hint: "Hard vetoes, e.g. 'no relocation', 'minimum salary X'", tone: "critical" },
  ];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {rows.map((r, i) => (
        <motion.div key={r.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
          <Card className="h-full">
            <CardHeader title={r.title} subtitle={r.hint} />
            <div className="p-4">
              <ChipInput values={p[r.key]} onChange={(v) => set({ [r.key]: v })} tone={r.tone} />
            </div>
          </Card>
        </motion.div>
      ))}
      <Card className="lg:col-span-2">
        <CardHeader title="Job search setup" subtitle="Used to pre-fill the Job Search page" icon={<Target className="h-4 w-4" />} />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="Search queries">{() => <ChipInput values={p.searchQueries} onChange={(searchQueries) => set({ searchQueries })} placeholder="e.g. GST manager" />}</Field>
          </div>
          <Field label="Search location">{(id) => <Input id={id} value={p.searchLocation} onChange={(e) => set({ searchLocation: e.target.value })} placeholder="Chennai, Tamil Nadu, India" />}</Field>
          <div className="sm:col-span-3">
            <Field label="Behavioral notes" hint="How you work best, where you thrive, what causes friction">
              {(id) => <Textarea id={id} value={p.behavioral} onChange={(e) => set({ behavioral: e.target.value })} />}
            </Field>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ STAR stories

function StoriesSection({ profile: p, set }: SectionProps) {
  const update = (id: string, patch: Partial<Profile["starStories"][number]>) => set({ starStories: p.starStories.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const parts: { key: "situation" | "task" | "action" | "result"; letter: string; label: string }[] = [
    { key: "situation", letter: "S", label: "Situation" },
    { key: "task", letter: "T", label: "Task" },
    { key: "action", letter: "A", label: "Action" },
    { key: "result", letter: "R", label: "Result" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">Aim for 4-6 stories covering different competencies. Interview prep maps likely questions to these by title.</p>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => set({ starStories: [newStory(), ...p.starStories] })}>
          New story
        </Button>
      </div>
      <motion.div layout className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnimatePresence initial={false}>
          {p.starStories.map((s) => (
            <motion.div key={s.id} layout initial={{ opacity: 0, scale: 0.9, rotateX: 20 }} animate={{ opacity: 1, scale: 1, rotateX: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 260, damping: 26 }} style={{ transformPerspective: 1000 }}>
              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 shrink-0 text-warning" />
                  <Input value={s.title} placeholder="Story title" onChange={(e) => update(s.id, { title: e.target.value })} className="h-9 font-semibold" />
                  <Input value={s.skill} placeholder="Skill shown" onChange={(e) => update(s.id, { skill: e.target.value })} className="h-9 w-40" />
                  <button onClick={() => set({ starStories: p.starStories.filter((x) => x.id !== s.id) })} aria-label="Delete story" className="rounded-lg p-1.5 text-subtle hover:text-critical">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {parts.map((part) => (
                    <div key={part.key} className="flex gap-2">
                      <span className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-gradient text-xs font-bold text-white" title={part.label}>
                        {part.letter}
                      </span>
                      <Textarea value={s[part.key]} placeholder={part.label} onChange={(e) => update(s.id, { [part.key]: e.target.value })} className="min-h-12 text-xs" />
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      {p.starStories.length === 0 && <p className="py-10 text-center text-sm text-muted">No stories yet. Import a CV with AI, or write your first one.</p>}
      <SaveHint />
    </div>
  );
}

function SaveHint(): ReactNode {
  return (
    <p className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-subtle">
      <Save className="h-3 w-3" /> Changes save automatically to this browser.
    </p>
  );
}
