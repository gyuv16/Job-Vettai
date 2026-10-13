import "server-only";

// Job portal adapters, ported from the original repo's country-agnostic CLI
// skills (linkedin-search, freehire-search) to serverless fetch calls.

import type { JobSearchResult } from "../types";
import { decodeEntities, htmlToText } from "./text";

const LINKEDIN_SEARCH = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const LINKEDIN_DETAIL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";
const FREEHIRE = (process.env.FREEHIRE_API_URL || "https://freehire.me").replace(/\/+$/, "");

async function fetchWithBackoff(url: string, init: RequestInit, retries = 3): Promise<Response | null> {
  let delay = 500;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (res.status === 429 || res.status >= 500) {
      if (attempt === retries) throw new Error(`HTTP ${res.status}`);
      await new Promise((r) => setTimeout(r, delay + Math.random() * 300));
      delay = Math.min(delay * 2, 4000);
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }
  return null;
}

// ---------------------------------------------------------------- LinkedIn --

const LI_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; job-vettai/1.0)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function clean(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export interface SearchParams {
  query: string;
  location: string;
  days: number;
  workMode?: "remote" | "hybrid" | "onsite" | "any";
  page?: number;
}

export async function searchLinkedIn(p: SearchParams): Promise<JobSearchResult[]> {
  const params = new URLSearchParams();
  if (p.query) params.set("keywords", p.query);
  if (p.location) params.set("location", p.location);
  if (p.days > 0 && p.days < 9999) params.set("f_TPR", `r${p.days * 86400}`);
  const wt = { onsite: "1", remote: "2", hybrid: "3" }[p.workMode ?? "any" as string];
  if (wt) params.set("f_WT", wt);
  params.set("start", String(((p.page ?? 1) - 1) * 10));
  const res = await fetchWithBackoff(`${LINKEDIN_SEARCH}?${params}`, { headers: LI_HEADERS });
  if (!res) return [];
  const html = await res.text();
  const out: JobSearchResult[] = [];
  for (const chunk of html.split(/data-entity-urn="urn:li:jobPosting:/).slice(1)) {
    const id = chunk.match(/^(\d+)/)?.[1];
    if (!id) continue;
    const link = chunk.match(/class="base-card__full-link[^"]*"[^>]*href="([^"]+)"/i)?.[1];
    const title = clean(chunk.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    if (!title) continue;
    const company = clean(chunk.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? "");
    const location = clean(chunk.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const date = chunk.match(/class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i)?.[1] ?? null;
    out.push({
      key: `linkedin:${id}`,
      source: "linkedin",
      title,
      company: company || "Unknown company",
      location,
      url: link ? decodeEntities(link).split("?")[0] : `https://www.linkedin.com/jobs/view/${id}`,
      postedDate: date,
      description: null,
      skills: [],
      salary: null,
      workMode: p.workMode && p.workMode !== "any" ? p.workMode : null,
    });
  }
  return out;
}

/** Parse a LinkedIn job id from a linkedin.com job URL (host-checked, like normalizeId in the CLI). */
export function linkedInId(input: string): string | null {
  try {
    const u = new URL(input);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const path = u.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})\/?$/);
    if (path) return path[1];
    const q = u.searchParams.get("currentJobId");
    return q && /^\d{6,}$/.test(q) ? q : null;
  } catch {
    return null;
  }
}

export interface PostingDetail {
  title: string;
  company: string;
  location: string;
  text: string;
  active: boolean;
  url: string;
}

export async function linkedInDetail(id: string): Promise<PostingDetail | null> {
  const res = await fetchWithBackoff(`${LINKEDIN_DETAIL}/${id}`, { headers: LI_HEADERS });
  if (!res) return null;
  const html = await res.text();
  const title = clean(html.match(/class="(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1] ?? "");
  const company = clean(html.match(/class="topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
  const location = clean(html.match(/class="topcard__flavor topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const descStart = html.search(/class="(?:show-more-less-html__markup|description__text)/i);
  const descHtml = descStart === -1 ? "" : html.slice(descStart, descStart + 60000);
  const topcard = descStart === -1 ? html : html.slice(0, descStart);
  return {
    title,
    company,
    location,
    text: htmlToText(descHtml.replace(/^[^>]*>/, "")).slice(0, 20000),
    active: !/closed-job__flavor|no longer accepting applications/i.test(topcard),
    url: `https://www.linkedin.com/jobs/view/${id}`,
  };
}

// ---------------------------------------------------------------- freehire --

interface FreehireJob {
  public_slug: string;
  url: string;
  title: string;
  company: string;
  location: string;
  description: string;
  skills: string[];
  work_mode?: string;
  posted_at: string | null;
  enrichment?: { salary_min?: number; salary_max?: number; salary_currency?: string; salary_period?: string };
}

function salaryOf(e: FreehireJob["enrichment"]): string | null {
  if (!e || (e.salary_min == null && e.salary_max == null)) return null;
  const cur = e.salary_currency ? `${e.salary_currency} ` : "";
  const per = e.salary_period ? `/${e.salary_period}` : "";
  return e.salary_min != null && e.salary_max != null ? `${cur}${e.salary_min}–${e.salary_max}${per}` : `${cur}${e.salary_min ?? e.salary_max}${per}`;
}

export async function searchFreehire(p: SearchParams & { country?: string }): Promise<JobSearchResult[]> {
  const q = new URLSearchParams();
  if (p.query) q.set("q", p.query);
  q.set("limit", "20");
  q.set("offset", String(((p.page ?? 1) - 1) * 20));
  q.set("semantic_ratio", "0");
  q.set("include_description", "true");
  q.set("description_format", "text");
  if (p.days > 0 && p.days < 9999) q.set("posted_within_days", String(p.days));
  if (p.workMode && p.workMode !== "any") q.set("work_mode", p.workMode);
  if (p.country) q.append("countries", p.country);
  const res = await fetchWithBackoff(`${FREEHIRE}/api/v1/agent/jobs/search?${q}`, {
    headers: { "User-Agent": "job-vettai/1.0", Accept: "application/json" },
  });
  if (!res) return [];
  const body = (await res.json()) as { data?: FreehireJob[] };
  return (body.data ?? []).map((j) => ({
    key: `freehire:${j.public_slug}`,
    source: "freehire" as const,
    title: decodeEntities(j.title || "").trim() || "(untitled)",
    company: j.company || "Unknown company",
    location: j.location || "",
    url: j.url,
    postedDate: j.posted_at,
    description: j.description ? j.description.slice(0, 20000) : null,
    skills: j.skills ?? [],
    salary: salaryOf(j.enrichment),
    workMode: j.work_mode ?? null,
  }));
}

/** Map a free-text location to freehire's country facet (ISO-3166 alpha-2, lowercased). */
export function countryFacet(location: string): string | undefined {
  const l = location.toLowerCase();
  const known: Record<string, string> = { india: "in", "united states": "us", usa: "us", "united kingdom": "gb", uk: "gb", germany: "de", denmark: "dk", canada: "ca", singapore: "sg", "united arab emirates": "ae", uae: "ae", dubai: "ae", australia: "au", netherlands: "nl" };
  for (const [name, code] of Object.entries(known)) if (l.includes(name)) return code;
  return undefined;
}
