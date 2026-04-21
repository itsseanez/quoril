// app/api/profile/route.ts

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [clerkUser, dbUser] = await Promise.all([
    currentUser(),
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: true,
        applications: true,
        resume: true,
        workHistory: { orderBy: { order: "asc" } },
        projects:    { orderBy: { order: "asc" } },
      },
    }),
  ]);

  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  return Response.json({
    user: {
      id:              dbUser.id,
      email:           dbUser.email,
      firstName:       clerkUser?.firstName ?? "",
      lastName:        clerkUser?.lastName ?? "",
      targetRole:      dbUser.targetRole,
      experienceLevel: dbUser.experienceLevel,
      intentState:     dbUser.intentState,
      location:        dbUser.location,
      skills:          dbUser.skills.map((s) => s.name),
      resume:          dbUser.resume
        ? {
            fileName:   dbUser.resume.fileName,
            fileUrl:    dbUser.resume.fileUrl,
            uploadedAt: dbUser.resume.uploadedAt.toISOString(),
            parsedAt:   dbUser.resume.parsedAt?.toISOString() ?? null,
          }
        : null,
      projects: dbUser.projects.map((p) => ({
        id:          p.id,
        name:        p.name,
        description: p.description,
        url:         p.url,
        techStack:   p.techStack,
        startDate:   p.startDate?.toISOString() ?? null,
        endDate:     p.endDate?.toISOString()   ?? null,
      })),
      workHistory: dbUser.workHistory.map((w) => ({
        id:        w.id,
        company:   w.company,
        title:     w.title,
        startDate: w.startDate?.toISOString() ?? null,
        endDate:   w.endDate?.toISOString()   ?? null,
        summary:   w.summary,
      })),
    },
  });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { targetRole, experienceLevel, intentState, location, skills } = await req.json();

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(targetRole      !== undefined && { targetRole }),
      ...(experienceLevel !== undefined && { experienceLevel }),
      ...(intentState     !== undefined && { intentState }),
      ...(location        !== undefined && { location }),
    },
  });

  if (skills !== undefined) {
    await prisma.userSkill.deleteMany({ where: { userId } });
    if (skills.length > 0) {
      await prisma.userSkill.createMany({
        data: skills.map((name: string) => ({ name, userId })),
      });
    }
  }

  return Response.json({ ok: true });
}