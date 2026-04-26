import { prisma } from "@/lib/prisma";
import { fingerprintJob } from "./fingerprint";

export interface UserSignals {
  companyBoosts: Map<string, number>;    // companySlug → boost pts
  suppressedFingerprints: Set<string>;   // job fingerprints to penalize
  skillWeights: Map<string, number>;     // skillName → weight multiplier
}

export class FeedbackEngine {
  /**
   * Load pre-computed signals for a user from the DB.
   * Fast path — called on every job fetch.
   */
  async getUserSignals(userId: string): Promise<UserSignals> {
    const signals = await prisma.userMatchSignal.findMany({
      where: { userId },
    });

    const companyBoosts = new Map<string, number>();
    const suppressedFingerprints = new Set<string>();
    const skillWeights = new Map<string, number>();

    for (const s of signals) {
      if (s.signalType === "company_boost" && s.companySlug) {
        companyBoosts.set(s.companySlug, s.companyBoost * s.confidence);
      }
      if (s.signalType === "suppression" && s.jobFingerprint) {
        if (s.suppressed) suppressedFingerprints.add(s.jobFingerprint);
      }
      if (s.signalType === "skill_weight" && s.skillName) {
        skillWeights.set(s.skillName.toLowerCase(), s.skillWeight * s.confidence);
      }
    }

    return { companyBoosts, suppressedFingerprints, skillWeights };
  }

  /**
   * Recompute and persist signals for a user based on their full
   * application history. Called after an outcome is recorded.
   */
  async recomputeSignals(userId: string): Promise<void> {
    const applications = await prisma.application.findMany({
      where: { userId },
      include: { job: true },
    });

    const upserts: Parameters<typeof prisma.userMatchSignal.upsert>[0][] = [];

    // ── Company boosts ──────────────────────────────────────────────────────
    // Group applications by company, score by outcomes
    const companyOutcomes = new Map<string, { interviews: number; offers: number; rejections: number }>();

    for (const app of applications) {
      if (!app.company) continue;
      const slug = app.company.toLowerCase().replace(/\s+/g, "-");
      const current = companyOutcomes.get(slug) ?? { interviews: 0, offers: 0, rejections: 0 };

      if (app.status === "interview" || app.status === "offer") current.interviews++;
      if (app.status === "offer") current.offers++;
      if (app.status === "rejected") current.rejections++;

      companyOutcomes.set(slug, current);
    }

    for (const [slug, outcomes] of companyOutcomes) {
      const boost = Math.min(
        10,
        outcomes.offers * 5 + outcomes.interviews * 3 - outcomes.rejections * 1
      );
      if (boost <= 0) continue;

      upserts.push({
        where: {
          userId_signalType_companySlug_skillName_jobFingerprint: {
            userId,
            signalType: "company_boost",
            companySlug: slug,
            skillName: "",
            jobFingerprint: "",
          },
        },
        create: {
          userId,
          signalType: "company_boost",
          companySlug: slug,
          companyBoost: boost,
          confidence: 1.0,
        },
        update: { companyBoost: boost, confidence: 1.0 },
      });
    }

    // ── Suppression signals ─────────────────────────────────────────────────
    // Suppress jobs similar to ones that were rejected or ghosted
    for (const app of applications) {
      if (app.status !== "rejected") continue;
      if (!app.job) continue;

      const fingerprint = fingerprintJob(app.job);

      upserts.push({
        where: {
          userId_signalType_companySlug_skillName_jobFingerprint: {
            userId,
            signalType: "suppression",
            companySlug: "",
            skillName: "",
            jobFingerprint: fingerprint,
          },
        },
        create: {
          userId,
          signalType: "suppression",
          jobFingerprint: fingerprint,
          suppressed: true,
          confidence: 0.7, // not fully suppressed — just penalized
        },
        update: { suppressed: true },
      });
    }

    // ── Skill weights ───────────────────────────────────────────────────────
    // Boost skills that appear in jobs where the user got interviews
    const skillOutcomes = new Map<string, { positive: number; negative: number }>();

    for (const app of applications) {
      if (!app.job?.extractedSkills) continue;
      const isPositive = app.status === "interview" || app.status === "offer";
      const isNegative = app.status === "rejected";
      if (!isPositive && !isNegative) continue;

      for (const skill of app.job.extractedSkills) {
        const lower = skill.toLowerCase();
        const current = skillOutcomes.get(lower) ?? { positive: 0, negative: 0 };
        if (isPositive) current.positive++;
        if (isNegative) current.negative++;
        skillOutcomes.set(lower, current);
      }
    }

    for (const [skill, outcomes] of skillOutcomes) {
      const total = outcomes.positive + outcomes.negative;
      if (total < 2) continue; // not enough data
      const weight = 0.5 + (outcomes.positive / total); // 0.5–1.5
      upserts.push({
        where: {
          userId_signalType_companySlug_skillName_jobFingerprint: {
            userId,
            signalType: "skill_weight",
            companySlug: "",
            skillName: skill,
            jobFingerprint: "",
          },
        },
        create: {
          userId,
          signalType: "skill_weight",
          skillName: skill,
          skillWeight: weight,
          confidence: Math.min(1, total / 5),
        },
        update: {
          skillWeight: weight,
          confidence: Math.min(1, total / 5),
        },
      });
    }

    // Persist all signals in one transaction
    await prisma.$transaction(
      upserts.map((u) => prisma.userMatchSignal.upsert(u))
    );
  }
}