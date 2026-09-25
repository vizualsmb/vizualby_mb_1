import { Plus } from "lucide-react";
import styles from "../portal.module.css";
import { bookingPolicies } from "@/lib/booking/config";

export const metadata = {
  title: "Booking Q&A — VIZUAL BY MB",
  description: "Answers to common questions about packages, deposits, scheduling, and delivery.",
};

export default function BookingFaq() {
  const policies = bookingPolicies();
  const questions: [string, string][] = [
    ["What if my project needs a different scope?", "We build custom proposals for larger productions, additional shoot hours, travel, and specialist work. Email the studio with your idea and timeline."],
    ["Does the deposit go toward the total?", "Yes. Your deposit is part of your production total. The remaining balance is shown before you book."],
    ["Can I reschedule my shoot?", policies.rescheduling],
    ["When will I receive the final edit?", "Each package lists an estimated turnaround. We’ll align on delivery dates and what you need to provide before production."],
  ];

  return <main id="main-content" className={styles.legal}>
    <p className={styles.eyebrow}>BOOKING Q&amp;A</p>
    <h1>A few good<br /><em>questions.</em></h1>
    <p className={styles.bodyCopy}>Everything you need to know before choosing a package and reserving your production.</p>
    <div className={styles.faqPageList}>{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={18} /></summary><p>{answer}</p></details>)}</div>
    <p className={styles.smallText}>Still have a question? <a href="mailto:hello@vizualbymb.com">Talk to the studio.</a></p>
    <a href="/booking">Back to the booking room →</a>
  </main>;
}
