import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CheckoutDraftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/api/assistant/redeem/${encodeURIComponent(token)}`);
}
