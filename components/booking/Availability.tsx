"use client";
import { Fragment, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import styles from "@/app/booking/portal.module.css";
import { STUDIO_HOURS_LABEL, isStudioDayOff, shootWindow, studioBlockFor, studioStartTimes } from "@/lib/booking/hours";

export function Availability({ live, packageId, minutes, onSelect }: { live: boolean; packageId: string; minutes: number; onSelect: (slot: string) => void }) {
  const [month, setMonth] = useState(() => live ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7) : "2026-10");
  const [date, setDate] = useState(""); const [time, setTime] = useState("");
  const [slots, setSlots] = useState<Record<string, { start: string }[]>>({});
  const [loadedMonth, setLoadedMonth] = useState(""); const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    fetch(`/api/booking/availability?packageId=${encodeURIComponent(packageId)}&month=${month}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSlots(data.slots); setLoadedMonth(month); setError("");
    }).catch((e) => { if (!controller.signal.aborted) { setError(e.message || "Availability couldn’t load."); setLoadedMonth(month); } });
    return () => controller.abort();
  }, [live, packageId, month, retry]);
  const monthDate = new Date(`${month}-01T12:00:00Z`);
  const days = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const loading = live && month !== loadedMonth;
  const demoSlots = date ? studioStartTimes(date, minutes) : [];
  const times = live ? slots[date] || [] : demoSlots;
  function changeMonth(direction: number) { const next = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + direction, 1)); setMonth(next.toISOString().slice(0, 7)); setDate(""); setTime(""); setError(""); }
  const initialMonth = new Date();
  const diff = (monthDate.getUTCFullYear() - initialMonth.getFullYear()) * 12 + monthDate.getUTCMonth() - initialMonth.getMonth();
  return <div className={styles.demoCalendar}>
    <div className={styles.calendarHeader}><div><p className={styles.eyebrow}>{live ? "LIVE STUDIO AVAILABILITY" : "SAMPLE SCHEDULE"}</p><h3>Find your moment.</h3></div><CalendarDays size={25} /></div>
    <p className={styles.smallText}>{live ? `Studio hours are ${STUDIO_HOURS_LABEL}. All times are shown in America/New_York. Your date is reserved after the deposit is paid.` : `Interactive preview — example times within studio hours (${STUDIO_HOURS_LABEL}), not live availability.`}</p>
    <div className={styles.calendarSplit}><div><div className={styles.monthLabel}><strong>{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate).toUpperCase()}</strong>{live && <span className={styles.monthButtons}><button type="button" disabled={diff <= 0 || loading} aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button><button type="button" disabled={diff >= 12 || loading} aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button></span>}</div>
    {error ? <div role="alert"><p className={styles.error}>{error}</p><button className={styles.outlineButton} onClick={() => { setLoadedMonth(""); setError(""); setRetry((n) => n + 1); }}>Try again</button></div> : <div className={styles.calendarDays} aria-busy={loading}>{["S", "M", "T", "W", "T", "F", "S"].map((day, i) => <span key={i}>{day}</span>)}{Array.from({ length: monthDate.getUTCDay() }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: days }, (_, i) => i + 1).map((day) => {
      const key = `${month}-${String(day).padStart(2, "0")}`;
      const available = live ? !loading && !!slots[key]?.length : !isStudioDayOff(key);
      return <button type="button" key={day} disabled={!available} aria-label={new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`))} aria-pressed={date === key} className={date === key ? styles.dateSelected : ""} onClick={() => { setDate(key); setTime(""); }}>{day}</button>;
    })}</div>}{loading && <p role="status" className={styles.smallText}>Checking the studio calendar…</p>}{live && !loading && !error && !Object.values(slots).some((s) => s.length) && <p className={styles.smallText}>No available dates this month. Try another month or contact the studio.</p>}</div>
    <div className={styles.timeSlots}><p>{date ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).toUpperCase() : "SELECT A DATE"}</p>{date ? times.map((slot, i) => { const block = studioBlockFor(slot.start, minutes)?.name; return <Fragment key={slot.start}>{block && block !== studioBlockFor(times[i - 1]?.start ?? "", minutes)?.name && <span className={styles.timeGroup}>{block}</span>}<button type="button" aria-pressed={time === slot.start} className={time === slot.start ? styles.timeSelected : ""} onClick={() => setTime(slot.start)}>{shootWindow(slot.start, minutes)}{time === slot.start && <Check size={14} />}</button></Fragment>; }) : <span className={styles.calendarHint}>Your available times will appear here.</span>}</div></div>
    <div className={styles.calendarBottom}><ShieldCheck size={16} /><p>{live ? "Only available times are shown. We’ll check your selection again before checkout." : "Preview only. No calendar is connected and no date will be reserved."}</p></div><button className={styles.primaryButton} disabled={!time || loading} onClick={() => onSelect(time)}>Continue to project details <ArrowRight size={18} /></button>
  </div>;
}
