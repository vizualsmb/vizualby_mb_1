import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

// Opens a receipt through a one-minute signed URL. The bucket itself is private.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const { data: expense } = await supabase.from("expenses").select("receipt_path").eq("id", id).maybeSingle();
  if (!expense?.receipt_path) return new NextResponse("Not found", { status: 404 });
  const { data } = await supabase.storage.from("receipts").createSignedUrl(expense.receipt_path, 60);
  if (!data?.signedUrl) return new NextResponse("Receipt unavailable", { status: 503 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
