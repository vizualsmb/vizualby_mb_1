import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2).max(80).refine((value) => !/[\r\n]/.test(value)),
  email: z.email().max(160),
  message: z.string().trim().min(10).max(3000),
  website: z.string().max(0).optional(),
});

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwarded || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 20_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    if (isRateLimited(request)) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please check each field and try again." }, { status: 400 });

    const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = process.env;
    if (!RESEND_API_KEY || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) {
      return NextResponse.json({ error: "Email is not configured yet. Please email the studio directly." }, { status: 503 });
    }

    const resend = new Resend(RESEND_API_KEY);
    const { name, email, message } = parsed.data;
    const { error } = await resend.emails.send({
      from: CONTACT_FROM_EMAIL,
      to: CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `New portfolio inquiry from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "The message could not be sent. Please try again." }, { status: 500 });
  }
}
