// app/api/applications/route.ts

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const applications = await prisma.application.findMany({
    where: { userId },
    orderBy: { appliedAt: "desc" },
  });

  return Response.json({ applications });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { company, jobTitle, applyUrl, appliedAt, interviewDate, notes } = await req.json();

  if (!company || !jobTitle) {
    return Response.json({ error: "company and jobTitle are required" }, { status: 400 });
  }

  const application = await prisma.application.create({
    data: {
      userId,
      company,
      jobTitle,
      applyUrl: applyUrl || null,
      appliedAt: appliedAt ? new Date(appliedAt) : new Date(),
      interviewDate: interviewDate ? new Date(interviewDate) : null,
      notes: notes || null,
      status: interviewDate ? "interviewing" : "applied",
    },
  });

  return Response.json({ application });
}