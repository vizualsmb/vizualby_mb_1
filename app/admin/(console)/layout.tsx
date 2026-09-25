import s from "@/components/admin/admin.module.css";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "@/lib/admin/session-actions";

// Always rendered per request: this is private, per-user data.
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { email, mode } = await requireAdmin();
  return <div className={s.shell}>
    <AdminNav email={email} signOut={signOut} />
    <main className={s.main} id="main-content">
      {mode !== "signed-in" && <p className={s.devBanner} role="status"><b>Login bypassed</b> (local development only).{" "}
        {mode === "dev-bypass-demo" ? "Showing fictional demo data. Changes last until the dev server restarts." : "Showing your real Supabase data."}</p>}
      {children}
    </main>
  </div>;
}
