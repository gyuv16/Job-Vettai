import { z } from "zod";
import { handle, readJson } from "@/lib/server/claude";
import { structured } from "@/lib/server/llm";
import { profileInput } from "@/lib/server/inputs";
import { profileBrief, system } from "@/lib/server/prompts";
import { UpskillSchema } from "@/lib/server/schemas";

export const maxDuration = 300;

const Body = z.object({
  profile: profileInput,
  sources: z
    .array(z.object({ label: z.string(), score: z.number().nullable(), gaps: z.array(z.string()), excerpt: z.string().max(3000) }))
    .min(1)
    .max(40),
});

const TASK = `Analyse the gap between the candidate's profile and the jobs they are targeting, then write a learning plan. Weight each job's contribution by (100 - fit score)/100 so poorly matched roles expose more gaps. Prefer recorded gaps over inferred ones. Deduplicate synonyms. Return up to 16 gaps with weighted demand 0-100, then a 3-5 phase plan with realistic week estimates and concrete, well-known study resources (name the course/book/doc and provider; do not invent URLs). Quick wins are things the candidate likely already has but has not written on their profile.`;

export const POST = handle(async (req) => {
  const { profile, sources } = await readJson(req, Body);
  const block = sources.map((s, i) => `## Job ${i + 1}: ${s.label} (fit ${s.score ?? "unknown"})\nRecorded gaps: ${s.gaps.join("; ") || "(none)"}\n<untrusted_job_posting>\n${s.excerpt}\n</untrusted_job_posting>`).join("\n\n");
  return structured({ req, schema: UpskillSchema, system: system(TASK), user: `${profileBrief(profile)}\n\n# Targeted jobs\n${block}`, effort: "medium" });
});
