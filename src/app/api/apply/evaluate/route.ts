import { z } from "zod";
import { clampScore, isIsoDate, overallScore, verdictFor } from "@/lib/framework";
import { handle, readJson, structured } from "@/lib/server/claude";
import { postingInput, profileInput } from "@/lib/server/inputs";
import { FRAMEWORK, postingBlock, profileBrief, system } from "@/lib/server/prompts";
import { EvaluationSchema } from "@/lib/server/schemas";
import type { Evaluation } from "@/lib/types";

export const maxDuration = 300;

const Body = z.object({ profile: profileInput, posting: postingInput });

const TASK = `Evaluate one job posting against the candidate's profile, as the first step of a drafter-reviewer application workflow. Extract the company, role, department, location, deadline and posting language. Run the gates, score the four dimensions with a one-line note each, list strengths and honest gaps, and map every stated requirement to match / partial / gap with evidence from the profile. Suggest call-the-employer questions only when the posting is genuinely ambiguous.`;

export const POST = handle(async (req) => {
  const { profile, posting } = await readJson(req, Body);
  const r = await structured({
    req,
    schema: EvaluationSchema,
    system: system(TASK),
    user: `${FRAMEWORK}\n\n${profileBrief(profile)}\n\n# Job posting\n${postingBlock(posting.text, posting)}`,
    effort: "medium",
  });
  const fix = (d: { score: number; note: string }) => ({ score: clampScore(d.score), note: d.note });
  const technical = fix(r.technical);
  const experience = fix(r.experience);
  const behavioral = fix(r.behavioral);
  const career = fix(r.career);
  const overall = overallScore({ technical: technical.score, experience: experience.score, behavioral: behavioral.score, career: career.score });
  const evaluation: Evaluation = {
    ...r,
    deadline: isIsoDate(r.deadline) ? r.deadline : null,
    technical,
    experience,
    behavioral,
    career,
    overall,
    verdict: verdictFor(overall),
    mode: "ai",
  };
  return evaluation;
});
