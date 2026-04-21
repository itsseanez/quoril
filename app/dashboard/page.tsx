import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import styles from "./dashboard.module.css";
import TopBar from "@/components/TopBar/TopBar";
import AiActions from "@/components/AiActions/AiActions";

const INTENT_LABELS = {
  locked:      { label: "Locked",      desc: "Optimizing for your target role" },
  hybrid:      { label: "Hybrid",      desc: "Primary role + optional adjacent" },
  exploratory: { label: "Exploratory", desc: "Discovering your path" },
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const [clerkUser, dbUser] = await Promise.all([
    currentUser(),
    prisma.user.findUnique({
      where: { id: userId },
      include: { skills: true, applications: true },
    }),
  ]);

  if (!dbUser) redirect("/onboarding");

  const firstName = clerkUser?.firstName ?? "there";

  const stats = {
    applied:      dbUser.applications.filter(a => a.status === "applied").length,
    interviewing: dbUser.applications.filter(a => a.status === "interviewing").length,
    offers:       dbUser.applications.filter(a => a.status === "offer").length,
    total:        dbUser.applications.length,
  };

  const intent = (dbUser.intentState ?? "exploratory") as keyof typeof INTENT_LABELS;
  const intentInfo = INTENT_LABELS[intent];

  // Profile completeness
  const fields = [
    !!dbUser.intentState,
    !!dbUser.targetRole,
    !!dbUser.experienceLevel,
    !!dbUser.location,
    dbUser.skills.length > 0,
  ];
  const completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  // Upcoming interviews
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingInterviews = dbUser.applications
    .filter((a) => {
      if (!a.interviewDate) return false;
      const d = new Date(a.interviewDate);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    })
    .sort((a, b) =>
      new Date(a.interviewDate!).getTime() - new Date(b.interviewDate!).getTime()
    )
    .slice(0, 3);

  return (
    <div className={styles.shell}>
      <TopBar />

      <main className={styles.main}>

        {/* Header */}
        <div className={styles.header}>
          <p className={styles.greeting}>Good to see you</p>
          <div className={styles.headingRow}>
            <h1 className={styles.heading}>Hey, {firstName}.</h1>
            <div className={styles.intentBadge}>
              <span className={`${styles.intentDot} ${
                intent === "locked"      ? styles.intentDotLocked :
                intent === "hybrid"      ? styles.intentDotHybrid :
                styles.intentDotExploratory
              }`} />
              {intentInfo.label} — {intentInfo.desc}
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total</span>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statSub}>applications</div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Applied</span>
            <div className={styles.statValue}>{stats.applied}</div>
            <div className={styles.statSub}>awaiting response</div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Interviewing</span>
            <div className={styles.statValue}>{stats.interviewing}</div>
            <div className={styles.statSub}>in progress</div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Offers</span>
            <div className={styles.statValue}>{stats.offers}</div>
            <div className={styles.statSub}>received</div>
          </div>
        </div>

        {/* Two col grid */}
        <div className={styles.grid}>

          {/* Left — actions + upcoming interviews */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>This week's actions</span>
              <Link href="/ai" className={styles.cardLink}>Full breakdown →</Link>
            </div>

            <AiActions userId={userId} />

            {/* Upcoming interviews — shown when relevant */}
            {upcomingInterviews.length > 0 && (
              <>
                <div className={styles.divider} />
                <div className={styles.upcomingList}>
                  <span className={styles.upcomingHeading}>Upcoming interviews</span>
                  {upcomingInterviews.map((app) => (
                    <Link key={app.id} href="/applications" className={styles.upcomingItem}>
                      <div className={styles.upcomingLeft}>
                        <div className={styles.upcomingCompany}>{app.company}</div>
                        <div className={styles.upcomingRole}>{app.jobTitle}</div>
                      </div>
                      <div className={styles.upcomingDate}>
                        {new Date(app.interviewDate!).toLocaleDateString("en-US", {
                          month: "long", day: "numeric",
                        })}
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Right — profile sidebar */}
          <div>
            <div className={styles.profileCard}>
              <div className={styles.profileRow}>
                <span className={styles.profileName}>{firstName}</span>
                <div className={styles.intentBadge} style={{ fontSize: "11px", padding: "4px 10px" }}>
                  {dbUser.experienceLevel ?? "entry level"}
                </div>
              </div>

              <div className={styles.profileMeta}>
                {dbUser.targetRole ? `Targeting ${dbUser.targetRole}` : "No target role set"}
                {dbUser.location ? ` · ${dbUser.location}` : ""}
              </div>

              {completeness < 100 && (
                <>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${completeness}%` }} />
                  </div>
                  <div className={styles.progressLabel}>{completeness}% profile complete</div>
                  <div className={styles.divider} />
                </>
              )}

              <div className={styles.profileFields}>
                <div className={styles.profileField}>
                  <span className={styles.profileFieldLabel}>Intent</span>
                  <span className={styles.profileFieldValue}>{intentInfo.label}</span>
                </div>
                <div className={styles.profileField}>
                  <span className={styles.profileFieldLabel}>Target role</span>
                  {dbUser.targetRole
                    ? <span className={styles.profileFieldValue}>{dbUser.targetRole}</span>
                    : <span className={styles.profileFieldEmpty}>not set</span>
                  }
                </div>
                <div className={styles.profileField}>
                  <span className={styles.profileFieldLabel}>Location</span>
                  {dbUser.location
                    ? <span className={styles.profileFieldValue}>{dbUser.location}</span>
                    : <span className={styles.profileFieldEmpty}>not set</span>
                  }
                </div>
              </div>

              <Link href="/profile" className={styles.editLink}>
                Edit profile
              </Link>
            </div>

            {/* Skills card */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Skills</span>
                <Link href="/profile" className={styles.cardLink}>Edit</Link>
              </div>
              {dbUser.skills.length > 0 ? (
                <div className={styles.skillTags}>
                  {dbUser.skills.map(s => (
                    <span key={s.id} className={styles.skillTag}>{s.name}</span>
                  ))}
                </div>
              ) : (
                <span className={styles.emptySkills}>No skills added yet</span>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}