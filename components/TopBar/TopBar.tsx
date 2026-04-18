"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import styles from "./TopBar.module.css";

const NAV_LINKS = [
  { href: "/dashboard",    label: "Dashboard" },
  { href: "/jobs",         label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/profile",      label: "Profile" },
];

export default function Topbar() {
  const pathname = usePathname();

  return (
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
      </div>
    </header>
  );
}