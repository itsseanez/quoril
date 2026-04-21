// app/api/resume/apply/route.ts
//
// POST /api/resume/apply
// Writes the reviewed parsed resume data to the DB in a single transaction:
//   - updates User fields
//   - replaces UserSkill rows
//   - replaces WorkHistory rows
//   - replaces Project rows
//   - marks Resume.parsedAt
//
// Body: ParsedResume (after user review in the UI)

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { ParsedResume } from "../parse/route";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body: ParsedResume & { mergeSkills?: boolean } = await req.json();
  const mergeSkills = body.mergeSkills ?? false;

  await prisma.$transaction(async (tx) => {

    // 1. Update core User fields (only overwrite non-null values)
    await tx.user.update({
      where: { id: userId },
      data: {
        ...(body.targetRole      && { targetRole: body.targetRole }),
        ...(body.experienceLevel && { experienceLevel: body.experienceLevel }),
        ...(body.location        && { location: body.location }),
      },
    });

    // 2. Replace or merge skills
    if (body.skills.length > 0) {
      if (!mergeSkills) {
        await tx.userSkill.deleteMany({ where: { userId } });
        await tx.userSkill.createMany({
          data: body.skills.map((name) => ({ userId, name })),
        });
      } else {
        const existing = await tx.userSkill.findMany({
          where: { userId },
          select: { name: true },
        });
        const existingNames = new Set(existing.map((s) => s.name));
        const newSkills = body.skills.filter((s) => !existingNames.has(s));
        if (newSkills.length > 0) {
          await tx.userSkill.createMany({
            data: newSkills.map((name) => ({ userId, name })),
          });
        }
      }
    }

    // 3. Replace work history
    await tx.workHistory.deleteMany({ where: { userId } });
    if (body.workHistory.length > 0) {
      await tx.workHistory.createMany({
        data: body.workHistory.map((w, i) => ({
          userId,
          company:   w.company,
          title:     w.title,
          startDate: w.startDate ? new Date(`${w.startDate}-01`) : null,
          endDate:   w.endDate   ? new Date(`${w.endDate}-01`)   : null,
          summary:   w.summary ?? null,
          order:     i,
        })),
      });
    }

    // 4. Replace projects
    await tx.project.deleteMany({ where: { userId } });
    if (body.projects.length > 0) {
      await tx.project.createMany({
        data: body.projects.map((p, i) => ({
          userId,
          name:        p.name,
          description: p.description ?? null,
          url:         p.url         ?? null,
          techStack:   p.techStack,
          startDate:   p.startDate ? new Date(`${p.startDate}-01`) : null,
          endDate:     p.endDate   ? new Date(`${p.endDate}-01`)   : null,
          order:       i,
        })),
      });
    }

    // 5. Mark resume as parsed
    await tx.resume.update({
      where: { userId },
      data: { parsedAt: new Date() },
    });
  });

  return Response.json({ ok: true });
}