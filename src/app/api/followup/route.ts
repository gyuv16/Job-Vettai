import { z } from "zod";
import { handle, readJson, structured } from "@/lib/server/claude";
import { profileInput } from "@/lib/server/inputs";
import { profileBrief, system, WRITING_STYLE } from "@/lib/server/prompts";
import { FollowupSchema } from "@/lib/server/schemas";

export const maxDuration = 120;

const Body = z.object({
  profile: profileInput,
  kind: z.enum(["followup", "thankyou"]),
  application: z.object({
    company: z.string(),
    role: z.string(),
    contact: z.string(),
    appliedAt: z.string().nullable(),
    lastEvent: z.string(),
    submittedSummary: z.string().max(4000),
  }),
});

const TASK = `Draft a short, channel-appropriate message for a job application. A follow-up politely checks status after silence. A thank-you note follows an interview stage. Use only claims already present in the submitted materials summary or the profile. Under 120 words, no pressure, no grovelling. This is a draft for the candidate to send themselves.`;

export const POST = handle(async (req) => {
  const { profile, kind, application: a } = await readJson(req, Body);
  return structured({
    req,
    schema: FollowupSchema,
    system: system(TASK),
    user: `${WRITING_STYLE}\n\nKind: ${kind}\nCompany: ${a.company}\nRole: ${a.role}\nContact: ${a.contact || "(unknown, use the hiring team)"}\nApplied: ${a.appliedAt ?? "unknown"}\nLatest event: ${a.lastEvent}\nSubmitted materials summary: ${a.submittedSummary || "(none recorded)"}\n\n${profileBrief(profile)}`,
    effort: "low",
  });
});
