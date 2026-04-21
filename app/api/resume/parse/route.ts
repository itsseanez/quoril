// app/api/resume/parse/route.ts
//
// POST /api/resume/parse
// Sends Adobe-extracted resume text to Groq and returns a structured preview.
// Nothing is written to the DB here — that happens in /api/resume/apply.
//
// Body:    { rawText: string }
// Returns: { preview: ParsedResume }

import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface ParsedResume {
  targetRole:      string | null;
  experienceLevel: "entry" | "mid" | "senior" | null;
  location:        string | null;
  skills:          string[];
  workHistory: {
    company:   string;
    title:     string;
    startDate: string | null;
    endDate:   string | null;
    summary:   string | null;
  }[];
  projects: {
    name:        string;
    description: string | null;
    url:         string | null;
    techStack:   string[];
    startDate:   string | null;
    endDate:     string | null;
  }[];
}

const SYSTEM_PROMPT = `You are a resume parser for a developer job search app. Extract structured data from the resume text.

Return ONLY a valid JSON object. No markdown fences, no explanation, no preamble. First character must be {

JSON shape:
{
  "targetRole": string | null,
  "experienceLevel": "entry" | "mid" | "senior" | null,
  "location": string | null,
  "skills": string[],
  "workHistory": [
    {
      "company": string,
      "title": string,
      "startDate": "YYYY-MM" | null,
      "endDate": "YYYY-MM" | null,
      "summary": string | null
    }
  ],
  "projects": [
    {
      "name": string,
      "description": string | null,
      "url": string | null,
      "techStack": string[],
      "startDate": "YYYY-MM" | null,
      "endDate": "YYYY-MM" | null
    }
  ]
}

Rules:
- targetRole: most recent job title, or desired role if stated in objective/summary
- experienceLevel: entry (<2 yrs), mid (2-6 yrs), senior (6+ yrs)
- location: city and state/country or null
- skills: technical tools, languages, frameworks only — max 20, no soft skills
- workHistory: most recent first, max 8 entries
- workHistory[].endDate: null means current role
- workHistory[].summary: one sentence on role and key contribution, or null
- projects: include personal, academic, open-source, and freelance — max 8
- projects[].url: GitHub link, live URL, or null
- projects[].techStack: languages/frameworks used in that specific project
- projects[].endDate: null means ongoing
- dates: always "YYYY-MM" format
- unknown fields: use null`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const rawText: string = body.rawText ?? "";

  if (!rawText.trim()) {
    return Response.json(
      { error: "No text to parse. Try re-uploading your resume." },
      { status: 422 }
    );
  }

  const truncated = rawText.slice(0, 10000);

  const groqRes = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: `Parse this resume:\n\n${truncated}` },
      ],
      stream: false,
      max_tokens: 1600,
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text();
    console.error("[resume/parse] Groq error:", err);
    return Response.json({ error: "Parse request failed" }, { status: 500 });
  }

  const groqData = await groqRes.json();
  const text: string = groqData.choices?.[0]?.message?.content ?? "";

  let preview: ParsedResume;
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const raw = JSON.parse(cleaned);

    preview = {
      targetRole:      raw.targetRole      ?? null,
      experienceLevel: raw.experienceLevel ?? null,
      location:        raw.location        ?? null,
      skills:          Array.isArray(raw.skills) ? raw.skills : [],
      workHistory: Array.isArray(raw.workHistory)
        ? raw.workHistory.map((w: Partial<ParsedResume["workHistory"][number]>) => ({
            company:   w.company   ?? "Unknown company",
            title:     w.title     ?? "Unknown title",
            startDate: w.startDate ?? null,
            endDate:   w.endDate   ?? null,
            summary:   w.summary   ?? null,
          }))
        : [],
      projects: Array.isArray(raw.projects)
        ? raw.projects.map((p: Partial<ParsedResume["projects"][number]>) => ({
            name:        p.name        ?? "Untitled project",
            description: p.description ?? null,
            url:         p.url         ?? null,
            techStack:   Array.isArray(p.techStack) ? p.techStack : [],
            startDate:   p.startDate   ?? null,
            endDate:     p.endDate     ?? null,
          }))
        : [],
    };
  } catch {
    console.error("[resume/parse] JSON parse failed. Raw response:", text);
    return Response.json(
      { error: "Failed to parse model response. Try uploading again." },
      { status: 500 }
    );
  }

  return Response.json({ preview });
}