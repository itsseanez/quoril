// app/api/applications/[id]/route.ts

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

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
      ...(notes !== undefined && { notes }),
      ...(interviewDate !== undefined && {
        interviewDate: interviewDate ? new Date(interviewDate) : null,
      }),
    },
  });

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