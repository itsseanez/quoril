interface Project {
  techStack: string[];
  description?: string | null;
}

/**
 * 0–10: scores based on tech stack overlap between user's projects
 * and the job's extracted skills.
 *
 * Uses extractedSkills when available, falls back to description search.
 */
export function projectScore(
  projects: Project[],
  job: { description: string; extractedSkills?: string[] }
): number {
  if (projects.length === 0) return 3; // neutral

  const allProjectTech = new Set(
    projects.flatMap((p) => p.techStack.map((t) => t.toLowerCase()))
  );

  if (allProjectTech.size === 0) return 3;

  const jobSkills =
    job.extractedSkills && job.extractedSkills.length > 0
      ? new Set(job.extractedSkills.map((s) => s.toLowerCase()))
      : new Set(
          job.description
            .toLowerCase()
            .split(/\W+/)
            .filter((t) => t.length > 2)
        );

  const hits = [...allProjectTech].filter((t) => jobSkills.has(t)).length;
  const ratio = hits / allProjectTech.size;

  return Math.round(ratio * 10);
}