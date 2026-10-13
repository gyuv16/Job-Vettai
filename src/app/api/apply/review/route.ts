import { z } from "zod";
import { handle, readJson, structured } from "@/lib/server/claude";
import { coverInput, cvInput, evaluationInput, postingInput, profileInput } from "@/lib/server/inputs";
import { postingBlock, profileBrief, system, WRITING_STYLE } from "@/lib/server/prompts";
import { ReviewSchema } from "@/lib/server/schemas";

export const maxDuration = 300;

const Body = z.object({ profile: profileInput, posting: postingInput, evaluation: evaluationInput, cv: cvInput, coverLetter: coverInput });

const TASK = `You are the REVIEWER: a hiring-manager proxy with a fresh pair of eyes. Critique the drafts to make the application as targeted and compelling as possible. Check: keyword coverage against the posting's own terms; whether every stated requirement is addressed (matched or honestly bridged); generic or cliched language; claims that fail the interview backtrack test or are not grounded in the profile (list them as stretch flags); company claims not supported by the posting; violations of the writing rules; whether the CV fits two pages and the letter one page. Be specific: every issue gets a concrete fix.`;

export const POST = handle(async (req) => {
  const { profile, posting, evaluation, cv, coverLetter } = await readJson(req, Body);
  return structured({
    req,
    schema: ReviewSchema,
    system: system(TASK),
    user: `${WRITING_STYLE}\n\n${profileBrief(profile)}\n\n# Keywords and requirements\n${JSON.stringify({ keywords: evaluation.keywords, requirements: evaluation.requirements })}\n\n# Job posting\n${postingBlock(posting.text, posting)}\n\n# CV draft\n${JSON.stringify(cv)}\n\n# Cover letter draft\n${JSON.stringify(coverLetter)}`,
    effort: "medium",
  });
});
