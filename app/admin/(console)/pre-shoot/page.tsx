import { PreShootManager } from "@/components/admin/PreShootManager";
import { requireAdmin } from "@/lib/admin/auth";
import { preShootData } from "@/lib/admin/pre-shoot";
import { Empty } from "@/components/admin/ui";
export const metadata = { title: "Pre-Shoot Check" };
export default async function PreShootPage() { const { supabase } = await requireAdmin(); const data = await preShootData(supabase); return data ? <PreShootManager {...data} /> : <Empty title="Pre-shoot setup is waiting for its database migration"><p>Apply the latest Supabase migration, then reopen this page.</p></Empty>; }
