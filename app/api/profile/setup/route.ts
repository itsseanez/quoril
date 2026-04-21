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

  // Only include fields that were actually sent — avoids overwriting
  // resume-imported values with empty strings from the fast onboarding path
  const updateData = {
    ...(intentState     !== undefined && intentState     !== "" && { intentState }),
    ...(targetRole      !== undefined && targetRole      !== "" && { targetRole }),
    ...(experienceLevel !== undefined && experienceLevel !== "" && { experienceLevel }),
    ...(location        !== undefined && location        !== "" && { location }),
  };

  await prisma.user.upsert({
    where: { id: userId },
    update: updateData,
    create: { id: userId, email, intentState: intentState ?? "exploratory", ...updateData },
  });

  if (skills?.length) {
    await prisma.userSkill.deleteMany({ where: { userId } });
    await prisma.userSkill.createMany({
      data: skills.map((name: string) => ({ name, userId })),
    });
  }

  return Response.json({ ok: true });
}