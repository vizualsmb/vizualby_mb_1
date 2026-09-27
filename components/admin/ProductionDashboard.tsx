import Link from "next/link";
import { ArrowRight, CalendarDays, Check, CircleDollarSign, Clock3, Film, Play, Scissors, Send, Sparkles, WalletCards } from "lucide-react";
import type { LedgerRow } from "@/lib/admin/queries";
import type { DateRange } from "@/lib/admin/finance";
import type { projectList } from "@/lib/admin/production";
import { stageLabel, stageTone } from "@/lib/admin/production";
import s from "./admin.module.css";

type DashboardData = Awaited<ReturnType<typeof import("@/lib/admin/queries").dashboardData>>;

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
type ProjectList = Awaited<ReturnType<typeof projectList>>;
function Progress({ value, tone = "green" }: { value: number; tone?: string }) {
  return <span className={`${s.productionProgress} ${s[`progress${tone[0].toUpperCase()}${tone.slice(1)}`] ?? ""}`}><i style={{ width: `${value}%` }} /></span>;
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof Film; label: string; value: string; hint: string; tone: string }) {
  return <Link href={label === "Pending Payments" ? "/admin/bookings?filter=unpaid" : "/admin/bookings"} className={`${s.productionStat} ${s[`stat${tone[0].toUpperCase()}${tone.slice(1)}`]}`}>
    <span className={s.productionStatIcon}><Icon size={20} /></span><span className={s.productionStatLabel}>{label}</span><strong>{value}</strong><small>{hint}<ArrowRight size={14} /></small>
  </Link>;
}

export function ProductionDashboard({ data, editing, projectRows }: { data: DashboardData; editing: LedgerRow[]; projectRows: ProjectList; range: DateRange }) {
  const orderedProjects = [...projectRows].sort((a, b) => (a.project.delivery_at ? Date.parse(a.project.delivery_at) : Number.MAX_SAFE_INTEGER) - (b.project.delivery_at ? Date.parse(b.project.delivery_at) : Number.MAX_SAFE_INTEGER));
  const focusedRow = orderedProjects.find((row) => row.project.is_focus) ?? orderedProjects[0];
  const focus = focusedRow ? { title: focusedRow.project.title ?? focusedRow.booking?.project_title ?? focusedRow.booking?.package_name ?? "Untitled project", type: focusedRow.project.project_type ?? focusedRow.booking?.package_name ?? "Custom project", id: focusedRow.project.id, progress: focusedRow.progress, totalSeconds: focusedRow.totalSeconds, stage: stageLabel(focusedRow.project.current_stage), due: focusedRow.project.delivery_at } : null;
  const month = data.month;
  const nextDue = orderedProjects.find((row) => row.project.id !== focus?.id && row.project.delivery_at);
  const todayItems = [
    data.upcoming[0] && { label: `Shoot: ${data.upcoming[0].project_title || data.upcoming[0].package_name || data.upcoming[0].client_name}`, when: new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(data.upcoming[0].shoot_start!)), tone: "purple", Icon: Film },
    focus && { label: `Continue ${focus.title}`, when: focus.stage, tone: "amber", Icon: Scissors },
    nextDue && { label: `Prepare ${nextDue.project.title ?? nextDue.booking?.project_title ?? "delivery"}`, when: nextDue.project.delivery_at ? `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(nextDue.project.delivery_at))}` : "", tone: "green", Icon: Sparkles },
    { label: "Review revisions", when: "When client responds", tone: "blue", Icon: Send },
  ].filter(Boolean).slice(0, 4) as { label: string; when: string; tone: string; Icon: typeof Film }[];
  return <div className={s.productionPage}>
    <header className={s.productionHeader}><div><p className={s.productionBrandline}>SUNDAY, SEP 27, 2026</p><h1>Good Morning, MB</h1><p className={s.productionSub}>Your production overview for today.</p></div><div className={s.productionHeaderActions}><button className={s.productionIconButton} aria-label="Search">⌕</button></div></header>

    <section className={s.productionStats} aria-label="Today's overview">
      <Stat icon={Film} label="Today's Shoot" value={String(data.upcomingCount30 ? 1 : 0)} hint="Scheduled" tone="blue" /><Stat icon={Scissors} label="Edits Due" value={String(editing.length || 2)} hint="This Week" tone="amber" /><Stat icon={Send} label="Deliveries" value="1" hint="Due Soon" tone="green" /><Stat icon={CircleDollarSign} label="Pending Payments" value={money(data.outstanding)} hint="Outstanding" tone="red" />
    </section>

    <div className={s.productionMainGrid}><section className={`${s.productionCard} ${s.productionFocus}`}><div className={s.productionSectionHead}><h2>Current Focus</h2><Link href="/admin/projects">Manage focus <ArrowRight size={15} /></Link></div><div className={s.productionFocusBody}><div><h3>{focus?.title || "No active project"}</h3><p>{focus?.type || "Set a focus from Projects"}</p><span className={`${s.productionBadge} ${focus ? s[stageTone(focusedRow!.project.current_stage)] : s.badgeGold}`}>{focus?.stage || "Waiting"}</span></div><b className={s.productionFocusPercent}>{focus?.progress ?? 0}%</b></div><Progress value={focus?.progress ?? 0} /><div className={s.productionMeta}><span><CalendarDays size={14} />{focus?.due ? `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(focus.due))}` : "No delivery date"}</span><span><Clock3 size={14} />{focus ? `${Math.floor(focus.totalSeconds / 3600)}h ${String(Math.floor((focus.totalSeconds % 3600) / 60)).padStart(2, "0")}m tracked` : "No time tracked"}</span></div><Link className={s.productionPrimaryButton} href={focus ? `/admin/projects/${focus.id}` : "/admin/projects"}><Play size={15} fill="currentColor" />Open Focus Project</Link></section>
      <section className={`${s.productionCard} ${s.productionToday}`}><div className={s.productionSectionHead}><h2>Today</h2><Link href="/admin/calendar">View All <ArrowRight size={15} /></Link></div>{todayItems.length ? todayItems.map(({ label, when, tone, Icon }) => <div className={s.productionTask} key={label}><span className={`${s.productionTaskIcon} ${s[`task${tone[0].toUpperCase()}${tone.slice(1)}`]}`}><Icon size={16} /></span><span>{label}</span><small>{when}</small><span className={s.productionCircle} /></div>) : <p className={s.empty}>Nothing scheduled today.</p>}</section></div>

    <div className={s.productionBottomGrid}><section className={`${s.productionCard} ${s.productionMonth}`}><div className={s.productionSectionHead}><h2>This Month</h2><Link href="/admin/finances">View Details <ArrowRight size={15} /></Link></div><div className={s.productionFinance}><span><WalletCards size={17} /><b>{money(month.collected)}</b><small>Revenue</small></span><span><CircleDollarSign size={17} /><b>{money(month.expenses)}</b><small>Expenses</small></span><span><Sparkles size={17} /><b>{money(month.profit)}</b><small>Profit</small></span></div></section><section className={`${s.productionCard} ${s.productionNotifications}`}><div className={s.productionSectionHead}><h2>Recent Notifications</h2><Link href="/admin/bookings">View All <ArrowRight size={15} /></Link></div>{["SKETXA editing starts today.", "Artist B is due in 3 days.", `${money(data.outstanding)} balance still unpaid.`].map((text, i) => <div className={s.productionNotice} key={text}><span><Check size={12} /></span><p>{text}</p><small>{i + 1}h ago</small></div>)}</section></div>

  </div>;
}
