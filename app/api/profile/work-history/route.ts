// app/api/profile/work-history/route.ts
//
// POST — upsert a single work history entry (create if no id, update if id provided)
// DELETE — remove an entry by id

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, company, startDate, endDate, summary } = await req.json();

  if (!title?.trim() || !company?.trim()) {
    return Response.json({ error: "Title and company are required" }, { status: 400 });
  }

  const data = {
    title:     title.trim(),
    company:   company.trim(),
    startDate: startDate ? new Date(`${startDate}-01`) : null,
    endDate:   endDate   ? new Date(`${endDate}-01`)   : null,
    summary:   summary?.trim() || null,
  };

  let entry;

  if (id) {
    // Update — verify the entry belongs to this user
    const existing = await prisma.workHistory.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    entry = await prisma.workHistory.update({ where: { id }, data });
  } else {
    // Create — get current max order so new entry goes at the end
    const count = await prisma.workHistory.count({ where: { userId } });
    entry = await prisma.workHistory.create({
      data: { userId, ...data, order: count },
    });
  }

  return Response.json({
    entry: {
      id:        entry.id,
      title:     entry.title,
      company:   entry.company,
      startDate: entry.startDate?.toISOString() ?? null,
      endDate:   entry.endDate?.toISOString()   ?? null,
      summary:   entry.summary,
    },
  });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();

  const existing = await prisma.workHistory.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.workHistory.delete({ where: { id } });

  return Response.json({ ok: true });
}