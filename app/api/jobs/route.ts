// app/api/jobs/route.ts
//
// GET /api/jobs
// Returns all jobs scored + annotated with saved/applied state for the current user.

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { scoreJob, scoreLabel } from "@/lib/match";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [user, jobs, savedJobs, applications] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { skills: true },
    }),
    prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 200, // cap for performance; add pagination if needed
    }),
    prisma.savedJob.findMany({ where: { userId }, select: { jobId: true } }),
    prisma.application.findMany({ where: { userId }, select: { jobId: true } }),
  ]);

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const savedSet = new Set(savedJobs.map((s) => s.jobId));
  const appliedSet = new Set(applications.map((a) => a.jobId));

  const scored = jobs.map((job) => {
    const score = scoreJob(user, job);
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      remote: job.remote,
      description: job.description,
      applyUrl: job.applyUrl,
      createdAt: job.createdAt.toISOString(),
      score,
      scoreLabel: scoreLabel(score),
      saved: savedSet.has(job.id),
      applied: appliedSet.has(job.id),
    };
  });

  return Response.json({ jobs: scored });
}