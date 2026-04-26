// app/api/jobs/skill-gaps/route.ts
//
// GET /api/jobs/skill-gaps
//
// Returns the cached skill gap report for the current user.
// If the report is stale (> 24h) or doesn't exist, regenerates it first.
//
// The dashboard reads from this cache server-side via prisma directly,
// so this route is only called when the user explicitly refreshes.

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { SkillGapAnalyzer } from "@/lib/matching/skill-gap-analyzer";
import { buildUserProfileSummary } from "@/lib/matching/utils";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Check if the user has enough outcome data to generate a meaningful report
    const rejectedCount = await prisma.application.count({
      where: { userId, status: { in: ["rejected"] } },
    });

    if (rejectedCount < 3) {
      return Response.json({
        gaps: [],
        explanation: null,
        generatedAt: null,
        reason: "not_enough_data",
        rejectedCount,
        required: 3,
      });
    }

    // Check cache — skip regeneration if report is fresh (< 24h)
    const cached = await prisma.skillGapReport.findUnique({
      where: { userId },
    });

    const ageHours = cached
      ? (Date.now() - cached.generatedAt.getTime()) / 3_600_000
      : Infinity;

    if (cached && ageHours < 24) {
      return Response.json({
        gaps: cached.gaps,
        explanation: null, // explanation is generated on demand, not cached
        generatedAt: cached.generatedAt,
        fromCache: true,
      });
    }

    // Regenerate — fetch user profile for the AI explanation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { skills: true, workHistory: true },
    });

    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const analyzer = new SkillGapAnalyzer();

    // analyze() computes gaps and persists them to SkillGapReport
    const gaps = await analyzer.analyze(userId);

    // Generate AI explanation only if there are gaps worth explaining
    const explanation = gaps.length > 0
      ? await analyzer.explainSkillGap(buildUserProfileSummary(user), gaps)
      : null;

    return Response.json({
      gaps,
      explanation,
      generatedAt: new Date(),
      fromCache: false,
    });
  } catch (err) {
    console.error("[GET /api/jobs/skill-gaps] Error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}