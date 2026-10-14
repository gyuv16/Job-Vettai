import "server-only";

import type { Profile } from "../types";
import { HONESTY_RULE, UNTRUSTED_RULE } from "./claude";

const list = (xs: string[] | undefined) => (xs && xs.length ? xs.join("; ") : "(none given)");

/** Compact, deterministic rendering of the profile (stable order helps prompt caching). */
export function profileBrief(p: Profile): string {
  const exp = (p.experience ?? [])
    .map((e) => `- ${e.title} at ${e.company} (${e.location || "—"}), ${e.start} – ${e.end || "Present"}\n${(e.bullets ?? []).map((b) => `    • ${b}`).join("\n")}`)
    .join("\n");
  const edu = (p.education ?? []).map((e) => `- ${e.degree}, ${e.institution} (${e.year}) ${e.details}`).join("\n");
  const stars = (p.starStories ?? [])
    .map((s) => `- "${s.title}" [${s.skill}] S: ${s.situation} T: ${s.task} A: ${s.action} R: ${s.result}`)
    .join("\n");
  return `# Candidate profile
Name: ${p.name || "(not set)"}
Headline: ${p.headline}
Location: ${p.location} | Work authorization: ${p.workAuthorization || "(not stated)"} | Preferred work mode: ${p.preferredWorkMode} | Willing to relocate: ${p.willingToRelocate ? "yes" : "no"}
Summary: ${p.summary}

## Skills
Strong: ${list(p.skills?.strong)}
Moderate: ${list(p.skills?.moderate)}
Weak / gaps: ${list(p.skills?.weak)}

## Experience domains
Direct: ${list(p.domains?.direct)}
Adjacent: ${list(p.domains?.adjacent)}
Entry-level: ${list(p.domains?.entry)}

## Experience
${exp || "(none)"}

## Education
${edu || "(none)"}

Certifications: ${list(p.certifications)}
Languages (declared levels): ${(p.languages ?? []).map((l) => `${l.name} (${l.level})`).join("; ") || "(none)"}

## Motivation
Career goals: ${list(p.careerGoals)}
Energizing tasks: ${list(p.energizing)}
Draining tasks: ${list(p.draining)}
Deal-breakers: ${list(p.dealBreakers)}
Behavioral notes: ${p.behavioral || "(none)"}

## STAR stories
${stars || "(none)"}`;
}

export const FRAMEWORK = `# Fit evaluation framework
Gates run before scoring:
- Eligibility: if the posting requires citizenship / permanent residency / security clearance the candidate does not hold, verdict FAIL and quote the wording. If it explicitly welcomes the candidate's status, PASS. If silent, UNVERIFIED (silence is not permission).
- Language: read requirements for the role itself, not the language the ad is written in. A required language absent from the Languages table is FAIL. A declared language whose required bar plausibly exceeds the declared level is FLAG (quote both). Otherwise PASS.
- Location: within commute range or remote-compatible is PASS; requires relocation the candidate won't do is FAIL; frequent travel or mismatched work mode is FLAG.

Score each dimension 0-100:
1. Technical skills: 80-100 core requirements are primary skills; 60-79 most match with 1-2 learnable gaps; 40-59 partial, significant upskilling; 0-39 fundamental mismatch.
2. Experience: match on the function and nature of the work, not the literal title. 80-100 direct same domain and role type; 60-79 related, transferable; 40-59 adjacent, needs a case; 0-39 unrelated.
3. Behavioral / culture: 80-100 strongly matches the candidate's thrive factors; 60-79 mixed but compatible; 40-59 friction; 0-39 mismatch.
4. Career alignment & motivation: does it advance the stated goals and contain energizing tasks? 80-100 strongly aligned; 60-79 partial; 40-59 doesn't build toward goals; 0-39 dead end.
(The application computes the weighted overall itself: technical 30%, experience 25%, behavioral 15%, career 30%.)`;

export function system(task: string): string {
  return `You are Job Vettai, an expert career strategist and recruiter. ${task}

${UNTRUSTED_RULE}

${HONESTY_RULE}`;
}

/**
 * Wrap third-party text (postings, CVs) in its untrusted tag. Look-alike tags inside
 * the text are neutralised, so it can't close the block early and pass as instructions.
 */
export function untrusted(tag: string, text: string): string {
  return `<untrusted_${tag}>\n${text.replace(/<(\/?)(\s*)untrusted_/gi, "‹$1$2untrusted_")}\n</untrusted_${tag}>`;
}

export function postingBlock(text: string, meta?: { url?: string; company?: string; role?: string; location?: string }): string {
  const head = [meta?.url && `Source URL: ${meta.url}`, meta?.company && `Company (as given): ${meta.company}`, meta?.role && `Role (as given): ${meta.role}`, meta?.location && `Location (as given): ${meta.location}`]
    .filter(Boolean)
    .join("\n");
  return untrusted("job_posting", `${head ? head + "\n\n" : ""}${text.slice(0, 18000)}`);
}

export const WRITING_STYLE = `# Writing rules
1. No em-dashes. Use commas, periods, or restructure.
2. No cliches or filler: cut "passionate about", "great fit", "leverage my skills", "hit the ground running", "drive results", "synergies".
3. No buzzwords without a concrete example or fact behind them.
4. No apologetic language: "I bring X, demonstrated by Y", not "I think I could".
5. No unverified company claims. Only say company-specific things that appear in the posting itself; otherwise stay general.
6. Reframe emphasis, never substance. Apply the interview backtrack test: the candidate must be able to explain every bullet without "well, what I actually meant was".
Tone: warm but direct, first person, active voice. Demonstrate, don't state.
Cover letter: forward-looking (what the candidate will solve for the employer), opening ties background to the role in 1-2 sentences, an early "why this company" paragraph built from the posting, 3-5 specific outcome-oriented bullets where useful, brief confident close. One page maximum.
CV: two pages maximum. Lead with what matters most for this posting. Use the posting's own terms where truthfully applicable, including in skill group names. Every requirement in the posting is addressed in at least one document: matched, or honestly bridged.`;
