import { NextRequest, NextResponse } from "next/server";
import { bookingStore } from "@/lib/booking/store";
import { ASSISTANT_DRAFT_COOKIE, draftKey, type AssistantDraft } from "@/lib/assistant/draft";
import { ASSISTANT_DRAFT_TTL } from "@/lib/assistant/config";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const draft = /^[a-f0-9]{64}$/.test(token) ? await bookingStore().get<AssistantDraft>(draftKey(token)) : null;
  if (!draft) return NextResponse.redirect(new URL("/checkout/review?expired=1", request.url));
  const response = NextResponse.redirect(new URL("/checkout/review", request.url));
  response.cookies.set(ASSISTANT_DRAFT_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ASSISTANT_DRAFT_TTL,
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
