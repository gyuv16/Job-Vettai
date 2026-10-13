// The fit-evaluation framework, ported from the original 04-job-evaluation.md.
// Pure functions: used by both the browser (heuristic mode, re-derivation) and
// the API routes (so the model never does the weighting arithmetic itself).

import type { DimensionScores, Gate, HostCheck, Verdict } from "./types";

export const WEIGHTS = { technical: 0.3, experience: 0.25, behavioral: 0.15, career: 0.3 } as const;

export const DIMENSIONS: { key: keyof DimensionScores; label: string; short: string }[] = [
  { key: "technical", label: "Technical skills", short: "Skills" },
  { key: "experience", label: "Experience match", short: "Experience" },
  { key: "behavioral", label: "Behavioral / culture", short: "Culture" },
  { key: "career", label: "Career alignment", short: "Career" },
];

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function overallScore(s: DimensionScores): number {
  return clampScore(
    s.technical * WEIGHTS.technical +
      s.experience * WEIGHTS.experience +
      s.behavioral * WEIGHTS.behavioral +
      s.career * WEIGHTS.career,
  );
}

export function verdictFor(score: number): Verdict {
  if (score >= 75) return "Strong Fit";
  if (score >= 60) return "Good Fit";
  if (score >= 45) return "Moderate Fit";
  if (score >= 30) return "Weak Fit";
  return "Poor Fit";
}

export const VERDICT_ADVICE: Record<Verdict, string> = {
  "Strong Fit": "Definitely apply, tailor everything.",
  "Good Fit": "Apply, and address the gaps in the cover letter.",
  "Moderate Fit": "Consider carefully before investing time.",
  "Weak Fit": "Probably skip unless there is a strategic reason.",
  "Poor Fit": "Skip.",
};

/** Tone token for a verdict, used for colour + icon pairing in the UI. */
export function verdictTone(v: Verdict): "good" | "info" | "warning" | "serious" | "critical" {
  switch (v) {
    case "Strong Fit":
      return "good";
    case "Good Fit":
      return "info";
    case "Moderate Fit":
      return "warning";
    case "Weak Fit":
      return "serious";
    default:
      return "critical";
  }
}

// ---------------------------------------------------------------------------
// Source host verification (original /apply Step 1, #431)
// ---------------------------------------------------------------------------

const PORTAL_HOSTS = ["linkedin.com", "freehire.me", "naukri.com", "indeed.com", "foundit.in", "instahyre.com", "wellfound.com", "glassdoor.com", "glassdoor.co.in", "jobindex.dk", "jobnet.dk"];
const ATS_APEXES = ["greenhouse.io", "lever.co", "myworkdayjobs.com", "workday.com", "ashbyhq.com", "smartrecruiters.com", "workable.com"];

function hostMatches(host: string, apex: string): boolean {
  return host === apex || host.endsWith(`.${apex}`);
}

export function verifyHost(input: string): HostCheck {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { host: "", category: "pasted", label: "Pasted posting text" };
  }
  // URL parsing already strips userinfo tricks (https://greenhouse.io@evil.com -> host evil.com).
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (PORTAL_HOSTS.some((apex) => hostMatches(host, apex))) {
    return { host, category: "portal", label: "Known job portal" };
  }
  if (ATS_APEXES.some((apex) => hostMatches(host, apex))) {
    return { host, category: "ats", label: "Official ATS" };
  }
  return { host, category: "unverified", label: "Unverified source host" };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isIsoDate(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!isIsoDate(date)) return null;
  const ms = Date.parse(date) - Date.parse(today());
  return Math.round(ms / 86_400_000);
}

export function daysSince(date: string | null | undefined): number | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

export function relativeDays(date: string | null | undefined): string {
  const d = daysSince(date);
  if (d === null) return "—";
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const months = Math.round(d / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+#.\s/-]/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive containment that copes with C++, C#, .NET, Node.js. */
export function mentions(haystack: string, term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(t.toLowerCase())}($|[^a-z0-9])`, "i");
  return re.test(haystack.toLowerCase());
}

/**
 * A compact vocabulary used by the no-key heuristic mode to spot skills in CVs
 * and postings. It is deliberately broad (tech, finance, tax, ops, design) - the
 * AI mode does not depend on it.
 */
export const SKILL_VOCAB: string[] = [
  // software & data
  "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "PHP", "Ruby", "Scala", "R",
  "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Snowflake", "BigQuery", "Databricks", "Spark", "Hadoop", "Kafka", "Airflow", "dbt",
  "React", "Next.js", "Angular", "Vue", "Node.js", "Django", "Flask", "FastAPI", "Spring", ".NET", "GraphQL", "REST",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "CI/CD", "Git", "Linux", "DevOps", "MLOps",
  "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "PyTorch", "TensorFlow", "scikit-learn", "LLM", "Generative AI",
  "Statistics", "Data Analysis", "Data Visualization", "Power BI", "Tableau", "Looker", "Excel", "Pandas", "NumPy",
  "ETL", "Data Engineering", "Data Modeling", "A/B Testing", "Forecasting",
  // finance, tax & audit
  "Income Tax", "GST", "TDS", "Transfer Pricing", "International Taxation", "Direct Tax", "Indirect Tax", "Tax Audit",
  "Statutory Audit", "Internal Audit", "IFRS", "Ind AS", "US GAAP", "Financial Reporting", "Financial Modeling", "FP&A",
  "Budgeting", "Accounts Payable", "Accounts Receivable", "Reconciliation", "Tally", "SAP", "SAP FICO", "Oracle", "QuickBooks", "Zoho Books",
  "Compliance", "Litigation", "Legal Drafting", "Contract Drafting", "Corporate Law", "Due Diligence", "Valuation", "Risk Management",
  "Treasury", "Costing", "Payroll", "Companies Act", "FEMA", "SEBI Regulations",
  // business & ops
  "Project Management", "Agile", "Scrum", "Stakeholder Management", "Product Management", "Business Analysis", "Requirements Gathering",
  "Sales", "Business Development", "Account Management", "CRM", "Salesforce", "HubSpot", "Marketing", "SEO", "Content Marketing",
  "Digital Marketing", "Customer Success", "Operations", "Supply Chain", "Procurement", "Logistics", "Six Sigma", "Lean",
  "Recruitment", "Team Leadership", "Mentoring", "Negotiation", "Public Speaking", "Client Management", "Consulting",
  // design & content
  "Figma", "UI Design", "UX Research", "Graphic Design", "Copywriting", "Technical Writing",
];

export function extractSkills(text: string, vocab: string[] = SKILL_VOCAB): string[] {
  const found = new Set<string>();
  for (const skill of vocab) if (mentions(text, skill)) found.add(skill);
  return [...found];
}

/** Very small language detector for the language gate in heuristic mode. */
const LANGUAGE_WORDS = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Arabic", "French", "German", "Spanish", "Japanese", "Mandarin", "Danish", "Dutch", "Polish", "Russian", "Portuguese", "Italian"];

export function requiredLanguages(text: string): string[] {
  const out: string[] = [];
  for (const lang of LANGUAGE_WORDS) {
    const re = new RegExp(`(fluent|fluency|proficien\\w*|native|business[- ]level|written and spoken|must speak|required)[^.\\n]{0,40}\\b${lang}\\b|\\b${lang}\\b[^.\\n]{0,30}(required|is a must|mandatory|fluency|proficiency)`, "i");
    if (re.test(text)) out.push(lang);
  }
  return out;
}

export function gateIcon(g: Gate): string {
  return g === "PASS" ? "✓" : g === "FLAG" ? "⚠" : "✕";
}
