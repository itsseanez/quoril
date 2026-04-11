// lib/match.ts
//
// Scores a job against a user profile. Returns 0–100.
//
// Weights:
//   Title match vs targetRole   30 pts
//   Skill keyword hits           30 pts
//   Location match               20 pts
//   Experience level match       10 pts
//   Intent multiplier            10 pts

export interface ScoringUser {
  targetRole: string | null;
  intentState: string;
  experienceLevel: string | null;
  location: string | null;
  skills: { name: string }[];
}

export interface ScoringJob {
  title: string;
  description: string;
  location: string | null;
  remote: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function tokenize(str: string): string[] {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function wordOverlap(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = tokenize(b);
  if (aTokens.size === 0 || bTokens.length === 0) return 0;
  const hits = bTokens.filter((t) => aTokens.has(t)).length;
  return hits / Math.max(aTokens.size, bTokens.length);
}

// ── individual signals ────────────────────────────────────────────────────────

/** 0–30: how well the job title matches the user's target role */
function titleScore(user: ScoringUser, job: ScoringJob): number {
  if (!user.targetRole) return 10; // neutral — don't penalise missing data
  const overlap = wordOverlap(user.targetRole, job.title);
  return Math.round(overlap * 30);
}

/** 0–30: fraction of user skills mentioned in the job description */
function skillScore(user: ScoringUser, job: ScoringJob): number {
  if (user.skills.length === 0) return 10;
  const desc = job.description.toLowerCase();
  const hits = user.skills.filter((s) => desc.includes(s.name.toLowerCase())).length;
  const ratio = hits / user.skills.length;
  return Math.round(ratio * 30);
}

/** 0–20: location compatibility */
function locationScore(user: ScoringUser, job: ScoringJob): number {
  if (job.remote) return 20;
  if (!user.location || !job.location) return 10;

  const uLoc = user.location.toLowerCase();
  const jLoc = job.location.toLowerCase();

  // Exact city/state match
  if (uLoc === jLoc) return 20;

  // Partial match (e.g. "San Francisco" in "San Francisco, CA")
  const uTokens = tokenize(uLoc);
  const jTokens = tokenize(jLoc);
  const shared = uTokens.filter((t) => jTokens.includes(t)).length;
  if (shared > 0) return 14;

  return 4; // different location
}

/** 0–10: experience level keywords in description */
function experienceScore(user: ScoringUser, job: ScoringJob): number {
  if (!user.experienceLevel) return 5;

  const desc = job.description.toLowerCase();
  const title = job.title.toLowerCase();
  const text = `${title} ${desc}`;

  const levelKeywords: Record<string, string[]> = {
    entry:  ["entry", "junior", "associate", "intern", "new grad", "graduate", "0-2", "1-2"],
    mid:    ["mid", "intermediate", "2-5", "3-5", "ii ", " ii,", "2+ years", "3+ years"],
    senior: ["senior", "sr.", "sr ", "lead", "staff", "principal", "5+", "7+", "8+"],
  };

  const userKeywords = levelKeywords[user.experienceLevel] ?? [];
  const hit = userKeywords.some((kw) => text.includes(kw));
  if (hit) return 10;

  // Penalty for clear mismatch (e.g. entry applying to senior)
  const otherLevels = Object.entries(levelKeywords).filter(([k]) => k !== user.experienceLevel);
  const mismatch = otherLevels.some(([, kws]) => kws.some((kw) => text.includes(kw)));
  if (mismatch) return 2;

  return 5; // neutral
}

/** 0–10: intent-based adjustment */
function intentScore(user: ScoringUser, job: ScoringJob, baseScore: number): number {
  switch (user.intentState) {
    case "locked":
      // Amplify strong matches, suppress weak ones
      if (baseScore >= 60) return 10;
      if (baseScore >= 40) return 5;
      return 0;

    case "hybrid":
      // Slight boost across the board
      return 6;

    case "exploratory":
    default:
      // Flatten — show more variety, don't suppress anything
      return 8;
  }
}

// ── main export ───────────────────────────────────────────────────────────────

export function scoreJob(user: ScoringUser, job: ScoringJob): number {
  const t = titleScore(user, job);
  const s = skillScore(user, job);
  const l = locationScore(user, job);
  const e = experienceScore(user, job);
  const base = t + s + l + e; // 0–90
  const i = intentScore(user, job, base); // 0–10
  return Math.min(100, base + i);
}

export function scoreLabel(score: number): "Great match" | "Good match" | "Partial match" | "Low match" {
  if (score >= 75) return "Great match";
  if (score >= 50) return "Good match";
  if (score >= 30) return "Partial match";
  return "Low match";
}