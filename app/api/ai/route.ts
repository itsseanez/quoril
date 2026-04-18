// app/api/ai/route.ts
//
// Streams a response from Groq using llama-3.1-8b-instant.
// Requires GROQ_API_KEY in your .env

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const MODE_PROMPTS: Record<string, (ctx: string) => string> = {
  progress: (ctx) => `
You are a job search coach. Analyze this person's job search progress and give a concise, honest summary.
Cover: how active they've been, which stages they're reaching, patterns you notice, and one encouragement.
Keep it to 3-4 short paragraphs. Be specific using their actual data, not generic.

${ctx}`,

  actions: (ctx) => `
You are a job search strategist. Based on this person's current application statuses, suggest 3-5 specific next actions they should take this week.
Be concrete — name companies, statuses, and what to do. Format as a numbered list with a 1-sentence explanation for each.

${ctx}`,

  skills: (ctx) => `
You are a technical recruiter. Based on this person's skills and target role, identify the top 3-5 skill gaps they likely have.
For each gap: name the skill, why it matters for their target role, and one specific way to address it (course, project, etc).
Be direct and actionable. Format as a numbered list.

${ctx}`,

  interview: (ctx) => `
You are an interview coach. Based on this person's target role and experience level, give them 5 likely interview questions they should prepare for.
For each question, include: the question itself, why interviewers ask it, and a 1-sentence tip for answering it well.

${ctx}`,

  roles: (ctx) => `
You are a career advisor. Based on this person's skills, experience level, location, and intent, recommend 5 specific job roles or role variations they should apply to next.
For each: role title, why it fits them, and what kind of companies typically hire for it.
Be specific — no generic advice.

${ctx}`,
};

function buildContext(user: {
  targetRole: string | null;
  experienceLevel: string | null;
  intentState: string;
  location: string | null;
  skills: { name: string }[];
  applications: {
    company: string;
    jobTitle: string;
    status: string;
    appliedAt: Date;
    interviewDate: Date | null;
    notes: string | null;
  }[];
}): string {
  const skills = user.skills.map((s) => s.name).join(", ") || "none listed";

  const appSummary = user.applications.length === 0
    ? "No applications logged yet."
    : user.applications.map((a) =>
        `- ${a.jobTitle} at ${a.company} [${a.status}]` +
        (a.interviewDate ? ` — interview: ${a.interviewDate.toDateString()}` : "") +
        (a.notes ? ` — notes: ${a.notes}` : "")
      ).join("\n");

  const statusCounts = user.applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return `
USER PROFILE:
- Target role: ${user.targetRole ?? "not set"}
- Experience level: ${user.experienceLevel ?? "not set"}
- Intent: ${user.intentState}
- Location: ${user.location ?? "not set"}
- Skills: ${skills}

APPLICATION SUMMARY:
- Total: ${user.applications.length}
- Applied: ${statusCounts.applied ?? 0}
- Interviewing: ${statusCounts.interviewing ?? 0}
- Offers: ${statusCounts.offer ?? 0}
- Rejected: ${statusCounts.rejected ?? 0}

APPLICATIONS:
${appSummary}
`.trim();
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { mode } = await req.json();
  if (!MODE_PROMPTS[mode]) {
    return Response.json({ error: "Invalid mode" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      skills: true,
      applications: { orderBy: { appliedAt: "desc" } },
    },
  });

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const context = buildContext(user);
  const prompt = MODE_PROMPTS[mode](context);

  const groqRes = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      stream: true,
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("[ai] Groq error:", err);
    return Response.json({ error: "Groq request failed" }, { status: 500 });
  }

  // Stream the SSE response directly to the client
  return new Response(groqRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}