import { z } from "zod";
import { clampScore, isIsoDate, overallScore, today, verdictFor } from "@/lib/framework";
import { handle, readJson } from "@/lib/server/claude";
import { structured } from "@/lib/server/llm";
import { profileInput } from "@/lib/server/inputs";
import { FRAMEWORK, profileBrief, system, untrusted } from "@/lib/server/prompts";
import { RankSchema } from "@/lib/server/schemas";
import { linkedInDetail } from "@/lib/server/sources";
import type { RankResult } from "@/lib/types";

export const maxDuration = 300;

const Body = z.object({
  profile: profileInput,
  jobs: z
    .array(
      z.object({
        key: z.string(),
        title: z.string(),
        company: z.string(),
        location: z.string(),
        url: z.string(),
        description: z.string().nullable(),
      }),
    )
    .min(1)
    .max(6),
});

const TASK = `Triage-score job postings against the candidate's profile using the framework below. This is triage from the posting text only: no company research. Score only from the posting text you are given; if a posting is empty or clearly closed, return status "expired" with zero scores rather than guessing from the title.`;

export const POST = handle(async (req) => {
  const started = Date.now();
  const { profile, jobs } = await readJson(req, Body);

  // Hydrate LinkedIn cards (search results carry no description) like /rank's fetch step.
  const hydrated = await Promise.all(
    jobs.map(async (j) => {
      if (j.description || !j.key.startsWith("linkedin:")) return { ...j, closed: false };
      const d = await linkedInDetail(j.key.slice("linkedin:".length)).catch(() => null);
      return { ...j, description: d?.text ?? null, closed: d ? !d.active : true };
    }),
  );

  const scorable = hydrated.filter((j) => j.description && !j.closed);
  const expired = hydrated.filter((j) => !j.description || j.closed).map((j) => ({ key: j.key, expired: true as const, description: null }));

  let scored: Array<{ key: string; expired: boolean; rank?: RankResult; description: string | null }> = [];
  if (scorable.length) {
    const postings = scorable
      .map((j, i) => `## Posting ${i + 1}\nkey: ${j.key}\nTitle: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location}\n${untrusted("job_posting", (j.description ?? "").slice(0, 7000))}`)
      .join("\n\n");
    const out = await structured({
      req,
      schema: RankSchema,
      system: system(TASK),
      user: `${FRAMEWORK}\n\n${profileBrief(profile)}\n\n# Postings to score (return one result per key)\n${postings}`,
      effort: "low",
      budgetMs: 270_000 - (Date.now() - started), // LinkedIn hydration above already used part of maxDuration
    });
    const byKey = new Map(out.results.map((r) => [r.key, r]));
    // Positional fallback if the model mangled a key; a job with no result is reported unscored, never expired.
    const positional = out.results.length === scorable.length;
    scored = scorable.map((j, i) => {
      const r = byKey.get(j.key) ?? (positional ? out.results[i] : undefined);
      if (!r) return { key: j.key, expired: false, description: j.description };
      if (r.status === "expired") return { key: j.key, expired: true, description: j.description };
      const scores = {
        technical: clampScore(r.technical),
        experience: clampScore(r.experience),
        behavioral: clampScore(r.behavioral),
        career: clampScore(r.career),
      };
      const overall = overallScore(scores);
      return {
        key: j.key,
        expired: false,
        description: j.description,
        rank: {
          scores,
          overall,
          verdict: verdictFor(overall),
          locationVerdict: r.locationVerdict,
          languageGate: r.languageGate,
          languageNote: r.languageNote,
          strengths: r.strengths.slice(0, 3),
          gaps: r.gaps.slice(0, 3),
          deadline: isIsoDate(r.deadline) ? r.deadline : null,
          rankedAt: today(),
          mode: "ai",
        },
      };
    });
  }
  return { results: [...scored, ...expired] };
});
