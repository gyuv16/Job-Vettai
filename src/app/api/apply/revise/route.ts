import { z } from "zod";
import { handle, readJson } from "@/lib/server/claude";
import { structured } from "@/lib/server/llm";
import { coverInput, cvInput, postingInput, profileInput, reviewInput } from "@/lib/server/inputs";
import { postingBlock, profileBrief, system, WRITING_STYLE } from "@/lib/server/prompts";
import { DraftSchema } from "@/lib/server/schemas";

export const maxDuration = 300;

const Body = z.object({ profile: profileInput, posting: postingInput, cv: cvInput, coverLetter: coverInput, review: reviewInput });

const TASK = `You are the DRAFTER again. Revise the CV and cover letter using the reviewer's critique. Apply every fix that keeps the documents truthful to the profile. For each stretch flag, soften or remove the claim rather than defending it. Add a missing keyword only where the profile genuinely supports it; a keyword the profile does not support stays a gap. In the changelog, list what changed and any review point you deliberately did not apply, with the reason.`;

export const POST = handle(async (req) => {
  const { profile, posting, cv, coverLetter, review } = await readJson(req, Body);
  return structured({
    req,
    schema: DraftSchema,
    system: system(TASK),
    user: `${WRITING_STYLE}\n\n${profileBrief(profile)}\n\n# Job posting\n${postingBlock(posting.text, posting)}\n\n# Current CV\n${JSON.stringify(cv)}\n\n# Current cover letter\n${JSON.stringify(coverLetter)}\n\n# Reviewer critique\n${JSON.stringify(review)}`,
    effort: "medium",
  });
});
