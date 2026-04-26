// Generates a stable fingerprint for a job so similar jobs
// can be suppressed without storing full text.

export function fingerprintJob(job: {
  title: string;
  seniorityLevel?: string | null;
  department?: string | null;
}): string {
  const normalized = [
    job.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim(),
    job.seniorityLevel ?? "unknown",
    job.department?.toLowerCase() ?? "unknown",
  ].join("|");

  // Simple djb2 hash — no crypto needed for this use case
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}