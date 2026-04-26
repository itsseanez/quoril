// lib/matching/skill-gap-analyzer.ts
//
// Analyzes a user's application history to surface skill gaps and provides
// AI-powered explanations via Groq on how to close them.
//
// Gaps are also injected into the main AI context (app/api/ai/route.ts) so
// that daily actions automatically reference them — no separate UI card needed.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkillGap {
  skill: string;
  frequency: number; // how often it appears in rejected/ghosted applications
  jobCount: number;  // how often it appears in the current active job feed
}

// ── SkillGapAnalyzer ──────────────────────────────────────────────────────────

export class SkillGapAnalyzer {
  /**
   * Analyzes a user's application history to surface skills that appear
   * frequently in jobs where they didn't progress (rejected/ghosted), and
   * cross-references against the current job feed.
   *
   * Persists gaps to SkillGapReport for consumption by the AI context
   * and the /api/jobs/skill-gaps route.
   */
  async analyze(userId: string): Promise<SkillGap[]> {
    const [user, applications, topJobs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { skills: true },
      }),
      prisma.application.findMany({
        where: { userId, status: { in: ["rejected", "ghosted"] } },
        include: { job: true },
      }),
      prisma.job.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { extractedSkills: true },
      }),
    ]);

    if (!user) return [];

    const userSkillSet = new Set(user.skills.map((s) => s.name.toLowerCase()));

    // Skills appearing in rejected/ghosted applications the user doesn't have
    const rejectedSkillFreq = new Map<string, number>();
    for (const app of applications) {
      for (const skill of app.job?.extractedSkills ?? []) {
        const lower = skill.toLowerCase();
        if (!userSkillSet.has(lower)) {
          rejectedSkillFreq.set(lower, (rejectedSkillFreq.get(lower) ?? 0) + 1);
        }
      }
    }

    // Skills appearing in the current job feed the user doesn't have
    const feedSkillFreq = new Map<string, number>();
    for (const job of topJobs) {
      for (const skill of job.extractedSkills) {
        const lower = skill.toLowerCase();
        if (!userSkillSet.has(lower)) {
          feedSkillFreq.set(lower, (feedSkillFreq.get(lower) ?? 0) + 1);
        }
      }
    }

    // Merge: prioritize skills appearing in both rejected apps AND the feed
    const allSkills = new Set([
      ...rejectedSkillFreq.keys(),
      ...feedSkillFreq.keys(),
    ]);

    const gaps: SkillGap[] = [];

    for (const skill of allSkills) {
      const frequency = rejectedSkillFreq.get(skill) ?? 0;
      const jobCount  = feedSkillFreq.get(skill) ?? 0;

      // Only surface gaps with enough signal to be meaningful
      if (frequency + jobCount < 3) continue;

      gaps.push({ skill, frequency, jobCount });
    }

    // Sort by combined signal — rejection frequency weighted more heavily
    // than feed frequency since it's a stronger signal
    gaps.sort(
      (a, b) =>
        (b.frequency * 2 + b.jobCount) - (a.frequency * 2 + a.jobCount)
    );

    const topGaps = gaps.slice(0, 10);

    // Persist gaps only — explanation is persisted separately in analyzeAndExplain
    await prisma.skillGapReport.upsert({
      where: { userId },
      create: { userId, gaps: topGaps as unknown as Prisma.InputJsonValue },
      update: { gaps: topGaps as unknown as Prisma.InputJsonValue, generatedAt: new Date() },
    });

    return topGaps;
  }

  /**
   * Runs analyze() then generates an AI explanation and persists both.
   * Use this from the /api/jobs/skill-gaps route when a full refresh is needed.
   */
  async analyzeAndExplain(
    userId: string,
    userProfile: string
  ): Promise<{ gaps: SkillGap[]; explanation: string }> {
    const gaps = await this.analyze(userId);
    const explanation = gaps.length > 0
      ? await this.explainSkillGap(userProfile, gaps)
      : "";

    // Persist explanation alongside the already-persisted gaps
    await prisma.skillGapReport.update({
      where: { userId },
      data: { explanation },
    });

    return { gaps, explanation };
  }

  /**
   * Uses Groq to generate 2-3 sentences of actionable career advice based
   * on the user's profile and their top skill gaps.
   *
   * Returns an empty string on any failure so callers can degrade gracefully.
   */
  async explainSkillGap(
    userProfile: string,
    gaps: SkillGap[]
  ): Promise<string> {
    if (!process.env.GROQ_API_KEY) {
      console.warn("[explainSkillGap] GROQ_API_KEY not set — skipping");
      return "";
    }

    if (gaps.length === 0) return "";

    const gapList = gaps
      .slice(0, 5)
      .map((g) =>
        `${g.skill} (missing from ${g.frequency} rejected application${g.frequency !== 1 ? "s" : ""}, ` +
        `in ${g.jobCount} active job${g.jobCount !== 1 ? "s" : ""})`
      )
      .join(", ");

    try {
      const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 200,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "You are a career coach. Given a candidate profile and their skill gaps " +
                "derived from real rejected job applications, write 2-3 sentences of specific, " +
                "actionable advice on how to close the most important gap. " +
                "Name the skill explicitly. Be direct. No fluff, no generic advice.",
            },
            {
              role: "user",
              content: `PROFILE:\n${userProfile}\n\nSKILL GAPS:\n${gapList}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        console.error(`[explainSkillGap] Groq error: ${res.status}`);
        return "";
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() ?? "";
    } catch (err) {
      console.error("[explainSkillGap] Failed:", err);
      return "";
    }
  }
}