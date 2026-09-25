import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import styles from "./portal.module.css";

const description = "A considered booking experience for films, brands, and the stories in between. Massachusetts + Rhode Island.";

export const metadata: Metadata = {
  title: { absolute: "Booking with MB", template: "%s — Booking with MB" },
  description,
  alternates: { canonical: "https://booking.vizualbymb.com" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: { type: "website", url: "https://booking.vizualbymb.com", title: "Booking with MB", description, siteName: "VIZUAL BY MB" },
  twitter: { card: "summary_large_image", title: "Booking with MB", description },
};

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.portal}>
    <header className={styles.header}>
      <a className={styles.brand} href="/booking" aria-label="VIZUAL BY MB booking home"><Image src="/logo/mb-white.png" alt="" width={42} height={37} priority /><span>VIZUAL BY MB<small>THE BOOKING ROOM</small></span></a>
      <a className={styles.portfolioLink} href="https://vizualbymb.com">Back to portfolio <ArrowUpRight size={16} /></a>
    </header>
    {children}
    <footer className={styles.footer}><nav aria-label="Booking footer"><a href="/booking/terms">Booking terms</a><a href="/booking/faq">Q&amp;A</a><a href="mailto:hello@vizualbymb.com">Let’s talk <ArrowUpRight size={14} /></a></nav></footer>
  </div>;
}
