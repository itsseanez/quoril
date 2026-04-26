// lib/matching/ai-scorer.ts

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
import { prisma } from "@/lib/prisma";

export async function aiSemanticScore(
  userProfile: string,
  jobDescription: string
): Promise<number> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 10,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a technical recruiter. Given a candidate profile and a job description, " +
            "return ONLY a single integer from 0 to 100 representing how well the candidate " +
            "matches the role. 100 = perfect match, 0 = no match. No explanation, just the number.",
        },
        {
          role: "user",
          content: `CANDIDATE:\n${userProfile}\n\nJOB:\n${jobDescription.slice(0, 1000)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(8_000),
  });

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? "0";
  const score = parseInt(text, 10);
  return isNaN(score) ? 0 : Math.min(100, Math.max(0, score));
}


export async function computeAndCacheAIScore(
  userId: string,
  jobId: string,
  userProfile: string,
  jobDescription: string
): Promise<number> {
  // Check cache first
  const cached = await prisma.aIJobScore.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });

  if (cached) return cached.score;

  const score = await aiSemanticScore(userProfile, jobDescription);

  await prisma.aIJobScore.create({
    data: { userId, jobId, score },
  });

  return score;
}