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
  // Populated by the ingestion pipeline — optional so the scorer stays
  // backwards-compatible with jobs ingested before these fields existed.
  seniorityLevel?: string | null;
  extractedSkills?: string[];
}

// ── helpers ───────────────────────────────────────────────────────────────────

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

/**
 * 0–30: fraction of user skills found in the job.
 *
 * Uses extractedSkills (set intersection) when available — faster and more
 * precise than substring-searching the full description. Falls back to
 * description search for jobs ingested before skill extraction was added.
 */
function skillScore(user: ScoringUser, job: ScoringJob): number {
  if (user.skills.length === 0) return 10;

  const extractedSkills = job.extractedSkills ?? [];

  if (extractedSkills.length > 0) {
    const jobSkillSet = new Set(extractedSkills.map((s) => s.toLowerCase()));
    const hits = user.skills.filter((s) =>
      jobSkillSet.has(s.name.toLowerCase())
    ).length;
    return Math.round((hits / user.skills.length) * 30);
  }

  // Fallback: substring search against plain-text description
  const desc = job.description.toLowerCase();
  const hits = user.skills.filter((s) =>
    desc.includes(s.name.toLowerCase())
  ).length;
  return Math.round((hits / user.skills.length) * 30);
}

/** 0–20: location compatibility */
function locationScore(user: ScoringUser, job: ScoringJob): number {
  if (job.remote) return 20;
  if (!user.location || !job.location) return 10;

  const uLoc = user.location.toLowerCase();
  const jLoc = job.location.toLowerCase();

  // Exact match
  if (uLoc === jLoc) return 20;

  // Partial match (e.g. "San Francisco" in "San Francisco, CA")
  const uTokens = tokenize(uLoc);
  const jTokens = tokenize(jLoc);
  const shared = uTokens.filter((t) => jTokens.includes(t)).length;
  if (shared > 0) return 14;

  return 4; // different location
}

/**
 * 0–10: experience level match.
 *
 * Uses seniorityLevel from the job model when available — a structured enum
 * derived at ingest time from the job title. Falls back to keyword-scanning
 * the title + description for jobs ingested before this field existed.
 */
function experienceScore(user: ScoringUser, job: ScoringJob): number {
  if (!user.experienceLevel) return 5;

  if (job.seniorityLevel) {
    return scoreBySeniorityLevel(user.experienceLevel, job.seniorityLevel);
  }

  // Fallback: keyword scan
  return scoreByKeywords(user.experienceLevel, job);
}

/**
 * Maps user experienceLevel → acceptable seniorityLevel values, then scores
 * based on exact match, adjacent level (partial credit), or mismatch.
 *
 * Seniority ladder (index = distance):
 *   intern → junior → mid → senior → staff → principal → exec
 */
function scoreBySeniorityLevel(
  userLevel: string,
  jobSeniority: string
): number {
  const ladder = ["intern", "junior", "mid", "senior", "staff", "principal", "exec"];

  // Map user's experienceLevel values to ladder entries
  const userLevelMap: Record<string, string> = {
    entry:  "junior",
    mid:    "mid",
    senior: "senior",
  };

  const mappedUser = userLevelMap[userLevel] ?? userLevel;
  const userIdx = ladder.indexOf(mappedUser);
  const jobIdx  = ladder.indexOf(jobSeniority);

  // Can't score if either value isn't on the ladder
  if (userIdx === -1 || jobIdx === -1) return 5;

  const distance = Math.abs(userIdx - jobIdx);
  if (distance === 0) return 10; // exact match
  if (distance === 1) return 6;  // adjacent level — partial credit
  if (distance === 2) return 3;  // two levels off
  return 1;                       // clear mismatch
}

function scoreByKeywords(userLevel: string, job: ScoringJob): number {
  const desc  = job.description.toLowerCase();
  const title = job.title.toLowerCase();
  const text  = `${title} ${desc}`;

  const levelKeywords: Record<string, string[]> = {
    entry:  ["entry", "junior", "associate", "intern", "new grad", "graduate", "0-2", "1-2"],
    mid:    ["mid", "intermediate", "2-5", "3-5", "ii ", " ii,", "2+ years", "3+ years"],
    senior: ["senior", "sr.", "sr ", "lead", "staff", "principal", "5+", "7+", "8+"],
  };

  const userKeywords = levelKeywords[userLevel] ?? [];
  const hit = userKeywords.some((kw) => text.includes(kw));
  if (hit) return 10;

  const otherLevels = Object.entries(levelKeywords).filter(([k]) => k !== userLevel);
  const mismatch = otherLevels.some(([, kws]) => kws.some((kw) => text.includes(kw)));
  if (mismatch) return 2;

  return 5; // neutral
}

/** 0–10: intent-based adjustment */
function intentScore(user: ScoringUser, _job: ScoringJob, baseScore: number): number {
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

// ── main exports ──────────────────────────────────────────────────────────────

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