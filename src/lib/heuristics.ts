// Heuristic ("no API key") engine. It keeps every page usable without an
// Anthropic key by scoring with keyword overlap and drafting from templates.
// It is honest about being a heuristic: every result carries mode: "heuristic".

import {
  extractSkills,
  mentions,
  overallScore,
  requiredLanguages,
  SKILL_VOCAB,
  today,
  uid,
  verdictFor,
} from "./framework";
import type {
  Application,
  CoverLetter,
  CvDoc,
  DimensionScores,
  Drafts,
  Evaluation,
  Gate,
  InterviewPack,
  Job,
  Profile,
  RankResult,
  RequirementCheck,
  SkillGap,
  UpskillReport,
} from "./types";

function profileText(p: Profile): string {
  return [
    p.headline,
    p.summary,
    ...p.skills.strong,
    ...p.skills.moderate,
    ...p.domains.direct,
    ...p.domains.adjacent,
    ...p.experience.flatMap((e) => [e.title, e.company, ...e.bullets]),
    ...p.education.map((e) => `${e.degree} ${e.details}`),
    ...p.certifications,
  ].join("\n");
}

function postingSkills(text: string, p: Profile): string[] {
  const vocab = new Set([...SKILL_VOCAB, ...p.skills.strong, ...p.skills.moderate, ...p.skills.weak]);
  return extractSkills(text, [...vocab]);
}

function languageGate(text: string, p: Profile): { verdict: Gate; note: string } {
  const req = requiredLanguages(text);
  const declared = p.languages.map((l) => l.name.toLowerCase());
  const missing = req.filter((l) => !declared.includes(l.toLowerCase()));
  if (missing.length) return { verdict: "FAIL", note: `Posting asks for ${missing.join(", ")}, which is not in your Languages table.` };
  return { verdict: "PASS", note: "" };
}

function locationGate(text: string, location: string, p: Profile): { verdict: Gate; note: string } {
  const t = `${text}\n${location}`.toLowerCase();
  if (/relocat(e|ion) (is )?(required|mandatory)|must relocate/.test(t) && !p.willingToRelocate) {
    return { verdict: "FAIL", note: "Requires relocation." };
  }
  if (/(extensive|frequent|\d{2}%\s*)travel/.test(t)) return { verdict: "FLAG", note: "Mentions frequent travel." };
  if (p.preferredWorkMode === "remote" && /on-?site only|no remote|5 days (in|from) (the )?office/.test(t)) {
    return { verdict: "FLAG", note: "Looks on-site only; you prefer remote." };
  }
  return { verdict: "PASS", note: "" };
}

function deadlineFrom(text: string): string | null {
  const m = text.match(/(deadline|apply by|closing date|last date)[^0-9]{0,20}(\d{4}-\d{2}-\d{2})/i);
  return m ? m[2] : null;
}

function scoreDims(text: string, title: string, p: Profile): {
  scores: DimensionScores;
  matched: string[];
  missing: string[];
} {
  const wanted = postingSkills(`${title}\n${text}`, p);
  const strong = new Set(p.skills.strong.map((s) => s.toLowerCase()));
  const moderate = new Set(p.skills.moderate.map((s) => s.toLowerCase()));
  const pText = profileText(p);
  let pts = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of wanted) {
    const k = s.toLowerCase();
    if (strong.has(k)) {
      pts += 1;
      matched.push(s);
    } else if (moderate.has(k) || mentions(pText, s)) {
      pts += 0.6;
      matched.push(s);
    } else missing.push(s);
  }
  const technical = wanted.length ? 25 + (pts / wanted.length) * 70 : 50;

  const titleWords = title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  const pastTitles = p.experience.map((e) => e.title.toLowerCase()).join(" ");
  const titleHits = titleWords.filter((w) => pastTitles.includes(w)).length;
  const domainHit = p.domains.direct.some((d) => mentions(text, d) || mentions(title, d));
  const adjacentHit = p.domains.adjacent.some((d) => mentions(text, d) || mentions(title, d));
  const experience = Math.min(95, 35 + titleHits * 15 + (domainHit ? 25 : adjacentHit ? 12 : 0));

  const energy = p.energizing.filter((e) => e.split(/\s+/).some((w) => w.length > 4 && mentions(text, w))).length;
  const drain = p.draining.filter((e) => e.split(/\s+/).some((w) => w.length > 4 && mentions(text, w))).length;
  const behavioral = Math.max(20, Math.min(90, 60 + energy * 8 - drain * 10));

  const goalHits = p.careerGoals.filter((g) => g.split(/\s+/).some((w) => w.length > 4 && mentions(`${title} ${text}`, w))).length;
  const career = Math.max(25, Math.min(92, 45 + goalHits * 15 + (domainHit ? 10 : 0)));

  return {
    scores: {
      technical: Math.round(technical),
      experience: Math.round(experience),
      behavioral: Math.round(behavioral),
      career: Math.round(career),
    },
    matched,
    missing,
  };
}

export function heuristicRank(p: Profile, job: Job): RankResult {
  const text = job.description ?? "";
  const { scores, matched, missing } = scoreDims(text, job.title, p);
  const overall = overallScore(scores);
  const lg = languageGate(text, p);
  const loc = locationGate(text, job.location, p);
  return {
    scores,
    overall,
    verdict: verdictFor(overall),
    locationVerdict: loc.verdict,
    languageGate: lg.verdict,
    languageNote: lg.note || loc.note,
    strengths: matched.length ? [`Posting asks for ${matched.slice(0, 4).join(", ")} - all on your profile.`] : ["Title overlaps with your experience."],
    gaps: missing.length ? [`Not on your profile yet: ${missing.slice(0, 4).join(", ")}.`] : text ? [] : ["No posting text was available, so this is a title-only estimate."],
    deadline: deadlineFrom(text),
    rankedAt: today(),
    mode: "heuristic",
  };
}

export function heuristicEvaluate(p: Profile, text: string, meta: { company: string; role: string; location: string }): Evaluation {
  const { scores, matched, missing } = scoreDims(text, meta.role, p);
  const overall = overallScore(scores);
  const requirements: RequirementCheck[] = [
    ...matched.map((s) => ({ requirement: s, status: "match" as const, evidence: "Listed in your skills." })),
    ...missing.map((s) => ({ requirement: s, status: "gap" as const, evidence: "Not found in your profile." })),
  ];
  return {
    company: meta.company || "Unknown company",
    role: meta.role || "Role",
    location: meta.location,
    department: "",
    deadline: deadlineFrom(text),
    postingLanguage: "English",
    eligibility: { verdict: "UNVERIFIED", note: "Heuristic mode cannot read eligibility clauses reliably. Check the posting." },
    languageGate: languageGate(text, p),
    locationGate: locationGate(text, meta.location, p),
    technical: { score: scores.technical, note: `${matched.length} of ${matched.length + missing.length} detected skills match.` },
    experience: { score: scores.experience, note: "Based on title and domain overlap." },
    behavioral: { score: scores.behavioral, note: "Based on energising vs draining task keywords." },
    career: { score: scores.career, note: "Based on overlap with your career goals." },
    overall,
    verdict: verdictFor(overall),
    strengths: matched.slice(0, 5).map((s) => `${s} is a skill you already have.`),
    gaps: missing.slice(0, 5).map((s) => `${s} is asked for but not on your profile.`),
    recommendation: "Heuristic estimate only. Add an Anthropic API key in Settings for a full evaluation.",
    keywords: [...matched, ...missing].slice(0, 20),
    requirements,
    callQuestions: [],
    mode: "heuristic",
  };
}

export function heuristicDrafts(p: Profile, ev: Evaluation): Drafts {
  const keywords = new Set(ev.keywords.map((k) => k.toLowerCase()));
  const skillGroups = [
    { group: "Core skills", items: p.skills.strong },
    { group: "Also working with", items: p.skills.moderate },
  ].filter((g) => g.items.length);
  const sortBullets = (bullets: string[]) =>
    [...bullets].sort((a, b) => {
      const sa = [...keywords].filter((k) => mentions(a, k)).length;
      const sb = [...keywords].filter((k) => mentions(b, k)).length;
      return sb - sa;
    });
  const cv: CvDoc = {
    headline: p.headline || ev.role,
    summary: p.summary,
    skillGroups,
    experience: p.experience.map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location,
      period: `${e.start} – ${e.end || "Present"}`,
      bullets: sortBullets(e.bullets),
    })),
    education: p.education.map((e) => ({ degree: e.degree, institution: e.institution, year: e.year, details: e.details })),
    certifications: p.certifications,
    languages: p.languages.map((l) => `${l.name} (${l.level})`),
  };
  const top = ev.requirements.filter((r) => r.status === "match").slice(0, 4);
  const letter: CoverLetter = {
    subject: `${p.headline || "Application"}: ${ev.role}`,
    greeting: "Dear Hiring Manager,",
    paragraphs: [
      `I am applying for the ${ev.role} position at ${ev.company}. ${p.summary ? p.summary.split(".")[0] + "." : ""}`.trim(),
      p.experience[0]
        ? `In my current role as ${p.experience[0].title} at ${p.experience[0].company}, ${p.experience[0].bullets[0] ? p.experience[0].bullets[0].replace(/^[A-Z]/, (c) => c.toLowerCase()) : "I deliver work closely aligned with this role"}`
        : "My background maps closely to the work described in your posting.",
      `I would welcome the chance to discuss how I can contribute to ${ev.company}.`,
    ],
    bullets: top.map((r) => `${r.requirement}: ${r.evidence}`),
    closing: "Kind regards,",
    signature: p.name,
  };
  return {
    cv,
    coverLetter: letter,
    review: null,
    changelog: ["Template draft generated without AI. Add an API key for tailored drafting, a reviewer pass and revision."],
    stage: "draft",
    mode: "heuristic",
    updatedAt: new Date().toISOString(),
  };
}

export function heuristicInterview(p: Profile, app: Application): InterviewPack {
  const gaps = app.evaluation?.gaps ?? [];
  return {
    stage: "First interview",
    companyBrief: [`Research ${app.company}: website, recent news, products, and team on LinkedIn.`],
    roleFocus: (app.evaluation?.keywords ?? []).slice(0, 6),
    questions: [
      { question: `Why ${app.company}, and why this ${app.role} role?`, category: "motivation", why: "Asked in nearly every first interview.", outline: "Connect one specific fact about the company to one specific thing you want to build next.", starStory: "" },
      { question: "Walk me through your background.", category: "behavioral", why: "Opening question.", outline: "90 seconds: current role, two achievements that map to this role, why now.", starStory: "" },
      ...p.starStories.slice(0, 4).map((s) => ({
        question: `Tell me about a time you used ${s.skill || "this skill"}.`,
        category: "behavioral" as const,
        why: `Tests ${s.skill}.`,
        outline: `S: ${s.situation} T: ${s.task} A: ${s.action} R: ${s.result}`,
        starStory: s.title,
      })),
      { question: "What is your biggest weakness?", category: "behavioral", why: "Self-awareness check.", outline: "A real weakness plus the concrete habit you use to manage it.", starStory: "" },
    ],
    gapBridges: gaps.map((g) => ({ gap: g, answer: "Acknowledge it plainly, point to the closest adjacent experience, and say how you are closing it." })),
    questionsToAsk: [
      "What would success look like in the first six months?",
      "What is the biggest challenge the team is facing right now?",
      "How is time split between new work and maintenance?",
      "How do you onboard new team members?",
    ],
    checklist: ["Re-read the posting and your submitted CV", "Prepare 4-6 STAR stories", "Test your video setup", "Prepare two questions about the team"],
    mode: "heuristic",
    createdAt: new Date().toISOString(),
  };
}

export interface UpskillSource {
  label: string;
  score: number | null;
  gaps: string[];
  excerpt: string;
}

export function heuristicUpskill(p: Profile, sources: UpskillSource[]): UpskillReport {
  const counts = new Map<string, { n: number; weight: number; evidence: string[] }>();
  const add = (skill: string, weight: number, ev: string) => {
    const k = skill.trim();
    if (!k) return;
    const cur = counts.get(k) ?? { n: 0, weight: 0, evidence: [] };
    cur.n += 1;
    cur.weight += weight;
    if (cur.evidence.length < 3) cur.evidence.push(ev);
    counts.set(k, cur);
  };
  const have = new Set([...p.skills.strong, ...p.skills.moderate].map((s) => s.toLowerCase()));
  const pText = profileText(p);
  for (const s of sources) {
    // Weight each job by (100 - fit) / 100, so poorly matched roles expose more gaps.
    const weight = (100 - (s.score ?? 50)) / 100;
    for (const skill of postingSkills(`${s.label}\n${s.excerpt}\n${s.gaps.join("\n")}`, p)) {
      if (!have.has(skill.toLowerCase()) && !mentions(pText, skill)) add(skill, weight, s.label);
    }
  }
  const weak = new Set(p.skills.weak.map((s) => s.toLowerCase()));
  const max = Math.max(1, ...[...counts.values()].map((c) => c.weight));
  const gaps: SkillGap[] = [...counts.entries()]
    .map(([skill, c]) => ({
      skill,
      category: "Detected in postings",
      demand: Math.round((c.weight / max) * 100),
      currentLevel: (weak.has(skill.toLowerCase()) ? "basic" : "none") as SkillGap["currentLevel"],
      priority: 0,
      evidence: c.evidence,
    }))
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 16)
    .map((g, i) => ({ ...g, priority: Math.min(5, Math.floor(i / 3) + 1) }));
  const top = gaps.slice(0, 6).map((g) => g.skill);
  return {
    summary: gaps.length
      ? `Across ${sources.length} postings, the most frequent skills you do not list yet are ${top.slice(0, 3).join(", ")}.`
      : "Not enough ranked or tracked postings to find gaps yet. Rank some jobs first.",
    gaps,
    plan: top.length
      ? [
          { phase: "Foundations", weeks: 2, focus: "Close the most frequent gap", skills: top.slice(0, 2), resources: top.slice(0, 2).map((s) => ({ title: `${s} fundamentals`, provider: "Official docs / free course", type: "course", free: true })), milestone: `Build one small project using ${top[0]}.` },
          { phase: "Applied practice", weeks: 3, focus: "Use the skills on realistic work", skills: top.slice(2, 4), resources: top.slice(2, 4).map((s) => ({ title: `${s} hands-on guide`, provider: "Free tutorial", type: "tutorial", free: true })), milestone: "Add the project to your profile and CV." },
          { phase: "Proof", weeks: 2, focus: "Make it visible", skills: top.slice(4, 6), resources: [{ title: "Write a short case study of your project", provider: "Your blog / LinkedIn", type: "practice", free: true }], milestone: "Re-run ranking to see your scores move." },
        ]
      : [],
    quickWins: top.slice(0, 3).map((s) => `If you have used ${s} at all, add it to your Moderate skills so the scorer can see it.`),
    sourceCount: sources.length,
    mode: "heuristic",
    createdAt: new Date().toISOString(),
  };
}

/** Pull obvious fields out of pasted CV text when no AI key is available. */
export function heuristicProfileFromText(text: string): Partial<Profile> {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? "";
  const phone = text.match(/(\+?\d[\d\s-]{8,}\d)/)?.[0]?.trim() ?? "";
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l && !l.includes("@") && l.length < 60) ?? "";
  const skills = extractSkills(text);
  const links = [...text.matchAll(/https?:\/\/[^\s)]+/g)].map((m) => m[0]).slice(0, 5);
  return {
    name: firstLine,
    email,
    phone,
    links,
    skills: { strong: skills.slice(0, 10), moderate: skills.slice(10, 20), weak: [] },
    summary: text.split("\n").find((l) => l.trim().length > 80)?.trim() ?? "",
    updatedAt: new Date().toISOString(),
  } satisfies Partial<Profile>;
}

export function newStory(): Profile["starStories"][number] {
  return { id: uid("star"), title: "", skill: "", situation: "", task: "", action: "", result: "", useFor: [] };
}
