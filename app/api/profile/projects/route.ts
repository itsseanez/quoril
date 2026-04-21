// app/api/profile/projects/route.ts
//
// POST   — upsert a single project (create if no id, update if id provided)
// DELETE — remove a project by id

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, description, url, techStack, startDate, endDate } = await req.json();

  if (!name?.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const data = {
    name:        name.trim(),
    description: description?.trim() || null,
    url:         url?.trim() || null,
    techStack:   Array.isArray(techStack) ? techStack : [],
    startDate:   startDate ? new Date(`${startDate}-01`) : null,
    endDate:     endDate   ? new Date(`${endDate}-01`)   : null,
  };

  let entry;

  if (id) {
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    entry = await prisma.project.update({ where: { id }, data });
  } else {
    const count = await prisma.project.count({ where: { userId } });
    entry = await prisma.project.create({ data: { userId, ...data, order: count } });
  }

  return Response.json({
    entry: {
      id:          entry.id,
      name:        entry.name,
      description: entry.description,
      url:         entry.url,
      techStack:   entry.techStack,
      startDate:   entry.startDate?.toISOString() ?? null,
      endDate:     entry.endDate?.toISOString()   ?? null,
    },
  });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id } });
  return Response.json({ ok: true });
}