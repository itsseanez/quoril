"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import styles from "./TopBar.module.css";

const NAV_LINKS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/jobs",         label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/profile",      label: "Profile" },
];

export default function Topbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.topbarBrand}>
          Quoril
        </Link>
        <nav className={styles.topbarNav}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.topbarLink} ${
                pathname === href || pathname.startsWith(href + "/")
                  ? styles.topbarLinkActive
                  : ""
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.topbarRight}>
          <UserButton />
          <button
            className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ""}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span className={styles.hamburgerLine} />
            <span className={styles.hamburgerLine} />
            <span className={styles.hamburgerLine} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`${styles.mobileDrawer} ${menuOpen ? styles.mobileDrawerOpen : ""}`}
        aria-hidden={!menuOpen}
      >
        <nav className={styles.mobileNav}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`${styles.mobileNavLink} ${
                pathname === href || pathname.startsWith(href + "/")
                  ? styles.mobileNavLinkActive
                  : ""
              }`}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Backdrop */}
      {menuOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}