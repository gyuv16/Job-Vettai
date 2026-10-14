import { z } from "zod";
import { handle, readJson } from "@/lib/server/claude";
import { structured } from "@/lib/server/llm";
import { profileInput } from "@/lib/server/inputs";
import { postingBlock, profileBrief, system } from "@/lib/server/prompts";
import { InterviewSchema } from "@/lib/server/schemas";

export const maxDuration = 300;

const Body = z.object({
  profile: profileInput,
  stage: z.string().max(100),
  application: z.object({
    company: z.string(),
    role: z.string(),
    postingText: z.string().max(60000),
    gaps: z.array(z.string()).default([]),
    submittedCv: z.string().max(30000).default(""),
    history: z.array(z.string()).default([]),
  }),
});

const TASK = `Build a stage-specific interview prep pack for a tracked application. Ground everything in the posting, the CV the interviewer actually read, and the candidate profile. Map likely questions to the candidate's STAR stories by title. For each gap, write an honest bridge answer: acknowledge it, point to the closest real adjacent experience, say how it is being closed. Never invent experience. The company brief may only use facts stated in the posting; mark anything else as "to verify".`;

export const POST = handle(async (req) => {
  const { profile, stage, application: a } = await readJson(req, Body);
  return structured({
    req,
    schema: InterviewSchema,
    system: system(TASK),
    user: `Interview stage: ${stage}\nCompany: ${a.company}\nRole: ${a.role}\nKnown gaps from evaluation: ${a.gaps.join("; ") || "(none)"}\nHistory so far: ${a.history.join(" | ") || "(none)"}\n\n${profileBrief(profile)}\n\n# Submitted CV\n${a.submittedCv || "(not recorded)"}\n\n# Job posting\n${postingBlock(a.postingText || "(posting text not saved)")}`,
    effort: "medium",
  });
});
