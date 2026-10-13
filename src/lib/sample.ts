// Fictional demo data so a first-time visitor can explore every page.
// All people, companies and links are invented.

import { heuristicRank } from "./heuristics";
import { overallScore, today, verdictFor } from "./framework";
import type { Application, AppStatus, Job, Profile } from "./types";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export const SAMPLE_PROFILE: Profile = {
  name: "Kavya Raman",
  headline: "Chartered Accountant | Direct & Indirect Tax Advisory",
  email: "kavya.raman@example.com",
  phone: "+91 90000 00000",
  location: "Chennai, Tamil Nadu, India",
  links: ["https://www.linkedin.com/in/example"],
  summary:
    "Chartered Accountant with 6 years in direct and indirect tax advisory for mid-size manufacturing and services clients. Led GST compliance and litigation support for a 40-client portfolio, drafted replies to show-cause notices, and handled income tax assessments and appeals before CIT(A). Comfortable translating complex law into clear advice for founders and finance teams.",
  skills: {
    strong: ["GST", "Income Tax", "TDS", "Tax Audit", "Litigation", "Legal Drafting", "Compliance", "Excel"],
    moderate: ["Transfer Pricing", "Ind AS", "SAP FICO", "Tally", "Financial Reporting", "Client Management", "Team Leadership"],
    weak: ["Power BI", "International Taxation", "Python"],
  },
  domains: {
    direct: ["Tax advisory", "GST compliance", "Income tax assessments", "Tax litigation support"],
    adjacent: ["Statutory audit", "Finance operations", "Corporate law"],
    entry: ["Transfer pricing", "Tax technology"],
  },
  experience: [
    {
      id: "exp1",
      title: "Senior Tax Associate",
      company: "Sundaram & Iyer Chartered Accountants",
      location: "Chennai",
      start: "Jun 2021",
      end: "Present",
      bullets: [
        "Manage GST compliance (GSTR-1, 3B, 9, 9C) and reconciliations for a portfolio of 40 manufacturing and services clients.",
        "Drafted replies to 25+ GST show-cause notices and assisted counsel at appellate hearings, with 18 matters closed favourably.",
        "Represented clients in income tax scrutiny assessments and prepared grounds and submissions for CIT(A) appeals.",
        "Supervise a team of 4 article assistants and review their tax audit (Form 3CD) working papers.",
      ],
    },
    {
      id: "exp2",
      title: "Tax Associate",
      company: "Meridian Advisory LLP",
      location: "Bengaluru",
      start: "Jul 2019",
      end: "May 2021",
      bullets: [
        "Prepared income tax returns and TDS returns for corporate and HNI clients.",
        "Built an Excel-based GST input tax credit reconciliation template adopted across the indirect tax team.",
        "Supported tax audits and statutory audits for 12 clients.",
      ],
    },
  ],
  education: [
    { id: "edu1", degree: "Chartered Accountant (CA)", institution: "ICAI", year: "2019", details: "All groups cleared in first attempt" },
    { id: "edu2", degree: "B.Com", institution: "Loyola College, Chennai", year: "2016", details: "" },
  ],
  certifications: ["GST Certificate Course (ICAI)", "Certificate on Indirect Tax Laws"],
  languages: [
    { name: "English", level: "Fluent" },
    { name: "Tamil", level: "Native" },
    { name: "Hindi", level: "Conversational" },
  ],
  careerGoals: ["Lead an indirect tax practice", "Move into tax litigation and advisory leadership", "Work with larger multi-state clients"],
  energizing: ["Drafting legal submissions", "Untangling complex GST issues", "Client advisory conversations", "Mentoring juniors"],
  draining: ["Repetitive data entry", "Pure bookkeeping work"],
  dealBreakers: ["Roles requiring relocation outside South India"],
  workAuthorization: "Indian citizen",
  preferredWorkMode: "hybrid",
  willingToRelocate: false,
  behavioral: "Thrives with autonomy and clear ownership; prefers advisory work over routine processing.",
  searchQueries: ["GST manager", "indirect tax manager", "tax litigation", "direct tax senior associate"],
  searchLocation: "Chennai, Tamil Nadu, India",
  starStories: [
    {
      id: "star1",
      title: "Turning around a GST demand",
      skill: "Litigation & drafting",
      situation: "A manufacturing client received a show-cause notice proposing a large ITC reversal.",
      task: "Prepare a reply that defended the credit and preserved the client's appeal options.",
      action: "Reconciled two years of GSTR-2A against purchase registers, traced every mismatch to supplier filings, and drafted a reply citing the relevant circulars and judgements.",
      result: "The demand was dropped for most of the amount at the adjudication stage.",
      useFor: ["Tell me about a complex problem", "Attention to detail"],
    },
    {
      id: "star2",
      title: "ITC reconciliation template",
      skill: "Process improvement",
      situation: "Monthly ITC reconciliation took the team several days per client.",
      task: "Find a faster, repeatable approach.",
      action: "Built an Excel template with lookup-based matching and exception flags, and trained the team on it.",
      result: "Reconciliation time dropped sharply and the template became the team standard.",
      useFor: ["Initiative", "Improving a process"],
    },
  ],
  updatedAt: new Date().toISOString(),
};

const POSTINGS: { title: string; company: string; location: string; posted: number; text: string }[] = [
  {
    title: "Manager - Indirect Tax (GST)",
    company: "Kaveri Advisory LLP",
    location: "Chennai, Tamil Nadu, India",
    posted: 3,
    text: "We are looking for a Chartered Accountant to lead GST compliance and advisory for a portfolio of corporate clients. Responsibilities: GST compliance and reconciliations, drafting replies to show cause notices, representing clients before GST authorities, litigation support, and mentoring a team of associates. Requirements: CA with 5+ years in indirect tax, strong legal drafting, excellent client management. Hybrid working. Fluent English required.",
  },
  {
    title: "Senior Associate - Direct Tax",
    company: "Ashoka Global Services",
    location: "Bengaluru, Karnataka, India",
    posted: 6,
    text: "Senior Associate for direct tax: income tax compliance, TDS, tax audit, assessments and appeals. Exposure to transfer pricing and international taxation preferred. CA qualified with 4+ years experience. Hybrid.",
  },
  {
    title: "Tax Technology Analyst",
    company: "Tidewater Fintech",
    location: "Remote, India",
    posted: 9,
    text: "Join our tax engine team. You will translate GST rules into product requirements, write SQL to validate tax calculations, and build Power BI dashboards. Python is a plus. Background in GST with strong data analysis skills.",
  },
  {
    title: "Indirect Tax Lead",
    company: "Marina Retail Pvt Ltd",
    location: "Chennai, Tamil Nadu, India",
    posted: 2,
    text: "In-house indirect tax lead for a multi-state retail business. Own GST compliance across 12 states, e-invoicing, litigation management with external counsel, and advisory to business teams. SAP experience required. CA with 6+ years. Relocation not required.",
  },
  {
    title: "Transfer Pricing Consultant",
    company: "Nilgiri Consulting",
    location: "Mumbai, Maharashtra, India",
    posted: 15,
    text: "Transfer pricing documentation, benchmarking and international taxation advisory for multinational clients. Relocation to Mumbai is required. Fluent French is required for our European desk.",
  },
];

export function buildSample(): { profile: Profile; jobs: Record<string, Job>; applications: Application[] } {
  const jobs: Record<string, Job> = {};
  POSTINGS.forEach((p, i) => {
    const key = `manual:sample-${i + 1}`;
    const job: Job = {
      key,
      source: "manual",
      title: p.title,
      company: p.company,
      location: p.location,
      url: `https://example.com/jobs/sample-${i + 1}`,
      postedDate: daysAgo(p.posted),
      description: p.text,
      skills: [],
      salary: null,
      workMode: null,
      status: "new",
      firstSeen: today(),
    };
    job.rank = heuristicRank(SAMPLE_PROFILE, job);
    job.status = "ranked";
    jobs[key] = job;
  });

  const mk = (company: string, role: string, status: AppStatus, created: number, score: number, history: AppStatus[]): Application => {
    const scores = { technical: score + 4, experience: score, behavioral: score - 6, career: score + 2 };
    const overall = overallScore(scores);
    return {
      id: `app_sample_${company.replace(/\W+/g, "").toLowerCase()}`,
      jobKey: null,
      company,
      role,
      url: "https://example.com/jobs/sample",
      location: "Chennai",
      channel: ["LinkedIn", "Company site", "Referral"][created % 3],
      status,
      fitScore: overall,
      createdAt: new Date(Date.now() - created * 86_400_000).toISOString(),
      updatedAt: new Date(Date.now() - Math.max(0, created - 3) * 86_400_000).toISOString(),
      appliedAt: status === "draft" ? null : daysAgo(created),
      deadline: null,
      contact: "",
      notes: "",
      postingText: "",
      hostCheck: null,
      events: history.map((s, i) => ({ date: daysAgo(Math.max(0, created - i * 4)), status: s, note: "" })),
      evaluation: {
        company,
        role,
        location: "Chennai",
        department: "",
        deadline: null,
        postingLanguage: "English",
        eligibility: { verdict: "PASS", note: "" },
        languageGate: { verdict: "PASS", note: "" },
        locationGate: { verdict: "PASS", note: "" },
        technical: { score: scores.technical, note: "" },
        experience: { score: scores.experience, note: "" },
        behavioral: { score: scores.behavioral, note: "" },
        career: { score: scores.career, note: "" },
        overall,
        verdict: verdictFor(overall),
        strengths: ["Deep GST compliance and litigation experience"],
        gaps: ["Limited SAP S/4HANA tax configuration exposure"],
        recommendation: "",
        keywords: ["GST", "litigation", "SAP"],
        requirements: [],
        callQuestions: [],
        mode: "heuristic",
      },
      drafts: null,
      interviewPack: null,
      followups: [],
    };
  };

  const applications = [
    mk("Lotus Manufacturing Ltd", "GST Manager", "interview", 18, 78, ["applied", "screening", "interview"]),
    mk("Coromandel Advisors", "Tax Litigation Associate", "screening", 12, 72, ["applied", "screening"]),
    mk("Bayview Logistics", "Indirect Tax Specialist", "applied", 14, 64, ["applied"]),
    mk("Harbour Pharma", "Senior Tax Analyst", "rejected", 30, 52, ["applied", "screening", "rejected"]),
    mk("Peacock Hotels Group", "Finance Manager - Tax", "offer", 40, 81, ["applied", "screening", "interview", "offer"]),
    mk("Monsoon Retail", "Tax Associate", "draft", 1, 58, ["draft"]),
  ];
  return { profile: SAMPLE_PROFILE, jobs, applications };
}
