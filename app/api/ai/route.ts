// app/api/ai/route.ts
//
// Streams a response from Groq using llama-3.3-70b-versatile.
// Requires GROQ_API_KEY in your .env

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a sharp, direct career coach specializing in software engineering job searches.
Your tone is honest and encouraging — like a senior engineer who genuinely wants to help.
Write in clean, flowing prose. Never use bold headers, bullet points, or markdown formatting of any kind.
Do not pad your response. Every sentence should earn its place.`;

const MODE_PROMPTS: Record<string, (ctx: string) => string> = {
  progress: (ctx) => `
Analyze this developer's job search progress and give an honest, specific summary in 3 short paragraphs.

First paragraph: assess how active they've been and what stages they're reaching.
Second paragraph: identify one clear pattern or problem you notice in their data.
Third paragraph: one specific encouragement grounded in something real about their profile — not generic.

Do not invent data. If they have no applications, say so directly and explain what that means.

${ctx}`,

  actions: (ctx) => `
Based on this developer's current situation, give them 5 concrete next actions to take this week.

Each action should be one sentence naming exactly what to do — specific to their actual data.
Follow each action with one sentence explaining why it matters right now.
Write it as a plain numbered list with no sub-bullets or headers.
Do not suggest anything generic like "update your LinkedIn" unless their data specifically supports it.

${ctx}`,

  skills: (ctx) => `
You are reviewing this developer's skills against their target role. Identify the 3-5 most important gaps.

For each gap write two sentences: what the skill is and why it matters for their specific target role, then one concrete way to address it — name an actual resource, project type, or technology.
Write it as a plain numbered list.
Cross-reference their project tech stacks — if they've used a skill in a project but haven't listed it, call that out as something to add rather than a gap.

${ctx}`,

  interview: (ctx) => `
Give this developer 5 interview questions they are likely to face for their target role.

For each question write three sentences: the question itself, why interviewers ask it, and one tip for answering it well.
Where their actual projects or work history give them a strong answer, mention that explicitly.
Write it as a plain numbered list. No headers, no sub-bullets.

${ctx}`,

  roles: (ctx) => `
Recommend 5 specific job roles or role variations this developer should be targeting right now.

For each role write two sentences: why it fits this specific person given their skills, experience level, and projects, then what kind of companies or teams typically hire for it.
Be precise — "early-stage B2B SaaS startup" is better than "tech company".
Write it as a plain numbered list.

${ctx}`,

  projects: (ctx) => `
Do a direct portfolio review of this developer's projects in 4 short paragraphs.

First paragraph: which project is strongest for job applications and exactly why.
Second paragraph: what is missing across their portfolio — be specific (no README, no tests, not deployed, no description, etc).
Third paragraph: pick their weakest project and give one specific improvement that would make it worth showing to a hiring manager.
Fourth paragraph: suggest one new project that would directly fill a visible gap given their target role and current stack — name it, describe it in one sentence, and say which technologies to use.

Reference their actual project names. Do not be vague.

${ctx}`,
};

function buildContext(user: {
  targetRole:      string | null;
  experienceLevel: string | null;
  intentState:     string;
  location:        string | null;
  skills: { name: string }[];
  applications: {
    company:       string;
    jobTitle:      string;
    status:        string;
    appliedAt:     Date;
    interviewDate: Date | null;
    notes:         string | null;
  }[];
  workHistory: {
    company:   string;
    title:     string;
    startDate: Date | null;
    endDate:   Date | null;
    summary:   string | null;
  }[];
  projects: {
    name:        string;
    description: string | null;
    url:         string | null;
    techStack:   string[];
    startDate:   Date | null;
    endDate:     Date | null;
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

  const workSummary = user.workHistory.length === 0
    ? "No work history on file."
    : user.workHistory.map((w) => {
        const start = w.startDate
          ? `${w.startDate.getFullYear()}-${String(w.startDate.getMonth() + 1).padStart(2, "0")}`
          : "?";
        const end = w.endDate
          ? `${w.endDate.getFullYear()}-${String(w.endDate.getMonth() + 1).padStart(2, "0")}`
          : "Present";
        return `- ${w.title} at ${w.company} (${start} — ${end})` +
               (w.summary ? `\n  ${w.summary}` : "");
      }).join("\n");

  const projectSummary = user.projects.length === 0
    ? "No projects on file."
    : user.projects.map((p) => {
        const stack = p.techStack.length > 0 ? p.techStack.join(", ") : "stack not listed";
        const end   = p.endDate
          ? `${p.endDate.getFullYear()}-${String(p.endDate.getMonth() + 1).padStart(2, "0")}`
          : "ongoing";
        return `- ${p.name} [${stack}]` +
               (p.description ? `\n  ${p.description}` : "") +
               (p.url ? `\n  URL: ${p.url}` : "") +
               `\n  Status: ${end}`;
      }).join("\n");

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

WORK HISTORY:
${workSummary}

PROJECTS:
${projectSummary}
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
      skills:       true,
      applications: { orderBy: { appliedAt: "desc" } },
      workHistory:  { orderBy: { order: "asc" } },
      projects:     { orderBy: { order: "asc" } },
    },
  });

  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const context = buildContext(user);
  const prompt  = MODE_PROMPTS[mode](context);

  const groqRes = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model:       "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: prompt },
      ],
      stream:      true,
      max_tokens:  1000,
      temperature: 0.5,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("[ai] Groq error:", err);
    return Response.json({ error: "Groq request failed" }, { status: 500 });
  }

  return new Response(groqRes.body, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}