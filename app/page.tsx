"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import styles from "./home.module.css";
import { SignUpButton, SignInButton } from '@clerk/nextjs'

const BriefcaseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    <line x1="12" y1="12" x2="12" y2="12.01" />
    <path d="M2 12h20" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
  </svg>
);

const LayersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const BrainIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
    <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
    <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
    <path d="M6 18a4 4 0 0 1-1.967-.516" />
    <path d="M19.967 17.484A4 4 0 0 1 18 18" />
  </svg>
);

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const features = [
  {
    icon: <SparklesIcon />,
    title: "Smart job matching",
    description:
      "AI adapts to your intent — locked on a target role, or still exploring. Your feed reshapes accordingly, not the other way around.",
  },
  {
    icon: <BriefcaseIcon />,
    title: "Application tracker",
    description:
      "One dashboard for every application. Track status from applied to offer, add notes, and never lose track of where things stand.",
  },
  {
    icon: <LayersIcon />,
    title: "Multi-source ingestion",
    description:
      "Jobs pulled directly from Greenhouse, Lever, and more. No scrapers, no noise — only real openings from companies that are hiring.",
  },
  {
    icon: <BrainIcon />,
    title: "Skill-based fit scores",
    description:
      "Each listing is scored against your actual skills. See why a role ranked high, what gaps exist, and how to close them fast.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create your profile",
    description:
      "Add your skills, experience level, and — if you know it — your target role. Tell us how locked-in you are.",
  },
  {
    number: "02",
    title: "Get matched to jobs",
    description:
      "The ranking engine scores every listing against your profile. Exploratory or focused, you see the right opportunities first.",
  },
  {
    number: "03",
    title: "Track every application",
    description:
      "Log applications, move them through stages, and let the AI surface what to do next to improve your chances.",
  },
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

function RevealSection({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      {/* ── Navbar ── */}
      <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
        <Link href="/" className={styles.navBrand}>Quoril</Link>

        <div className={styles.navLinks}>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
        </div>

        <div className={styles.navActions}>
          <SignInButton mode="modal">
            <button className={styles.btnGhost}>Log in</button>
          </SignInButton>
          <SignUpButton mode="modal" forceRedirectUrl="/onboarding">
            <button className={styles.btnPrimary}>Get started</button>
          </SignUpButton>
        </div>

        <button
          className={styles.hamburger}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {menuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* ── Mobile menu ── */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ""}`}>
        <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
        <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
        <a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
        <SignInButton mode="modal">
          <button className={styles.mobileMenuLink} onClick={() => setMenuOpen(false)}>
            Log in
          </button>
        </SignInButton>
        <SignUpButton mode="modal" forceRedirectUrl="/onboarding">
          <button className={styles.mobileMenuLink} onClick={() => setMenuOpen(false)}>
            Get started →
          </button>
        </SignUpButton>
      </div>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <SparklesIcon />
            AI-powered job search
          </div>
          <h1 className={styles.heroH1}>
            Find jobs <em>smarter,</em>
            <br />not harder.
          </h1>
          <p className={styles.heroSub}>
            Quoril is an adaptive AI job search system for CS students. It learns your intent,
            ranks real opportunities against your skills, and helps you track every application — all in one place.
          </p>
          <div className={styles.heroCtas}>
            <SignUpButton mode="modal" forceRedirectUrl="/onboarding">
            <button className={styles.btnHeroPrimary}>Get started <ArrowRight /></button>
            </SignUpButton>
            <a href="#features" className={styles.btnHeroSecondary}>
              View jobs
            </a>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className={styles.dividerWrap}>
        <div className={styles.divider} />
      </div>

      {/* ── Features ── */}
      <section id="features" className={styles.featuresSection}>
        <div className={styles.sectionInner}>
          <RevealSection>
            <p className={styles.sectionLabel}>What you get</p>
            <h2 className={styles.sectionHeading}>
              Built for the job search
              <br />you actually have
            </h2>
          </RevealSection>
          <div className={styles.featuresGrid}>
            {features.map((f, i) => (
              <RevealSection key={f.title} delay={i * 80}>
                <div className={styles.featureCard}>
                  <div className={styles.featureIcon}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className={styles.howItWorksSection}>
        <div className={styles.sectionInner}>
          <RevealSection>
            <p className={styles.sectionLabel}>Process</p>
            <h2 className={styles.sectionHeading}>
              Three steps to your
              <br />next role
            </h2>
          </RevealSection>
          <div className={styles.stepsGrid}>
            {steps.map((s, i) => (
              <RevealSection key={s.number} delay={i * 100}>
                <div className={styles.step}>
                  <span className={styles.stepNumber}>{s.number}</span>
                  <h3>{s.title}</h3>
                  <p>{s.description}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="cta" className={styles.ctaSection}>
        <RevealSection>
          <div className={styles.ctaInner}>
            <h2>Start applying smarter today</h2>
            <p>No noise. No guesswork. Just the right jobs, ranked for you.</p>
            <SignUpButton mode="modal" forceRedirectUrl="/onboarding">
            <button className={styles.btnCta}>Create free account <ArrowRight /></button>
            </SignUpButton>
          </div>
        </RevealSection>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>Quoril</span>
          <div className={styles.footerLinks}>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </div>
          <span className={styles.footerCopy}>© {new Date().getFullYear()} Quoril</span>
        </div>
      </footer>
    </>
  );
}