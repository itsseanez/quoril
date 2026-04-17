import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import styles from "./dashboard.module.css";

const INTENT_LABELS = {
  locked:      { label: "Locked",      desc: "Optimizing for your target role" },
  hybrid:      { label: "Hybrid",      desc: "Primary role + optional adjacent" },
  exploratory: { label: "Exploratory", desc: "Discovering your path" },
};

const BriefcaseIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <path d="M2 12h20"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

const SparklesIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
  </svg>
);

const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);

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

  // Next actions based on state
  const actions = [
    {
      icon: <SearchIcon />,
      title: "Browse your job feed",
      sub: intent === "locked"
        ? `Ranked listings for ${dbUser.targetRole ?? "your target role"}`
        : "Discover roles matched to your skills",
      href: "/jobs",
    },
    {
      icon: <BriefcaseIcon />,
      title: "Track an application",
      sub: stats.total === 0 ? "Log your first application" : `${stats.total} application${stats.total !== 1 ? "s" : ""} tracked so far`,
      href: "/applications",
    },
    {
      icon: <SparklesIcon />,
      title: "Get AI guidance",
      sub: intent === "exploratory"
        ? "Explore roles that fit your skills"
        : "Optimize your approach for your target role",
      href: "/ai",
    },
  ];

  //Upcoming Interviews
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
      {/* ── Topbar ── */}
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.topbarBrand}>Quoril</Link>
        <nav className={styles.topbarNav}>
          <Link href="/dashboard" className={`${styles.topbarLink} ${styles.topbarLinkActive}`}>Dashboard</Link>
          <Link href="/jobs"         className={styles.topbarLink}>Jobs</Link>
          <Link href="/applications" className={styles.topbarLink}>Applications</Link>
          <Link href="/profile"      className={styles.topbarLink}>Profile</Link>
        </nav>
        <div className={styles.topbarRight}>
          <UserButton />
        </div>
      </header>

      {/* ── Main ── */}
      <main className={styles.main}>

        {/* Header */}
        <div className={styles.header}>
          <p className={styles.greeting}>Good to see you</p>
          <div className={styles.headingRow}>
            <h1 className={styles.heading}>
              Hey, {firstName}.
            </h1>
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

          {/* Left — next actions */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>Next actions</span>
            </div>
            <div className={styles.actionsList}>
              {actions.map((a) => (
                <Link key={a.href} href={a.href} className={styles.actionItem}>
                  <div className={styles.actionIcon}>{a.icon}</div>
                  <div className={styles.actionText}>
                    <div className={styles.actionTitle}>{a.title}</div>
                    <div className={styles.actionSub}>{a.sub}</div>
                  </div>
                </Link>
              ))}
            </div>

            {stats.total === 0 ? (
              <>
                <div className={styles.divider} />
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateTitle}>No applications yet</div>
                  <div className={styles.emptyStateText}>
                    Browse your job feed and start tracking applications to see your progress here.
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.divider} />
                {upcomingInterviews.length > 0 ? (
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
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateTitle}>No upcoming interviews</div>
                    <div className={styles.emptyStateText}>
                      Keep applying — you've got {stats.total} application{stats.total !== 1 ? "s" : ""} out there.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right — profile sidebar */}
          <div>
            <div className={styles.profileCard}>
              <div className={styles.profileRow}>
                <span className={styles.profileName}>{firstName}</span>
                <div className={`${styles.intentBadge}`} style={{ fontSize: "11px", padding: "4px 10px" }}>
                  {dbUser.experienceLevel ?? "entry"}
                </div>
              </div>

              <div className={styles.profileMeta}>
                {dbUser.targetRole
                  ? `Targeting ${dbUser.targetRole}`
                  : "No target role set"}
                {dbUser.location ? ` · ${dbUser.location}` : ""}
              </div>

              {/* Progress */}
              {completeness < 100 && (
                <>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${completeness}%` }} />
                </div>
                <div className={styles.progressLabel}>{completeness}% profile complete</div>

                <div className={styles.divider} />
                </>
              )}

              {/* Fields */}
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