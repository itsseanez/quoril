// lib/matching/utils.ts

export function buildUserProfileSummary(user: {
  targetRole: string | null;
  experienceLevel: string | null;
  skills: { name: string }[];
  workHistory: { title: string; company: string }[];
}): string {
  return [
    user.targetRole && `Target role: ${user.targetRole}`,
    user.experienceLevel && `Experience level: ${user.experienceLevel}`,
    user.skills.length > 0 && `Skills: ${user.skills.map((s) => s.name).join(", ")}`,
    user.workHistory.length > 0 &&
      `Work history: ${user.workHistory.map((w) => `${w.title} at ${w.company}`).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}