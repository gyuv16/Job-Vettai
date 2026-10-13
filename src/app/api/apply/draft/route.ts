import { z } from "zod";
import { handle, readJson, structured } from "@/lib/server/claude";
import { evaluationInput, postingInput, profileInput } from "@/lib/server/inputs";
import { postingBlock, profileBrief, system, WRITING_STYLE } from "@/lib/server/prompts";
import { DraftSchema } from "@/lib/server/schemas";

export const maxDuration = 300;

const Body = z.object({ profile: profileInput, posting: postingInput, evaluation: evaluationInput });

const TASK = `You are the DRAFTER in a drafter-reviewer workflow. Write a tailored CV and cover letter for the posting. The candidate profile is the sole source of truth for facts: reorder, select and reframe emphasis, but never add employers, dates, metrics, tools or credentials that are not in it. Before finishing, run a grounding audit: check every bullet's dates, roles and numbers against the profile. Write the cover letter in the posting's language. In the changelog, list the main tailoring decisions and any requirement you bridged rather than matched.`;

export const POST = handle(async (req) => {
  const { profile, posting, evaluation } = await readJson(req, Body);
  return structured({
    req,
    schema: DraftSchema,
    system: system(TASK),
    user: `${WRITING_STYLE}\n\n${profileBrief(profile)}\n\n# Evaluation from step 1\n${JSON.stringify({ role: evaluation.role, company: evaluation.company, strengths: evaluation.strengths, gaps: evaluation.gaps, keywords: evaluation.keywords, requirements: evaluation.requirements })}\n\n# Job posting\n${postingBlock(posting.text, posting)}`,
    effort: "medium",
  });
});
