"use client";
import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowUpRight, Check, Clock3, CalendarPlus } from "lucide-react";
import { quoteFor, money } from "@/data/booking";
import styles from "@/app/booking/portal.module.css";

type Receipt = { state: string; uid: string; name: string; packageName: string; total: number; paymentOption: "deposit" | "full"; paid: number; balance: number; start: string; end: string };
const subscribe = () => () => {};
function previewSnapshot() { try { return sessionStorage.getItem("mb-booking-preview") || ""; } catch { return ""; } }
export function Confirmation() {
  const router = useRouter();
  const params = useSearchParams(); const preview = params.get("preview") === "1";
  const uid = params.get("uid") || "";
  const [verifiedReceipt, setReceipt] = useState<Receipt | null>(null); const [state, setState] = useState("verifying"); const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const savedPreview = useSyncExternalStore(subscribe, previewSnapshot, () => "");
  const previewReceipt = useMemo((): Receipt | null => {
    if (!preview || !savedPreview) return null;
    try {
      const saved = JSON.parse(savedPreview); const quote = quoteFor(saved.packageId, saved.addonIds, saved.paymentOption === "full" ? "full" : "deposit", saved.promotion, saved.package ? [saved.package] : undefined);
      const start = new Date(saved.slot);
      return { state: "preview", uid: "PREVIEW — NOT A RESERVATION", name: saved.name, packageName: quote.pkg.name, total: quote.total, paymentOption: quote.paymentOption, paid: quote.dueNow, balance: quote.balance, start: start.toISOString(), end: new Date(start.getTime() + quote.pkg.minutes * 60000).toISOString() };
    } catch { return null; }
  }, [preview, savedPreview]);
  const receipt = preview ? previewReceipt : verifiedReceipt?.uid === uid && state === "confirmed" ? verifiedReceipt : null;
  const message = error || (preview && !receipt ? "Select a package and sample date to preview your confirmation." : !preview && !uid ? "No booking reference was provided. Please use your confirmation email to view your booking." : "");
  useEffect(() => {
    let stop = false; let timeout: ReturnType<typeof setTimeout>; let attempts = 0;
    if (preview || !uid) return;
    async function check() {
      try {
        const response = await fetch(`/api/booking/status?uid=${encodeURIComponent(uid)}`, { cache: "no-store" });
        const data = await response.json(); if (stop) return;
        if (!response.ok) throw new Error(data.error || "We couldn’t verify this booking yet.");
        setState(data.state); setError("");
        if (data.state === "confirmed") { setReceipt(data); return; }
        if (data.state === "rescheduled" && data.nextUid) { router.replace(`/booking/success?uid=${encodeURIComponent(data.nextUid)}`); return; }
        if (["cancelled", "refunded", "needs_review"].includes(data.state)) return;
        attempts += 1;
        if (attempts < 12) timeout = setTimeout(check, 5000);
        else setError("Verification is taking longer than usual. Check your confirmation email before making another payment.");
      } catch (e) { if (!stop) setError(e instanceof Error ? e.message : "Please check your confirmation email."); }
    }
    void check(); return () => { stop = true; clearTimeout(timeout); };
  }, [preview, uid, retry, router]);
  const date = receipt ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" }).format(new Date(receipt.start)) : "";
  const time = receipt ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: "America/New_York" }).format(new Date(receipt.start)) : "";
  const calendar = receipt ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${receipt.packageName} — VIZUAL BY MB`)}&dates=${receipt.start.replace(/[-:]/g, "").replace(/\.\d{3}/, "")}/${receipt.end.replace(/[-:]/g, "").replace(/\.\d{3}/, "")}` : "";
  return <main id="main-content" className={styles.success}>
    {preview && <p className={styles.previewBanner}>PREVIEW ONLY — NO BOOKING OR PAYMENT HAS BEEN MADE</p>}
    <div className={styles.successIcon}>{receipt ? <Check size={24} /> : <Clock3 size={24} />}</div><p className={styles.eyebrow}>{receipt ? "THE BEGINNING OF SOMETHING GOOD" : "YOUR BOOKING STATUS"}</p>
    <h1>{receipt ? <>YOU’RE <em>{preview ? "ALMOST" : "BOOKED."}</em>{preview && <> <br />BOOKED.</>}</> : state === "cancelled" ? <>BOOKING <em>CANCELLED.</em></> : state === "refunded" ? <>PAYMENT <em>UPDATED.</em></> : <>CHECKING THE<br /><em>FINAL DETAILS.</em></>}</h1>
    <p className={styles.successLead}>{receipt ? preview ? "This is how your confirmation will feel. Your sample date and package are shown below; nothing has been reserved or charged." : `${receipt.name.split(" ")[0]}, your ${receipt.paymentOption === "full" ? "payment" : "deposit"} is verified and your production is on the calendar. Let’s make something worth watching.` : state === "refunded" ? "A refund has been recorded. Please check your email or contact the studio to confirm the current booking arrangements." : state === "cancelled" ? "Your appointment has been cancelled. Contact the studio with any questions about your deposit." : state === "needs_review" ? "Your payment needs a studio review. Please contact us before making another payment." : "We’re checking your payment and calendar confirmation. Please keep this page open and avoid submitting another payment."}</p>
    {message && <p role="alert" className={styles.error}>{message}</p>}
    {receipt && <><section className={styles.receipt}><div className={styles.receiptTop}><h2>{receipt.packageName}</h2><span>{preview ? "SAMPLE PRODUCTION" : "CONFIRMED PRODUCTION"}</span></div><dl><div><dt>Client</dt><dd>{receipt.name}</dd></div><div><dt>Booking reference</dt><dd>{receipt.uid}</dd></div><div><dt>Your date</dt><dd>{date}</dd></div><div><dt>Call time</dt><dd>{time}</dd></div><div><dt>Production total</dt><dd>{money(receipt.total)}</dd></div><div><dt>{preview ? "Sample " : ""}{receipt.paymentOption === "full" ? (preview ? "full payment" : "Paid in full") : (preview ? "deposit" : "Deposit paid")}</dt><dd>{money(receipt.paid)}</dd></div><div><dt>Remaining balance</dt><dd>{money(receipt.balance)}</dd></div></dl></section><div className={styles.successActions}>{!preview && <a href={calendar} target="_blank" rel="noreferrer" className={styles.primaryButton}>Add to Google Calendar <CalendarPlus size={17} /></a>}<a href="mailto:hello@vizualbymb.com" className={styles.outlineButton}>Contact the studio <ArrowUpRight size={17} /></a><a href="/booking" className={styles.outlineButton}>{preview ? "Back to preview" : "Book another production"}<ArrowUpRight size={17} /></a></div><section className={styles.nextSteps}><div><h3>LET’S GET READY.</h3><p>Gather your visual references, confirm access to your location, and share any important timing details. The studio will follow up with the creative plan before your shoot.</p></div><div><h3>YOUR BOOKING, IN ONE PLACE.</h3><p>Your Cal.com confirmation email contains the calendar invitation and secure links to view, reschedule, or cancel according to your booking terms.</p><a className={styles.textLink} href="/booking/terms">Read your booking terms <ArrowUpRight size={15} /></a></div></section></>}
    {!receipt && <div className={styles.successActions}><button className={styles.primaryButton} onClick={() => setRetry((n) => n + 1)}>Check status again <ArrowUpRight size={17} /></button><a className={styles.outlineButton} href="mailto:hello@vizualbymb.com">Contact the studio <ArrowUpRight size={17} /></a><a href="/booking" className={styles.textLink}>Back to booking</a></div>}
  </main>;
}
