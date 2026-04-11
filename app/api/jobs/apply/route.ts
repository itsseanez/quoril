// app/api/jobs/apply/route.ts
//
// POST { jobId }  → creates an Application row (status: "applied")
// Returns { ok: true, applicationId } or { ok: false } if already applied

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await req.json();
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  // Check if already applied
  const existing = await prisma.application.findFirst({
    where: { userId, jobId },
  });

  if (existing) {
    return Response.json({ ok: false, reason: "already_applied", applicationId: existing.id });
  }

  const application = await prisma.application.create({
    data: {
      userId,
      jobId,
      status: "applied",
      applyUrl: job.applyUrl,
    },
  });

  return Response.json({ ok: true, applicationId: application.id });
}