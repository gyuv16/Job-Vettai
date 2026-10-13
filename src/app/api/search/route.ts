import { z } from "zod";
import { handle, readJson } from "@/lib/server/claude";
import { countryFacet, searchFreehire, searchLinkedIn } from "@/lib/server/sources";
import type { JobSearchResult } from "@/lib/types";

export const maxDuration = 60;

const Body = z.object({
  query: z.string().max(200),
  location: z.string().max(200).default(""),
  days: z.number().int().min(1).max(9999).default(14),
  workMode: z.enum(["remote", "hybrid", "onsite", "any"]).default("any"),
  sources: z.array(z.enum(["linkedin", "freehire"])).min(1),
  page: z.number().int().min(1).max(10).default(1),
});

export const POST = handle(async (req) => {
  const b = await readJson(req, Body);
  const tasks: Record<string, Promise<JobSearchResult[]>> = {};
  if (b.sources.includes("linkedin")) tasks.linkedin = searchLinkedIn(b);
  if (b.sources.includes("freehire")) tasks.freehire = searchFreehire({ ...b, country: countryFacet(b.location) });
  const names = Object.keys(tasks);
  const settled = await Promise.allSettled(Object.values(tasks));
  const results: JobSearchResult[] = [];
  const errors: { source: string; message: string }[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") results.push(...s.value);
    else errors.push({ source: names[i], message: s.reason instanceof Error ? s.reason.message : String(s.reason) });
  });
  // Dedupe across portals on company + title, keeping the first (richer sources listed last win nothing).
  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    const k = `${r.company.toLowerCase().trim()}|${r.title.toLowerCase().trim()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { results: deduped, errors };
});
