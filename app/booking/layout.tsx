import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import styles from "./portal.module.css";

export const metadata: Metadata = {
  title: { absolute: "Book a production — VIZUAL BY MB", template: "%s — VIZUAL BY MB" },
  description: "A considered booking experience for films, brands, and the stories in between. Massachusetts + Rhode Island.",
  alternates: { canonical: "https://book.vizualbymb.com" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
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
