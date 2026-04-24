// lib/ingestion/utils/skills.ts

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const KNOWN_SKILLS = new Set([
  // Languages
  "python", "typescript", "javascript", "java", "go", "rust", "ruby",
  "swift", "kotlin", "scala", "c++", "c#", "php", "r",
  // Frontend
  "react", "next.js", "vue", "angular", "svelte", "tailwind", "css",
  "html", "webpack", "vite",
  // Backend
  "node.js", "express", "fastapi", "django", "rails", "spring",
  "graphql", "rest", "grpc",
  // Data / ML
  "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
  "pytorch", "tensorflow", "pandas", "spark", "dbt", "airflow",
  // Infra
  "aws", "gcp", "azure", "docker", "kubernetes", "terraform",
  "ci/cd", "github actions", "linux",
  // Practices
  "system design", "distributed systems", "microservices", "agile",
]);

export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return [...KNOWN_SKILLS].filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(lower);
  });
}

export async function extractSkillsWithAI(description: string): Promise<string[]> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 200,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You extract technical skills from job descriptions. " +
            "Return only a JSON array of skill name strings. " +
            "No explanation, no markdown, no preamble. " +
            'Example: ["Python", "AWS", "PostgreSQL"]',
        },
        {
          role: "user",
          content: description.slice(0, 1500),
        },
      ],
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Groq API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? "[]";
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    // Fall back to static extraction if the model returns unexpected output
    return extractSkills(description);
  }
}