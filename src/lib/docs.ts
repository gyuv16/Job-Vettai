// Plain-text / Markdown serialisers for the drafted documents, plus the
// client-side ATS keyword check (the web equivalent of the original's
// pdftotext-based parseability pass).

import { mentions } from "./framework";
import type { CoverLetter, CvDoc, Profile } from "./types";

export function contactLine(p: Profile): string {
  return [p.email, p.phone, p.location, ...p.links].filter(Boolean).join(" · ");
}

export function cvToMarkdown(p: Profile, cv: CvDoc): string {
  const lines: string[] = [`# ${p.name || "Your Name"}`, `**${cv.headline}**`, contactLine(p), "", "## Profile", cv.summary, ""];
  if (cv.skillGroups.length) {
    lines.push("## Skills");
    for (const g of cv.skillGroups) lines.push(`- **${g.group}:** ${g.items.join(", ")}`);
    lines.push("");
  }
  if (cv.experience.length) {
    lines.push("## Experience");
    for (const e of cv.experience) {
      lines.push(`### ${e.title}, ${e.company}`, `*${[e.location, e.period].filter(Boolean).join(" · ")}*`);
      for (const b of e.bullets) lines.push(`- ${b}`);
      lines.push("");
    }
  }
  if (cv.education.length) {
    lines.push("## Education");
    for (const e of cv.education) lines.push(`- **${e.degree}**, ${e.institution} (${e.year})${e.details ? `. ${e.details}` : ""}`);
    lines.push("");
  }
  if (cv.certifications.length) lines.push("## Certifications", ...cv.certifications.map((c) => `- ${c}`), "");
  if (cv.languages.length) lines.push("## Languages", cv.languages.join(" · "), "");
  return lines.join("\n");
}

export function letterToMarkdown(p: Profile, l: CoverLetter): string {
  return [
    `**${p.name}**  `,
    contactLine(p),
    "",
    new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    "",
    `**${l.subject}**`,
    "",
    l.greeting,
    "",
    ...(l.paragraphs.length ? [l.paragraphs[0], ""] : []),
    ...(l.bullets.length ? [...l.bullets.map((b) => `- ${b}`), ""] : []),
    ...l.paragraphs.slice(1).flatMap((x) => [x, ""]),
    l.closing,
    l.signature,
  ].join("\n");
}

export function cvPlainText(p: Profile, cv: CvDoc): string {
  return cvToMarkdown(p, cv).replace(/[#*]/g, "");
}

export interface AtsReport {
  coverage: number;
  found: string[];
  missing: string[];
  contactOk: { email: boolean; phone: boolean; name: boolean };
}

export function atsCheck(p: Profile, cv: CvDoc, keywords: string[]): AtsReport {
  const text = cvPlainText(p, cv);
  const uniq = [...new Map(keywords.map((k) => [k.toLowerCase(), k])).values()];
  const found = uniq.filter((k) => mentions(text, k));
  const missing = uniq.filter((k) => !found.includes(k));
  return {
    coverage: uniq.length ? Math.round((found.length / uniq.length) * 100) : 0,
    found,
    missing,
    contactOk: { email: !!p.email, phone: !!p.phone, name: !!p.name },
  };
}

export function download(filename: string, content: string, type = "text/markdown") {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "doc";
}
