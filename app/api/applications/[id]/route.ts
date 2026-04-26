// app/api/applications/[id]/route.ts

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { FeedbackEngine } from "@/lib/matching/feedback-engine";
import { SkillGapAnalyzer } from "@/lib/matching/skill-gap-analyzer";

const OUTCOME_STATUSES = new Set(["interview", "offer", "rejected"]);

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { status, notes, interviewDate } = await req.json();

  // Ensure the application belongs to this user
  const { id } = await context.params;
  const existing = await prisma.application.findFirst({
    where: { id, userId },
  });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.application.update({
    where: { id },
    data: {
      ...(status !== undefined && { status }),
      ...(status !== undefined && OUTCOME_STATUSES.has(status) && {
        outcomeAt: new Date(),
      }),
      ...(notes !== undefined && { notes }),
      ...(interviewDate !== undefined && {
        interviewDate: interviewDate ? new Date(interviewDate) : null,
      }),
    },
  });

  // Recompute feedback signals async when an outcome is recorded —
  // don't await so the response returns immediately
  if (status !== undefined && OUTCOME_STATUSES.has(status)) {
    const engine = new FeedbackEngine();
    const analyzer = new SkillGapAnalyzer();

    Promise.all([
      engine.recomputeSignals(userId),
      analyzer.analyze(userId),
    ]).catch((err) => {
      console.error("[PATCH /applications] Failed to recompute signals:", err);
    });
  }

  return Response.json({ application: updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {id} = await context.params;

  const existing = await prisma.application.findFirst({
    where: { id, userId },
  });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  await prisma.application.delete({ where: { id } });
  return Response.json({ ok: true });
}