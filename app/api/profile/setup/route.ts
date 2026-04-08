// app/api/profile/setup/route.ts
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress;

  if (!email) return Response.json({ error: "No email found" }, { status: 400 });

  const { intentState, targetRole, experienceLevel, skills, location } = await req.json();

  await prisma.user.upsert({
    where: { id: userId },
    update: { intentState, targetRole, experienceLevel, location },
    create: { id: userId, email, intentState, targetRole, experienceLevel, location },
  });

  if (skills?.length) {
    await prisma.userSkill.deleteMany({ where: { userId } });
    await prisma.userSkill.createMany({
      data: skills.map((name: string) => ({ name, userId })),
    });
  }

  return Response.json({ ok: true });
}