// app/api/jobs/save/route.ts
//
// POST { jobId }  → toggle saved state (save if not saved, unsave if saved)
// Returns { saved: boolean }

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await req.json();
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

  const existing = await prisma.savedJob.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });

  if (existing) {
    await prisma.savedJob.delete({ where: { id: existing.id } });
    return Response.json({ saved: false });
  }

  await prisma.savedJob.create({ data: { userId, jobId } });
  return Response.json({ saved: true });
}