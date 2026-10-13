import "server-only";

import { z } from "zod";

// Structured-output schemas for each AI task. Numbers are clamped and the
// weighted overall score is recomputed in code, never trusted from the model.

const gate = z.enum(["PASS", "FAIL", "FLAG"]);

export const ProfileSchema = z.object({
  name: z.string(),
  headline: z.string().describe("Short professional headline, e.g. 'Chartered Accountant | Direct & Indirect Tax'"),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  links: z.array(z.string()),
  summary: z.string().describe("3-4 sentence professional summary grounded in the CV"),
  skills: z.object({
    strong: z.array(z.string()).describe("Primary skills used repeatedly and recently"),
    moderate: z.array(z.string()).describe("Secondary skills with some real use"),
    weak: z.array(z.string()).describe("Skills mentioned only in passing, or adjacent gaps"),
  }),
  domains: z.object({
    direct: z.array(z.string()).describe("Domains / role types with direct experience"),
    adjacent: z.array(z.string()),
    entry: z.array(z.string()).describe("Role types the candidate could enter at a junior level"),
  }),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string(),
      start: z.string(),
      end: z.string().describe("End date or 'Present'"),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(z.object({ degree: z.string(), institution: z.string(), year: z.string(), details: z.string() })),
  certifications: z.array(z.string()),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  careerGoals: z.array(z.string()).describe("Inferred only when the CV states them; otherwise empty"),
  starStories: z
    .array(
      z.object({
        title: z.string(),
        skill: z.string(),
        situation: z.string(),
        task: z.string(),
        action: z.string(),
        result: z.string(),
        useFor: z.array(z.string()),
      }),
    )
    .describe("2-5 STAR stories built only from achievements in the CV"),
  searchQueries: z.array(z.string()).describe("5-8 job search queries suited to this profile"),
});

export const RankItemSchema = z.object({
  key: z.string(),
  status: z.enum(["scored", "expired"]),
  technical: z.number(),
  experience: z.number(),
  behavioral: z.number(),
  career: z.number(),
  locationVerdict: gate,
  languageGate: gate,
  languageNote: z.string().describe("Posting requirement + declared level, only when FLAG or FAIL; else empty"),
  deadline: z.string().describe("YYYY-MM-DD if the posting states one, else empty"),
  strengths: z.array(z.string()).describe("1-3 bullets grounded in the posting text"),
  gaps: z.array(z.string()).describe("1-3 honest bullets"),
});

export const RankSchema = z.object({ results: z.array(RankItemSchema) });

const dim = z.object({ score: z.number(), note: z.string() });

export const EvaluationSchema = z.object({
  company: z.string(),
  role: z.string(),
  location: z.string(),
  department: z.string(),
  deadline: z.string().describe("YYYY-MM-DD or empty"),
  postingLanguage: z.string(),
  eligibility: z.object({ verdict: z.enum(["PASS", "FAIL", "UNVERIFIED"]), note: z.string() }),
  languageGate: z.object({ verdict: gate, note: z.string() }),
  locationGate: z.object({ verdict: gate, note: z.string() }),
  technical: dim,
  experience: dim,
  behavioral: dim,
  career: dim,
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendation: z.string().describe("1-2 sentences: apply / skip / apply with caveats"),
  keywords: z.array(z.string()).describe("10-25 ATS keywords and named requirements, using the posting's own terms"),
  requirements: z.array(
    z.object({
      requirement: z.string(),
      status: z.enum(["match", "partial", "gap"]),
      evidence: z.string().describe("Where the profile supports it, or why it is a gap"),
    }),
  ),
  callQuestions: z.array(z.string()).describe("Substantive questions worth calling the contact about; empty if none"),
});

export const CvSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  skillGroups: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  experience: z.array(
    z.object({ title: z.string(), company: z.string(), location: z.string(), period: z.string(), bullets: z.array(z.string()) }),
  ),
  education: z.array(z.object({ degree: z.string(), institution: z.string(), year: z.string(), details: z.string() })),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
});

export const CoverSchema = z.object({
  subject: z.string().describe("Specific headline: [title/education] + [keyword from posting]"),
  greeting: z.string(),
  paragraphs: z.array(z.string()),
  bullets: z.array(z.string()),
  closing: z.string(),
  signature: z.string(),
});

export const DraftSchema = z.object({ cv: CvSchema, coverLetter: CoverSchema, changelog: z.array(z.string()) });

export const ReviewSchema = z.object({
  impression: z.string(),
  strengths: z.array(z.string()),
  issues: z.array(
    z.object({
      severity: z.enum(["high", "medium", "low"]),
      document: z.enum(["cv", "cover_letter"]),
      issue: z.string(),
      fix: z.string(),
    }),
  ),
  missingKeywords: z.array(z.string()),
  stretchFlags: z.array(z.object({ claim: z.string(), why: z.string() })),
});

export const InterviewSchema = z.object({
  companyBrief: z.array(z.string()),
  roleFocus: z.array(z.string()),
  questions: z.array(
    z.object({
      question: z.string(),
      category: z.enum(["behavioral", "technical", "motivation", "gap", "culture"]),
      why: z.string(),
      outline: z.string(),
      starStory: z.string().describe("Title of the STAR story to use, or empty"),
    }),
  ),
  gapBridges: z.array(z.object({ gap: z.string(), answer: z.string() })),
  questionsToAsk: z.array(z.string()),
  checklist: z.array(z.string()),
});

export const UpskillSchema = z.object({
  summary: z.string(),
  gaps: z.array(
    z.object({
      skill: z.string(),
      category: z.string(),
      demand: z.number().describe("0-100 weighted demand across postings"),
      currentLevel: z.enum(["none", "basic", "working", "strong"]),
      priority: z.number().describe("1 (highest) to 5"),
      evidence: z.array(z.string()).describe("Which postings asked for it"),
    }),
  ),
  plan: z.array(
    z.object({
      phase: z.string(),
      weeks: z.number(),
      focus: z.string(),
      skills: z.array(z.string()),
      resources: z.array(z.object({ title: z.string(), provider: z.string(), type: z.string(), free: z.boolean() })),
      milestone: z.string(),
    }),
  ),
  quickWins: z.array(z.string()),
});

export const FollowupSchema = z.object({ subject: z.string(), message: z.string(), channel: z.string(), timing: z.string() });
