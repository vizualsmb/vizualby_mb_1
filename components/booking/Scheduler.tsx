"use client";
import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import styles from "@/app/booking/portal.module.css";

export default function Scheduler({ session }: { session: { calLink: string; config: { name: string; email: string; notes: string } } }) {
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let disposed = false; let cleanup: (() => void) | undefined;
    getCalApi({ namespace: "mb-booking" }).then((cal) => {
      if (disposed) return;
      const successful = (event: CustomEvent<{ data: { uid?: string; paymentRequired?: boolean } }>) => {
        // This event only begins verification. It is never proof of payment.
        if (event.detail.data.uid && !event.detail.data.paymentRequired) router.push(`/booking/success?uid=${encodeURIComponent(event.detail.data.uid)}`);
      };
      const failure = () => setFailed(true);
      cal("ui", { theme: "dark", hideEventTypeDetails: true, layout: "month_view" });
      cal("on", { action: "bookingSuccessfulV2", callback: successful });
      cal("on", { action: "linkFailed", callback: failure });
      cleanup = () => { cal("off", { action: "bookingSuccessfulV2", callback: successful }); cal("off", { action: "linkFailed", callback: failure }); };
    }).catch(() => setFailed(true));
    return () => { disposed = true; cleanup?.(); };
  }, [router]);
  const url = new URL(`https://cal.com/${session.calLink}`);
  Object.entries(session.config).forEach(([key, value]) => url.searchParams.set(key, value));
  return <div className={styles.scheduler}><p className={styles.bodyCopy}>Review your selected date and details, then complete your payment securely. The calendar checks availability again when you reserve.</p>{failed ? <p role="alert" className={styles.error}>The embedded calendar couldn’t load. You can continue in a separate window below.</p> : <Cal namespace="mb-booking" calLink={session.calLink} config={{ ...session.config, theme: "dark", layout: "month_view" }} style={{ width: "100%", minHeight: 620, overflow: "auto" }} />}<a className={styles.textLink} href={url.toString()} target="_blank" rel="noreferrer">Open secure scheduling in a new tab <ArrowUpRight size={16} /></a><p className={styles.smallText}>If your Instagram browser has trouble with payment, open this link in Safari or Chrome. After payment, use the confirmation email to manage your booking.</p></div>;
}
