"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartColumn, ClipboardList, CreditCard, Ellipsis, FolderKanban, LayoutDashboard, Package, Receipt, Settings, Users, Wallet, X } from "lucide-react";
import s from "./admin.module.css";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/finances", label: "Finances", icon: Wallet },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/admin/services", label: "Services", icon: Package },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
const TABS = ["/admin", "/admin/bookings", "/admin/clients", "/admin/finances"];

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

export function Brand() {
  return <Link href="/admin" className={s.brand} aria-label="Vizuals by MB admin home">
    <Image src="/logo/mb-white.png" alt="" width={30} height={27} priority /><span>VIZUAL BY MB<small>STUDIO OS</small></span>
  </Link>;
}

export function AdminNav({ email, signOut }: { email: string; signOut: () => Promise<void> }) {
  const path = usePathname();
  // The sheet belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (v: boolean) => setOpenOn(v ? path : null);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close);
  }, [open]);
  const links = (items: typeof NAV) => <ul className={s.navList}>
    {items.map(({ href, label, icon: Icon }) => <li key={href}><Link href={href} className={s.navLink} aria-current={isActive(path, href) ? "page" : undefined}><Icon size={17} strokeWidth={1.6} aria-hidden />{label}</Link></li>)}
  </ul>;
  const moreActive = !TABS.some((t) => isActive(path, t));

  return <>
    <aside className={s.sidebar}>
      <Brand />
      <nav aria-label="Admin">{links(NAV)}</nav>
      <div className={s.sidebarFoot}><span>{email}</span><form action={signOut}><button className={s.linkButton}>Sign out</button></form></div>
    </aside>

    <div className={s.mobileBar}><Brand /><form action={signOut}><button className={s.linkButton}>Sign out</button></form></div>
    <nav className={s.tabBar} aria-label="Admin">
      {NAV.filter((n) => TABS.includes(n.href)).map(({ href, label, icon: Icon }) =>
        <Link key={href} href={href} className={s.tab} aria-current={isActive(path, href) ? "page" : undefined}><Icon size={20} strokeWidth={1.6} aria-hidden />{label}</Link>)}
      <button type="button" className={s.tab} aria-expanded={open} aria-haspopup="dialog" aria-current={moreActive ? "page" : undefined} onClick={() => setOpen(true)}><Ellipsis size={20} strokeWidth={1.6} aria-hidden />More</button>
    </nav>
    {open && <div className={s.sheet} onClick={() => setOpen(false)}>
      <div className={s.sheetPanel} role="dialog" aria-modal="true" aria-label="More pages" onClick={(e) => e.stopPropagation()}>
        <div className={s.cardHead}><span className={s.metaText}>{email}</span><button type="button" className={s.linkButton} onClick={() => setOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
        {links(NAV.filter((n) => !TABS.includes(n.href)))}
      </div>
    </div>}
  </>;
}
