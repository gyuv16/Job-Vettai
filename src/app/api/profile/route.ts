import { z } from "zod";
import { handle, HttpError, readJson } from "@/lib/server/claude";
import { structured } from "@/lib/server/llm";
import { system } from "@/lib/server/prompts";
import { ProfileSchema } from "@/lib/server/schemas";

export const maxDuration = 300;

const Body = z.object({
  text: z.string().max(80000).optional(),
  pdfBase64: z.string().max(4_000_000).optional(),
  notes: z.string().max(4000).optional(),
});

const TASK = `Build a structured candidate profile from the CV or career documents provided. Extract facts exactly as written (titles, employers, dates, metrics). Classify skills by evidence: "strong" means used repeatedly and recently, "moderate" means some real use, "weak" means mentioned in passing. Write STAR stories only from achievements the documents actually describe; leave fields empty rather than inventing. Suggest search queries that fit the profile and the candidate's market.`;

export const POST = handle(async (req) => {
  const b = await readJson(req, Body);
  if (!b.text && !b.pdfBase64) throw new HttpError(400, "Provide CV text or a PDF.", "BAD_INPUT");
  const content: Parameters<typeof structured>[0]["user"] = [];
  if (b.pdfBase64) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b.pdfBase64 } });
  }
  content.push({
    type: "text",
    text: `<untrusted_cv>\n${(b.text ?? "(see attached PDF)").slice(0, 60000)}\n</untrusted_cv>${b.notes ? `\n\nCandidate's own notes:\n${b.notes}` : ""}\n\nReturn the structured profile.`,
  });
  return structured({ req, schema: ProfileSchema, system: system(TASK), user: content, effort: "low" });
});
