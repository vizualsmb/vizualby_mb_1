import { notFound } from "next/navigation";
import { PreShootFlow } from "@/components/admin/PreShootFlow";
import { requireAdmin } from "@/lib/admin/auth";
import { shootDetail } from "@/lib/admin/pre-shoot";
export default async function PreShootDetail({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const { supabase } = await requireAdmin(); const detail = await shootDetail(supabase, id); if (!detail) notFound(); return <PreShootFlow shoot={detail.shoot} items={detail.items} initialChecks={detail.finalChecks} />; }
