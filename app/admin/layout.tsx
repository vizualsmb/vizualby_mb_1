import type { Metadata, Viewport } from "next";
import s from "@/components/admin/admin.module.css";

export const metadata: Metadata = {
  title: { absolute: "Studio OS — Vizuals by MB", template: "%s — Studio OS" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};
export const viewport: Viewport = { themeColor: "#0e0f0e", colorScheme: "dark" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className={s.root}>{children}</div>;
}
