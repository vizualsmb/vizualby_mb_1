import { Suspense } from "react";
import { Confirmation } from "@/components/booking/Confirmation";
import styles from "../portal.module.css";
export default function SuccessPage() { return <Suspense fallback={<main id="main-content" className={styles.success}>Checking your booking…</main>}><Confirmation /></Suspense>; }
