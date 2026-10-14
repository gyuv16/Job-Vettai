// Shared domain types. These mirror the original ai-job-search framework's data
// (profile files, seen_jobs.json, job_search_tracker.csv) as typed browser state.

export type Gate = "PASS" | "FAIL" | "FLAG";
export type Verdict = "Strong Fit" | "Good Fit" | "Moderate Fit" | "Weak Fit" | "Poor Fit";
export type WorkMode = "remote" | "hybrid" | "onsite" | "any";

export interface ExperienceEntry {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  year: string;
  details: string;
}

export interface LanguageEntry {
  name: string;
  level: string;
}

export interface StarStory {
  id: string;
  title: string;
  skill: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  useFor: string[];
}

export interface Profile {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  summary: string;
  skills: { strong: string[]; moderate: string[]; weak: string[] };
  domains: { direct: string[]; adjacent: string[]; entry: string[] };
  experience: ExperienceEntry[];
  education: EducationEntry[];
  certifications: string[];
  languages: LanguageEntry[];
  careerGoals: string[];
  energizing: string[];
  draining: string[];
  dealBreakers: string[];
  workAuthorization: string;
  preferredWorkMode: WorkMode;
  willingToRelocate: boolean;
  behavioral: string;
  searchQueries: string[];
  searchLocation: string;
  starStories: StarStory[];
  updatedAt: string;
}

export type JobSource = "linkedin" | "freehire" | "manual";
export type JobStatus = "new" | "ranked" | "expired" | "applied" | "skipped";

export interface DimensionScores {
  technical: number;
  experience: number;
  behavioral: number;
  career: number;
}

export interface RankResult {
  scores: DimensionScores;
  overall: number;
  verdict: Verdict;
  locationVerdict: Gate;
  languageGate: Gate;
  languageNote: string;
  strengths: string[];
  gaps: string[];
  deadline: string | null;
  rankedAt: string;
  mode: "ai" | "heuristic";
}

export interface Job {
  key: string;
  source: JobSource;
  title: string;
  company: string;
  location: string;
  url: string;
  postedDate: string | null;
  description: string | null;
  skills: string[];
  salary: string | null;
  workMode: string | null;
  status: JobStatus;
  firstSeen: string;
  rank?: RankResult;
}

export interface JobSearchResult {
  key: string;
  source: JobSource;
  title: string;
  company: string;
  location: string;
  url: string;
  postedDate: string | null;
  description: string | null;
  skills: string[];
  salary: string | null;
  workMode: string | null;
}

export type HostCategory = "portal" | "ats" | "unverified" | "pasted";

export interface HostCheck {
  host: string;
  category: HostCategory;
  label: string;
}

export interface ScoredDimension {
  score: number;
  note: string;
}

export interface RequirementCheck {
  requirement: string;
  status: "match" | "partial" | "gap";
  evidence: string;
}

export interface Evaluation {
  company: string;
  role: string;
  location: string;
  department: string;
  deadline: string | null;
  postingLanguage: string;
  eligibility: { verdict: "PASS" | "FAIL" | "UNVERIFIED"; note: string };
  languageGate: { verdict: Gate; note: string };
  locationGate: { verdict: Gate; note: string };
  technical: ScoredDimension;
  experience: ScoredDimension;
  behavioral: ScoredDimension;
  career: ScoredDimension;
  overall: number;
  verdict: Verdict;
  strengths: string[];
  gaps: string[];
  recommendation: string;
  keywords: string[];
  requirements: RequirementCheck[];
  callQuestions: string[];
  mode: "ai" | "heuristic";
}

export interface CvDoc {
  headline: string;
  summary: string;
  skillGroups: { group: string; items: string[] }[];
  experience: { title: string; company: string; location: string; period: string; bullets: string[] }[];
  education: { degree: string; institution: string; year: string; details: string }[];
  certifications: string[];
  languages: string[];
}

export interface CoverLetter {
  subject: string;
  greeting: string;
  paragraphs: string[];
  bullets: string[];
  closing: string;
  signature: string;
}

export interface ReviewIssue {
  severity: "high" | "medium" | "low";
  document: "cv" | "cover_letter";
  issue: string;
  fix: string;
}

export interface Review {
  impression: string;
  strengths: string[];
  issues: ReviewIssue[];
  missingKeywords: string[];
  stretchFlags: { claim: string; why: string }[];
}

export interface Drafts {
  cv: CvDoc;
  coverLetter: CoverLetter;
  review: Review | null;
  changelog: string[];
  stage: "draft" | "reviewed" | "final";
  mode: "ai" | "heuristic";
  updatedAt: string;
}

export interface InterviewQuestion {
  question: string;
  category: "behavioral" | "technical" | "motivation" | "gap" | "culture";
  why: string;
  outline: string;
  starStory: string;
}

export interface InterviewPack {
  stage: string;
  companyBrief: string[];
  roleFocus: string[];
  questions: InterviewQuestion[];
  gapBridges: { gap: string; answer: string }[];
  questionsToAsk: string[];
  checklist: string[];
  mode: "ai" | "heuristic";
  createdAt: string;
}

export type AppStatus =
  | "draft"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export interface AppEvent {
  date: string;
  status: AppStatus;
  note: string;
}

export interface Application {
  id: string;
  jobKey: string | null;
  company: string;
  role: string;
  url: string;
  location: string;
  channel: string;
  status: AppStatus;
  fitScore: number | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  deadline: string | null;
  contact: string;
  notes: string;
  postingText: string;
  hostCheck: HostCheck | null;
  events: AppEvent[];
  evaluation: Evaluation | null;
  drafts: Drafts | null;
  interviewPack: InterviewPack | null;
  followups: { date: string; text: string; kind?: "followup" | "thankyou" }[];
}

export interface SkillGap {
  skill: string;
  category: string;
  demand: number;
  currentLevel: "none" | "basic" | "working" | "strong";
  priority: number;
  evidence: string[];
}

export interface LearningPhase {
  phase: string;
  weeks: number;
  focus: string;
  skills: string[];
  resources: { title: string; provider: string; type: string; free: boolean }[];
  milestone: string;
}

export interface UpskillReport {
  summary: string;
  gaps: SkillGap[];
  plan: LearningPhase[];
  quickWins: string[];
  sourceCount: number;
  mode: "ai" | "heuristic";
  createdAt: string;
}

export interface Settings {
  apiKey: string;
  workspaceId: string;
  accessCode: string;
  model: string;
  theme: "dark" | "light" | "system";
  reduceMotion: boolean;
  followupDays: number;
  /**
   * Use the free built-in engine instead of AI. "manual" = the visitor's choice;
   * "billing" = switched on when the Anthropic credit ran out; "limit" = switched on
   * for an hour (until freeModeUntil) because every AI engine was busy or out of quota.
   */
  freeMode: "off" | "manual" | "billing" | "limit";
  freeModeUntil?: number;
}

export interface ServerStatus {
  /** True when the deployment has any AI engine (Mistral, Groq or Claude). */
  serverKey: boolean;
  /** Which engine keys the deployment has. Missing on deployments from before the free engines. */
  engines?: { mistral: boolean; groq: boolean; claude: boolean };
  serverWorkspace: "set" | "unset" | "invalid";
  accessCodeRequired: boolean;
  defaultModel: string;
  /** State of ANTHROPIC_MODEL: unset, a supported model, or unsupported (the default is used instead). */
  modelSetting?: "default" | "set" | "invalid";
  models: string[];
  /** Present on deployments that understand ANTHROPIC_WORKSPACE_ID. */
  workspaceSupport?: boolean;
  commit: string | null;
  branch: string | null;
  environment: string | null;
}
