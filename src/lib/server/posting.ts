import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { verifyHost } from "../framework";
import type { HostCheck } from "../types";
import { HttpError } from "./claude";
import { linkedInDetail, linkedInId } from "./sources";
import { decodeEntities, htmlToText } from "./text";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "Accept-Language": "en-US,en;q=0.9",
};

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;

// ------------------------------------------------------------------ SSRF guard

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateV4(ip);
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("::ffff:")) return isPrivateV4(v.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v);
}

/** Reject anything that is not a public http(s) host on a standard port. */
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, "That does not look like a valid URL.", "BAD_URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new HttpError(400, "Only http(s) links can be fetched.", "BAD_URL");
  if (url.username || url.password) throw new HttpError(400, "Links with embedded credentials are not allowed.", "BAD_URL");
  if (url.port && url.port !== "80" && url.port !== "443") throw new HttpError(400, "Only standard web ports can be fetched.", "BAD_URL");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new HttpError(400, "Private hosts cannot be fetched.", "BAD_URL");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new HttpError(400, `Could not resolve ${host}.`, "DNS");
  if (addresses.some((a) => isPrivateIp(a.address))) throw new HttpError(400, "Private network addresses cannot be fetched.", "BAD_URL");
  return url;
}

async function safeFetch(raw: string): Promise<{ finalUrl: string; body: string; contentType: string }> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "manual", signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      current = new URL(loc, url).toString();
      continue;
    }
    if (res.status === 403 || res.status === 401) {
      throw new HttpError(422, "The site blocked automated access. Open the posting and paste its text instead.", "BLOCKED");
    }
    if (!res.ok) throw new HttpError(422, `The page returned HTTP ${res.status}. The posting may have expired.`, "FETCH_FAILED");
    const reader = res.body?.getReader();
    if (!reader) return { finalUrl: url.toString(), body: "", contentType: res.headers.get("content-type") ?? "" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    const body = new TextDecoder().decode(Buffer.concat(chunks));
    return { finalUrl: url.toString(), body, contentType: res.headers.get("content-type") ?? "" };
  }
  throw new HttpError(422, "Too many redirects.", "FETCH_FAILED");
}

// ------------------------------------------------------------------ parsing

interface JsonLdPosting {
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: unknown;
  validThrough?: string;
  datePosted?: string;
}

function findJobPosting(node: unknown): JsonLdPosting | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findJobPosting(n);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj as JsonLdPosting;
  if (obj["@graph"]) return findJobPosting(obj["@graph"]);
  return null;
}

function locationOf(loc: unknown): string {
  const one = Array.isArray(loc) ? loc[0] : loc;
  if (!one || typeof one !== "object") return "";
  const addr = (one as { address?: Record<string, string> }).address;
  if (!addr) return "";
  return [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter((x) => typeof x === "string" && x).join(", ");
}

export interface FetchedPosting {
  url: string;
  title: string;
  company: string;
  location: string;
  deadline: string | null;
  text: string;
  active: boolean;
  hostCheck: HostCheck;
}

export async function fetchPosting(rawUrl: string): Promise<FetchedPosting> {
  const hostCheck = verifyHost(rawUrl);

  const liId = linkedInId(rawUrl);
  if (liId) {
    const d = await linkedInDetail(liId).catch(() => null);
    if (!d || !d.text) throw new HttpError(422, "Could not read that LinkedIn posting. Paste its text instead.", "FETCH_FAILED");
    return { url: d.url, title: d.title, company: d.company, location: d.location, deadline: null, text: d.text, active: d.active, hostCheck };
  }

  const { finalUrl, body, contentType } = await safeFetch(rawUrl);
  let title = "";
  let company = "";
  let location = "";
  let deadline: string | null = null;
  let text = "";

  if (contentType.includes("json")) {
    text = body.slice(0, 20000);
  } else {
    for (const m of body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const posting = findJobPosting(JSON.parse(m[1].trim()));
        if (posting) {
          title = posting.title ?? "";
          company = typeof posting.hiringOrganization === "string" ? posting.hiringOrganization : posting.hiringOrganization?.name ?? "";
          location = locationOf(posting.jobLocation);
          deadline = posting.validThrough ? posting.validThrough.slice(0, 10) : null;
          text = htmlToText(decodeEntities(posting.description ?? ""));
          break;
        }
      } catch {
        // malformed JSON-LD is common; fall through to page text
      }
    }
    if (!title) title = decodeEntities(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    if (text.length < 200) {
      const main = body.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? body.match(/<body[\s\S]*<\/body>/i)?.[0] ?? body;
      text = htmlToText(main);
    }
  }

  if (text.length < 120) {
    throw new HttpError(422, "The page had almost no readable text (it may need JavaScript or a login). Paste the posting text instead.", "EMPTY");
  }
  return { url: finalUrl, title, company, location, deadline, text: text.slice(0, 20000), active: true, hostCheck };
}
