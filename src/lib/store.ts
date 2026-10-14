"use client";

// All user data lives in the browser (localStorage), matching the original
// project's "runs on your machine" privacy stance: nothing is stored server-side.

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { today, uid } from "./framework";
import type {
  AppStatus,
  Application,
  Job,
  JobSearchResult,
  Profile,
  RankResult,
  Settings,
  UpskillReport,
} from "./types";

export const EMPTY_PROFILE: Profile = {
  name: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  links: [],
  summary: "",
  skills: { strong: [], moderate: [], weak: [] },
  domains: { direct: [], adjacent: [], entry: [] },
  experience: [],
  education: [],
  certifications: [],
  languages: [{ name: "English", level: "Professional" }],
  careerGoals: [],
  energizing: [],
  draining: [],
  dealBreakers: [],
  workAuthorization: "",
  preferredWorkMode: "any",
  willingToRelocate: false,
  behavioral: "",
  searchQueries: [],
  searchLocation: "India",
  starStories: [],
  updatedAt: "",
};

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  workspaceId: "",
  accessCode: "",
  model: "",
  theme: "dark",
  reduceMotion: false,
  followupDays: 10,
  freeMode: "off",
};

interface State {
  profile: Profile;
  jobs: Record<string, Job>;
  applications: Application[];
  upskill: UpskillReport | null;
  settings: Settings;

  setProfile: (p: Partial<Profile>) => void;
  replaceProfile: (p: Profile) => void;

  addJobs: (results: JobSearchResult[]) => number;
  updateJob: (key: string, patch: Partial<Job>) => void;
  setRank: (key: string, rank: RankResult) => void;
  removeJob: (key: string) => void;

  createApplication: (a: Partial<Application> & { company: string; role: string }) => string;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  moveApplication: (id: string, status: AppStatus, note?: string) => void;
  removeApplication: (id: string) => void;

  setUpskill: (r: UpskillReport | null) => void;
  setSettings: (s: Partial<Settings>) => void;

  importAll: (data: Partial<Pick<State, "profile" | "jobs" | "applications" | "upskill">>) => void;
  reset: (what: "profile" | "data" | "all") => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: EMPTY_PROFILE,
      jobs: {},
      applications: [],
      upskill: null,
      settings: DEFAULT_SETTINGS,

      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p, updatedAt: new Date().toISOString() } })),
      replaceProfile: (p) => set({ profile: { ...EMPTY_PROFILE, ...p, updatedAt: new Date().toISOString() } }),

      addJobs: (results) => {
        const jobs = { ...get().jobs };
        let added = 0;
        for (const r of results) {
          if (jobs[r.key]) continue; // dedupe like /scrape's seen_jobs.json
          jobs[r.key] = { ...r, status: "new", firstSeen: today() };
          added++;
        }
        set({ jobs });
        return added;
      },
      updateJob: (key, patch) =>
        set((s) => (s.jobs[key] ? { jobs: { ...s.jobs, [key]: { ...s.jobs[key], ...patch } } } : s)),
      setRank: (key, rank) =>
        set((s) =>
          s.jobs[key]
            ? { jobs: { ...s.jobs, [key]: { ...s.jobs[key], rank, status: s.jobs[key].status === "applied" ? "applied" : "ranked" } } }
            : s,
        ),
      removeJob: (key) =>
        set((s) => {
          const jobs = { ...s.jobs };
          delete jobs[key];
          return { jobs };
        }),

      createApplication: (a) => {
        const id = uid("app");
        const now = new Date().toISOString();
        const status: AppStatus = a.status ?? "draft";
        const app: Application = {
          id,
          jobKey: a.jobKey ?? null,
          company: a.company,
          role: a.role,
          url: a.url ?? "",
          location: a.location ?? "",
          channel: a.channel ?? "",
          status,
          fitScore: a.fitScore ?? null,
          createdAt: now,
          updatedAt: now,
          appliedAt: status === "applied" ? today() : null,
          deadline: a.deadline ?? null,
          contact: a.contact ?? "",
          notes: a.notes ?? "",
          postingText: a.postingText ?? "",
          hostCheck: a.hostCheck ?? null,
          events: [{ date: today(), status, note: "Created" }],
          evaluation: a.evaluation ?? null,
          drafts: a.drafts ?? null,
          interviewPack: null,
          followups: [],
        };
        set((s) => ({ applications: [app, ...s.applications] }));
        if (app.jobKey) get().updateJob(app.jobKey, { status: "applied" });
        return id;
      },
      updateApplication: (id, patch) =>
        set((s) => ({
          applications: s.applications.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)),
        })),
      moveApplication: (id, status, note) =>
        set((s) => ({
          applications: s.applications.map((a) =>
            a.id === id && a.status !== status
              ? {
                  ...a,
                  status,
                  appliedAt: a.appliedAt ?? (status !== "draft" ? today() : null),
                  updatedAt: new Date().toISOString(),
                  events: [...a.events, { date: today(), status, note: note ?? "" }],
                }
              : a,
          ),
        })),
      removeApplication: (id) => set((s) => ({ applications: s.applications.filter((a) => a.id !== id) })),

      setUpskill: (r) => set({ upskill: r }),
      setSettings: (p) =>
        set((s) => {
          const next = { ...s.settings, ...p };
          // A new or removed Claude key starts fresh: an automatic switch to the built-in engine
          // (empty credit, busy engines) was about the previous setup.
          if (p.apiKey !== undefined && p.apiKey !== s.settings.apiKey && p.freeMode === undefined && (next.freeMode === "billing" || next.freeMode === "limit")) {
            next.freeMode = "off";
            next.freeModeUntil = undefined;
          }
          return { settings: next };
        }),

      importAll: (data) =>
        set((s) => ({
          profile: data.profile ? { ...EMPTY_PROFILE, ...data.profile } : s.profile,
          jobs: data.jobs ?? s.jobs,
          applications: data.applications ?? s.applications,
          upskill: data.upskill ?? s.upskill,
        })),
      reset: (what) =>
        set((s) => ({
          profile: what === "data" ? s.profile : EMPTY_PROFILE,
          jobs: what === "profile" ? s.jobs : {},
          applications: what === "profile" ? s.applications : [],
          upskill: what === "profile" ? s.upskill : null,
        })),
    }),
    {
      name: "job-vettai",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** True once persisted state has been loaded from localStorage (false during SSR and first paint). */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

export function profileCompleteness(p: Profile): number {
  const checks = [
    !!p.name,
    !!p.headline,
    !!p.summary,
    p.skills.strong.length >= 3,
    p.experience.length >= 1,
    p.education.length >= 1,
    p.careerGoals.length >= 1,
    p.languages.length >= 1,
    p.starStories.length >= 2,
    p.searchQueries.length >= 1,
    p.energizing.length >= 1,
    !!p.workAuthorization,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
