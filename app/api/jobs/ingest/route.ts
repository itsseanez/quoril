// app/api/jobs/ingest/route.ts
//
// Called daily by Vercel cron (see vercel.json).
// Also callable manually: POST /api/jobs/ingest
// Protected by CRON_SECRET env var.
//
// Greenhouse public board API (no auth required):
//   GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
//
// Add company slugs to GREENHOUSE_SLUGS in your .env:
//   GREENHOUSE_SLUGS=figma,notion,linear,vercel,stripe

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const GREENHOUSE_BASE = "https://boards-api.greenhouse.io/v1/boards";

interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  content: string; // HTML description
  absolute_url: string;
  departments: { name: string }[];
  offices: { name: string }[];
  updated_at: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
  meta: { total: number };
}

const US_STATES = new Set([
  "alabama","alaska","arizona","arkansas","california","colorado","connecticut",
  "delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa",
  "kansas","kentucky","louisiana","maine","maryland","massachusetts","michigan",
  "minnesota","mississippi","missouri","montana","nebraska","nevada",
  "new hampshire","new jersey","new mexico","new york","north carolina",
  "north dakota","ohio","oklahoma","oregon","pennsylvania","rhode island",
  "south carolina","south dakota","tennessee","texas","utah","vermont",
  "virginia","washington","west virginia","wisconsin","wyoming",
  // Abbreviations
  "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in",
  "ia","ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv",
  "nh","nj","nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn",
  "tx","ut","vt","va","wa","wv","wi","wy","dc",
  // Major US cities (common in Greenhouse listings)
  "san francisco","new york city","los angeles","seattle","austin","boston",
  "chicago","denver","atlanta","miami","portland","san jose","san diego",
  "brooklyn","manhattan","nyc",
]);

function isUsOrRemote(raw: string): boolean {
  const lower = raw.toLowerCase();

  // Explicitly remote / unspecified — allow
  if (!raw || lower === "worldwide" || lower === "anywhere") return true;
  if (lower.includes("remote")) return true;

  // Explicitly non-US countries — reject
  const nonUsCountries = [
    "canada","uk","united kingdom","germany","france","australia",
    "india","brazil","netherlands","spain","italy","poland","sweden",
    "singapore","japan","china","mexico","ireland","switzerland",
    "denmark","norway","finland","austria","belgium","portugal",
    "toronto","vancouver","london","berlin","paris","sydney","amsterdam",
  ];
  if (nonUsCountries.some((c) => lower.includes(c))) return false;

  // Check for US state/city
  if (lower.includes("united states") || lower.includes(", us") || lower.includes(", usa")) return true;

  // Split on commas/slashes and check each token
  const tokens = lower.split(/[,\/]/).map((t) => t.trim());
  return tokens.some((t) => US_STATES.has(t));
}

function normalizeLocation(raw: string): { location: string | null; remote: boolean } {
  const lower = raw.toLowerCase();
  const remote =
    lower.includes("remote") ||
    lower.includes("anywhere") ||
    raw === "" ||
    lower === "worldwide";
  return {
    location: raw || null,
    remote,
  };
}

// After HTML is stripped, cut any remaining company boilerplate from plain text.
// This catches cases where Greenhouse embeds the intro outside of content-intro divs.
function trimCompanyBlurb(text: string): string {
  const cutPhrases = [
    "about the role",
    "the role",
    "position overview",
    "job summary",
    "what you will do",
    "what you'll do",
    "responsibilities",
    "about this role",
    "role overview",
  ];

  const lower = text.toLowerCase();
  let earliest = -1;

  for (const phrase of cutPhrases) {
    const idx = lower.indexOf(phrase);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx;
    }
  }

  // Only cut if the phrase isn't at the very start (i.e. there is a preamble)
  if (earliest > 80) {
    text = text.slice(earliest).trim();
  }

  // Strip the leading heading phrase itself (e.g. "About the Role:")
  text = text.replace(/^(about\s+the\s+role|the\s+role|position\s+overview|job\s+summary|what\s+you.{0,10}do|responsibilities|about\s+this\s+role|role\s+overview)\s*[:\-]?\s*/i, "").trim();

  // Truncate to ~600 chars at a sentence boundary, then append "..."
  if (text.length > 600) {
    const truncated = text.slice(0, 600);
    const lastPeriod = truncated.lastIndexOf(".");
    text = (lastPeriod > 200 ? truncated.slice(0, lastPeriod + 1) : truncated) + "...";
  }

  return text;
}

function removeBoilerplate(html: string): string {
  let result = html;

  // Strategy 1: strip content-intro / content-conclusion blocks entirely.
  // Use a stack-based approach to handle nested divs correctly.
  for (const cls of ["content-intro", "content-conclusion"]) {
    const open = new RegExp(`<div[^>]*class=[^>]*${cls}[^>]*>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = open.exec(result)) !== null) {
      // Walk forward counting open/close divs until we find the matching close
      let depth = 1;
      let i = match.index + match[0].length;
      while (i < result.length && depth > 0) {
        if (result.slice(i, i + 4) === "<div") depth++;
        if (result.slice(i, i + 6) === "</div") depth--;
        i++;
      }
      // i is now just past the closing </div>
      const closeIdx = result.indexOf(">", i - 1) + 1;
      result = result.slice(0, match.index) + result.slice(closeIdx);
      open.lastIndex = match.index; // reset after splice
    }
  }

  // Strategy 2: if the above didn't fully clean it, cut everything before the
  // first role-specific heading Greenhouse commonly uses.
  const roleHeadings = [
    /(<h[1-3][^>]*>\s*about\s+the\s+role)/i,
    /(<h[1-3][^>]*>\s*the\s+role)/i,
    /(<h[1-3][^>]*>\s*position\s+overview)/i,
    /(<h[1-3][^>]*>\s*job\s+summary)/i,
    /(<h[1-3][^>]*>\s*what\s+you.{0,10}do)/i,
    /(<h[1-3][^>]*>\s*responsibilities)/i,
  ];
  for (const pattern of roleHeadings) {
    const m = result.match(pattern);
    if (m && m.index !== undefined && m.index > 0) {
      result = result.slice(m.index);
      break;
    }
  }

  return result.trim();
}

function stripHtml(html: string): string {
  return html
    // Decode double-encoded entities first (e.g. &quot; from Greenhouse)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    // Add line breaks before block elements so text doesn't run together
    .replace(/<\/(p|h[1-6]|li|div|section)>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, "")
    // Clean up whitespace
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function ingestCompany(slug: string): Promise<{ upserted: number; errors: number }> {
  const url = `${GREENHOUSE_BASE}/${slug}/jobs?content=true`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    console.error(`[ingest] Failed to fetch ${slug}: ${res.status}`);
    return { upserted: 0, errors: 1 };
  }

  const data: GreenhouseResponse = await res.json();
  let upserted = 0;
  let errors = 0;

  for (const job of data.jobs) {
    try {
      const rawLocation = job.location?.name ?? "";
      if (!isUsOrRemote(rawLocation)) continue;
      const { location, remote } = normalizeLocation(rawLocation);
      const description = trimCompanyBlurb(stripHtml(removeBoilerplate(job.content ?? "")));

      await prisma.job.upsert({
        where: { sourceJobId: `greenhouse-${job.id}` },
        update: {
          title: job.title,
          location,
          remote,
          description,
          applyUrl: job.absolute_url,
        },
        create: {
          title: job.title,
          company: slug, // overridden below with display name if available
          location,
          remote,
          description,
          applyUrl: job.absolute_url,
          source: "greenhouse",
          sourceJobId: `greenhouse-${job.id}`,
        },
      });
      upserted++;
    } catch (err) {
      console.error(`[ingest] Error upserting job ${job.id}:`, err);
      errors++;
    }
  }

  return { upserted, errors };
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slugsEnv = process.env.GREENHOUSE_SLUGS ?? "";
  const slugs = slugsEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (slugs.length === 0) {
    return Response.json({ error: "No GREENHOUSE_SLUGS configured" }, { status: 400 });
  }

  const results: Record<string, { upserted: number; errors: number }> = {};

  for (const slug of slugs) {
    results[slug] = await ingestCompany(slug);
  }

  const total = Object.values(results).reduce((sum, r) => sum + r.upserted, 0);
  console.log(`[ingest] Done. Total upserted: ${total}`);

  return Response.json({ ok: true, results, total });
}

// Allow GET for easy manual testing in the browser (still requires secret)
export async function GET(req: NextRequest) {
  return POST(req);
}