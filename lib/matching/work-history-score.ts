interface WorkHistoryEntry {
  title: string;
  company: string;
  summary?: string | null;
}

interface ScoringJob {
  title: string;
  description: string;
  companySlug?: string;
}

function tokenize(str: string): string[] {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

/**
 * 0–15: scores based on how well the job aligns with the user's work history.
 *
 * Signal 1 (0–8): title similarity between job title and past job titles.
 *   If the user has been a "Senior Software Engineer" before, jobs with that
 *   title pattern score higher than totally unrelated roles.
 *
 * Signal 2 (0–7): keyword overlap between job description and past role summaries.
 *   If the user has "led payments infrastructure" in their history and the job
 *   description mentions "payments infrastructure", that's a strong signal.
 */
export function workHistoryScore(
  workHistory: WorkHistoryEntry[],
  job: ScoringJob
): number {
  if (workHistory.length === 0) return 5; // neutral

  // Signal 1 — title similarity
  const jobTitleTokens = new Set(tokenize(job.title));
  let bestTitleOverlap = 0;

  for (const entry of workHistory) {
    const pastTokens = tokenize(entry.title);
    const overlap =
      pastTokens.filter((t) => jobTitleTokens.has(t)).length /
      Math.max(jobTitleTokens.size, pastTokens.length);
    if (overlap > bestTitleOverlap) bestTitleOverlap = overlap;
  }

  const titlePts = Math.round(bestTitleOverlap * 8);

  // Signal 2 — summary keyword overlap against job description
  const descTokens = new Set(tokenize(job.description.slice(0, 1000)));
  const allSummaryTokens = workHistory
    .flatMap((e) => tokenize(e.summary ?? ""))
    .filter((t) => t.length > 3); // skip short stop words

  const summaryHits = new Set(
    allSummaryTokens.filter((t) => descTokens.has(t))
  ).size;

  const summaryPts = Math.min(7, Math.round((summaryHits / 20) * 7));

  return titlePts + summaryPts;
}