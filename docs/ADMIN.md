# Vizuals by MB — Studio OS (private admin)

Private business dashboard at `/admin`, served at the root of **admin.vizualbymb.com**. It runs in the same Next.js app and Vercel project as the portfolio and the booking site.

- [1. Audit of the existing project](#1-audit-of-the-existing-project)
- [2. Architecture](#2-architecture)
- [3. Database](#3-database)
- [4. Pages](#4-pages)
- [5. Data flow](#5-data-flow)
- [6. Stripe](#6-stripe)
- [7. Cal.com and calendar](#7-calcom-and-calendar)
- [8. Authentication and security](#8-authentication-and-security)
- [9. Financial logic](#9-financial-logic)
- [10. Mobile](#10-mobile)
- [11. Setup (one-time)](#11-setup-one-time)
- [12. Phases and what is left](#12-phases-and-what-is-left)
- [12a. Automation (Phase 5)](#12a-automation-phase-5)
- [13. Files](#13-files)

---

## 1. Audit of the existing project

**Stack.** Next.js 16.3 (App Router, Turbopack), React 19.3, TypeScript (strict), CSS Modules plus `globals.css` (no Tailwind), zod 4, Stripe SDK 22, Upstash Redis, Resend and `@calcom/embed-react`. It is deployed to Vercel with the CLI. There was no git repository (now initialised).

**Structure.** `app/` holds the portfolio pages, `app/booking/*` the booking portal, and `app/api/booking/*` plus `app/api/contact`. `components/` holds the portfolio and `components/booking/`. `data/` holds site content and the booking catalog (`data/booking.ts`, `data/music-booking.ts`). `lib/booking/` holds config, the Redis store, the Cal client, signature checks and reconciliation.

**Booking flow (unchanged).**
1. The client picks a package and add-ons in `/booking`.
2. `POST /api/booking/session` validates prices and the slot on the server, then saves a draft in Redis.
3. The client pays the deposit through Cal.com's native Stripe payment.
4. The signed Cal webhook (`/api/booking/webhooks/cal`) and the signed Stripe webhook (`/api/booking/webhooks/stripe`) reconcile the booking in Redis.
5. The success page confirms only after both proofs match.

It is carefully built: raw-body signatures, monotonic refund handling, replay-safe ordering, and fail-closed behavior.

**What was missing for an admin.** Redis holds booking records for one year as key-value blobs. Nothing can be queried by date, client or status, and nothing covers clients, expenses, manual payments or balance tracking. There was no authentication anywhere.

**Security notes.**
- The booking portal is protected by obscurity and `noindex` only. This is fine for a public booking page and is documented in BOOKING.md.
- `/api/contact` uses an in-memory rate limiter, which resets on every serverless cold start. Consider moving it to the Upstash limiter already in use.
- No secrets are `NEXT_PUBLIC_`. This was verified: the client bundle contains no admin secret names.

**Potential issues found.**
- `intakeSchema.referral` existed but the booking form never asked it. **Fixed:** the intake step now has an optional "How did you find us?" question, which feeds lead-source analytics.
- There was no git history. **Fixed:** git is initialised with a baseline commit.
- The browser tests in `tests/browser/booking.spec.ts` are out of date: they look for a "LET'S MAKE" heading and category names ("Brand films", "Event coverage") that the current booking UI no longer has, so they fail before reaching the form. This predates the admin work.

**Recommendation.**
- **Stay:** the whole booking and payment flow, the Redis reconciliation, and `data/booking.ts` as the catalog for now. Its prices must match the Cal event deposits, and the session route checks this on the server.
- **Add:** Supabase Postgres as the admin's source of truth, fed automatically by the existing webhooks.
- **Refactor later:** move the catalog into the database once the admin can safely keep it in sync with Cal event prices (Phase 4).
- **Remove:** nothing.

## 2. Architecture

```
Browser ──> proxy.ts (refresh session, redirect signed-out) ──> /admin Server Components
                                                                  │  requireAdmin(): verify JWT + admins allowlist
                                                                  ▼
                                                   Supabase (user's session) ── RLS: is_admin()
Cal webhook ──┐
              ├─> existing Redis reconciliation ─> syncBookingToAdmin() ─> Supabase (service role)
Stripe webhook┘
```

- **Server-first.** Every admin page is a Server Component that queries Postgres directly. Client JavaScript is limited to the nav, the chart, and form pending states. Forms are Server Actions and work without JavaScript.
- **Two Supabase clients.** `lib/supabase/server.ts` acts as the signed-in admin, so Row Level Security applies to every query. `lib/supabase/service.ts` uses the secret key and is only used in the webhooks and the pre-login allowlist check.
- **No browser Supabase client.** No Supabase key reaches the browser at all.

## 3. Database

Migration: `supabase/migrations/20260924000000_admin_foundation.sql`. It was validated on a real Postgres engine with a stub auth schema, including triggers, views and RLS for an admin, a non-admin and an anonymous user.

| Table | Purpose |
|---|---|
| `admins` | Allowlist (`user_id` → `auth.users`). Rows are only insertable from the SQL editor. |
| `clients` | One per person. Unique by lowercase email. |
| `bookings` | Status pipeline, shoot times, and snapshots of package name and price. `total_cents` is generated as package + add-ons + adjustment. `balance_due_date` is optional; when empty, the balance is due on the shoot day. |
| `booking_addons` | Snapshot of the add-ons chosen at booking time. |
| `payments` | One row per payment. `stripe_payment_intent_id` is unique, which makes webhook syncs idempotent. Refunds are `refunded_cents` on the original payment (Stripe's model), so there is one way to express a refund. |
| `expenses` | Manual costs, optionally linked to a booking. |
| `booking_events` | The booking timeline. Status changes and payment events are **written by triggers**, so the timeline cannot drift from the data. Admin notes are added here too. |
| `business_settings` | A single row. |
| `audit_logs` | Records sensitive admin actions: refunds, deletions and settings changes. |

**Views** (`security_invoker`, so the caller's RLS applies):
- `booking_ledger` joins each booking with its client and adds `paid_cents`, `refunded_cents`, `balance_cents`, `due_date` and `payment_state`. Payment state is one of unpaid, partially paid, deposit paid, paid, overdue, refunded or canceled.
- `client_summary` adds booking count, first and last booking, lifetime revenue, booked value, outstanding balance and next shoot.

**Deliberately not created yet** (to avoid tables that duplicate something else):
- `packages` / `services`: the catalog lives in `data/booking.ts` until Phase 4. Bookings store `package_id` plus snapshots.
- `inquiries`: an inquiry is a booking with status `new_inquiry`.
- `lead_sources`: an enum.
- `calendar_events`: not needed yet; the calendar reads bookings directly. (`notifications` was added in Phase 5.)

## 4. Pages

| Route | What it does |
|---|---|
| `/admin` | KPIs, revenue/expense/profit chart with range filter, next 5 shoots, payments due, pipeline counts, overdue banner |
| `/admin/bookings` | Filters (upcoming, this week, this month, balance due, paid, deposit pending, in post, delivered, canceled, archived), search (name, email, phone, project, ID), pagination; a table on desktop and cards on mobile |
| `/admin/bookings/[id]` | Shoot and client details, brief, money breakdown with a progress bar, status change, off-Stripe payments and refunds, edit details, timeline with notes, project costs and margin |
| `/admin/bookings/new` | Manual booking for DM, phone or email bookings; creates the client if needed |
| `/admin/clients`, `/admin/clients/[id]` | CRM list (recent or top revenue, search); profile with lifetime value, outstanding, average, last and next project, payment history, editable contact, type and notes |
| `/admin/calendar` | Month grid (dots on phones) plus an agenda of shoots and balance due dates |
| `/admin/payments` | All payments with status filters |
| `/admin/finances` | Booked value, revenue collected, outstanding, refunds, expenses, net profit and margin, average booking value, chart, spending by category, and the formulas in plain language |
| `/admin/expenses` | Add or delete expenses, category breakdown, project costs versus overhead |
| `/admin/analytics` | Revenue by service, package, lead source and client; bookings by month; conversion; repeat rate; lead time; average open balance; most profitable and most popular service |
| `/admin/services` | The live catalog with its online status and per-package performance (read-only for now) |
| `/admin/settings` | Business settings and connection status for each integration |

Loading skeletons, an error boundary (which detects offline), empty states for every list, and "not configured" and "unauthorized" states on the login page are included.

## 5. Data flow

1. **The client books on the website.** The Cal `BOOKING_CREATED` webhook runs the existing Redis logic, then `syncBookingToAdmin(uid)`, which upserts the client (by email) and the booking (by portal reference) with status *Deposit pending*.
2. **The client pays the deposit.** Cal `BOOKING_PAID` and Stripe `payment_intent.succeeded` each trigger a sync. A payment row is upserted by PaymentIntent id, and the status moves to *Deposit paid* and then *Confirmed* once reconciliation verifies it.
3. **A refund is made in Stripe.** `charge.refunded` triggers a sync, which updates `refunded_cents` (the original payment date is kept). The timeline gets a "Refund" entry and revenue drops automatically.
4. **The client reschedules or cancels in Cal.** The same booking row gets the new times and uid, or is set to *Canceled*.
5. **Your own work.** Status changes, notes, off-Stripe payments and expenses are Server Actions against Postgres.

Automation only moves early statuses forward (up to *Confirmed*) or cancels. It never overrides a status you set later in the pipeline. If the admin database is not configured, sync is skipped and booking keeps working. If a database write fails, the webhook returns 503 so Cal or Stripe retries. All sync writes are idempotent.

## 6. Stripe

- Deposits are charged through Cal's Stripe app, which is unchanged. The existing webhook still verifies the signature, the live/test mode and the connected account, then retrieves the PaymentIntent fresh from Stripe. The admin sync runs after that verification.
- Only PaymentIntents linked to a known Cal booking are recorded. Unrelated charges on the account are ignored.
- **Balance payments:** for now, record them on the booking (Zelle, cash, Venmo and so on). Recording a Stripe payment by hand is blocked, because it would be double counted.
- **Next step (Phase 5):** send balances as Stripe Payment Links or Invoices with `metadata.booking_id`, and extend the Stripe webhook to record those payments automatically.

## 7. Cal.com and calendar

- Cal remains the availability and reservation engine. The admin calendar reads shoots from bookings, so there is no second copy of events and no duplicates.
- Reschedules are matched by the portal reference, so the booking row updates in place.
- **Later:**
  - Manual bookings could be pushed to Google Calendar through Cal's API or the Google Calendar API, storing the external event id on the booking so it is never duplicated.
  - Delivery and meeting dates would be added as a `calendar_events` table.

## 8. Authentication and security

- **Sign-in:** Supabase Auth email one-time link **and** 6-digit code. The code works when you open the email on your phone and sign in on the laptop.
  - Emails are sent only to allowlisted addresses (`shouldCreateUser: false`, plus an `admins` lookup).
  - The response is identical whether or not the email is an admin, so the form cannot be used to discover who the admin is.
- **Three layers:**
  1. `proxy.ts` refreshes the session and redirects signed-out visitors. This is an optimistic check only.
  2. `requireAdmin()` verifies the JWT (`getClaims`) and the `admins` row on every page and in **every Server Action**.
  3. Postgres RLS `is_admin()` applies to every table and view.
- **Secrets:** all server-only, with no `NEXT_PUBLIC_` Supabase variables. The anonymous role has no grants at all.
- **Input:** every action validates with zod. Search input is stripped to safe characters before it reaches PostgREST filters. Amounts are parsed to integer cents.
- **Headers:** `/admin` is `noindex`, `no-referrer`, `X-Frame-Options: DENY` and `nosniff`.
- **Audit:** refunds, expense deletions and settings changes are written to `audit_logs`.

## 9. Financial logic

`lib/admin/finance.ts`, covered by unit tests in `tests/admin-finance.test.ts`. All amounts are integer cents. Days are New York calendar days, and daylight saving time is handled.

| Figure | Rule |
|---|---|
| Total booking value | package price + add-ons + adjustment (a negative adjustment is a discount) |
| Revenue collected | Sum of `amount − refunded` for payments with status succeeded, partially refunded or refunded, by payment date. Failed and pending payments never count. |
| Outstanding | `max(total − collected, 0)` for committed bookings: Deposit paid or later, not canceled. Inquiries and unpaid holds are excluded. |
| Net profit | Revenue collected − expenses in the same period |
| Average booking value | Mean total of committed bookings |
| Booked value | Committed booking totals by booking date. Always labeled separately from revenue. |
| Canceled bookings | Owe nothing. A kept deposit stays in revenue; a refunded one is removed. |

**Known simplification:** a refund reduces revenue in the month of the original payment, not the month the refund happened. Totals are exact; only the monthly attribution shifts.

## 10. Mobile

Below 1024px:
- The sidebar becomes a top bar plus a bottom tab bar: Dashboard, Bookings, Clients, Finances, and More.
- More opens a sheet with the rest of the pages. It closes on navigation or Escape.

Throughout:
- Tables become cards below 900px.
- KPI tiles use two columns on phones.
- The calendar shows day dots on phones, with the agenda below it.
- Inputs are 16px or larger to avoid iOS zoom.
- Touch targets are at least 44px.
- Safe-area insets are respected.

The dashboard was checked at 320, 390, 768 and 1440px with no horizontal overflow.

## Local preview without signing in

For local development only, add `ADMIN_DEV_BYPASS=true` to `.env.local` and run `npm run dev`. Then open `http://localhost:3000/admin`.

- **Without Supabase configured:** the admin runs on fictional demo data held in memory (`lib/admin/demo/`). Forms work, and data resets when the dev server restarts.
- **With Supabase configured:** it shows your real data through the service role.

A dashed banner on every page shows that login is bypassed. The bypass requires `NODE_ENV === "development"`, so `next build`/`next start` and every Vercel deployment ignore it and always require sign-in (`lib/admin/dev.ts`).

## 11. Setup (one-time)

1. Create a Supabase project, in the US East region to be close to Vercel.
2. In the SQL editor, run `supabase/migrations/20260924000000_admin_foundation.sql`.
3. Go to **Authentication → Users → Add user**, enter your email and send an invite. Then run:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'you@vizualbymb.com';
   ```
4. **Authentication → Sign In / Providers**:
   - Keep email enabled.
   - **Disable "Allow new users to sign up".**
5. **Authentication → URL Configuration**:
   - Site URL: `https://admin.vizualbymb.com`.
   - Add redirect URL `https://admin.vizualbymb.com/admin/auth/confirm`, plus `http://localhost:3000/admin/auth/confirm` for local development.
6. **Authentication → Emails → Magic Link** template: include the code as well as the link, for example `Your code: {{ .Token }}` and `<a href="{{ .ConfirmationURL }}">Sign in</a>`.
7. For production email delivery, set up custom SMTP (for example, Resend, which you already use). Supabase's built-in sender is heavily rate-limited.
8. Run `supabase/migrations/20260925000000_automation.sql` too (step 2 covers the first file).
9. **Project Settings → API**: copy the URL, the publishable key and the secret key into Vercel environment variables (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) and into `.env.local`.
10. In Vercel → Domains, add `admin.vizualbymb.com` and create the DNS record Vercel shows you.
11. Deploy. Existing webhooks start filling the admin database with new bookings from then on. Bookings made before setup are not backfilled; add any active ones with **New booking**.

## 12. Phases and what is left

| Phase | Status |
|---|---|
| 1 Foundation: auth, layout, schema, booking sync, clients, Stripe architecture | **Built** |
| 2 Core dashboard: KPIs, revenue, bookings, upcoming shoots, payments due, clients | **Built** |
| 3 Finance: expenses, profit, reporting, date filters, receipts | **Built** |
| 4 Analytics: packages, lead sources, client value, trends | **Built**, including the booking-form lead-source question |
| 5 Automation: reminders, email, status rules, balance payments | **Built**, see below. Pushing manual bookings to Google Calendar is not built yet |
| Kanban board | **Built** at `/admin/bookings/board` |
| Editable packages that feed the booking site | **Not built.** Each package price must match its Cal.com event deposit, which the session route checks on every checkout. Moving the catalog into the database needs an admin screen that also updates or validates the Cal event, so a price edit can never break live checkout. |

## 12a. Automation (Phase 5)

Migration: `supabase/migrations/20260925000000_automation.sql`. Run it after the foundation migration.

**Daily job.** Vercel Cron calls `GET /api/admin/cron` at 13:00 UTC (9 AM New York in summer, 8 AM in winter). It requires `Authorization: Bearer $CRON_SECRET`, compared in constant time. Settings also has a **Run daily automation now** button. Every step is idempotent.

| Rule | What happens | Setting |
|---|---|---|
| Shoot over | Confirmed / Pre-production / Shoot scheduled → **Shoot completed** once the shoot ends | Move projects forward (on) |
| Next day | Shoot completed → **Editing** | same |
| Delivered long enough | Delivered → **Archived** after N days (default 30; blank = never) | same |
| Final payment | Final payment due → **Paid** as soon as the balance reaches $0 (database trigger, instant) | always |
| Deposit paid | Deposit pending → Deposit paid → Confirmed (from the booking webhooks) | always |

**Emails** (Resend, from `CONTACT_FROM_EMAIL`, plain text):

| Message | To | When | Default |
|---|---|---|---|
| New booking alert | you | a website booking is created | on |
| Payment alert | you | a Stripe deposit or balance payment succeeds | on |
| Shoot reminder | client | the day before the shoot (a rescheduled shoot gets a new one) | **off** |
| Balance reminder | client | N days before the due date (default 3), includes the payment link when it matches the balance | **off** |
| Overdue notice | client | once, after the due date passes | **off** |

Client emails stay off until you switch them on in Settings. Cal.com already sends booking confirmations and Stripe sends payment receipts, so those are not duplicated. Every message is logged in `notifications` with a unique key, so none is sent twice; a failed send is retried on the next run. The last 12 are listed in Settings. To add SMS, add a branch on `channel` in `lib/admin/notify.ts`.

**Balance payment links.** On a booking with a balance, **Create payment link** makes a single-use Stripe Payment Link for the balance (or a partial amount). Copy it into a text or email. When the client pays:
- the existing signed Stripe webhook sees `metadata.admin_booking_id`, records the payment on that booking, clears the link, and emails you
- the client lands on `/booking/paid`
- creating a new link switches the old one off

Links are created on the same Stripe account the webhook verifies (`STRIPE_CONNECTED_ACCOUNT_ID` when set). A test-mode key shows a "no real money moves" note.

**Receipts.** Attach a photo or PDF when adding an expense. Photos are resized in the browser to fit the 4.5 MB upload limit; PDFs up to 4 MB. Files go to the private `receipts` bucket (admin-only policies) and open through a one-minute signed link.

**Setup additions:**
- `CRON_SECRET`: a long random value, set in Vercel
- `CONTACT_FROM_EMAIL`: needs a verified Resend domain
- `ADMIN_NOTIFY_EMAIL`: optional
- `BOOKING_SITE_URL`: optional

## 13. Files

**New**
- `vercel.json` (cron), `supabase/migrations/…_automation.sql`
- `lib/admin/{automation,notify,messages,stripe}.ts`, `app/api/admin/cron/route.ts`, `app/admin/receipts/[id]/route.ts`, `app/booking/paid/page.tsx`, `tests/admin-automation.test.ts`
- `proxy.ts`
- `supabase/migrations/…_admin_foundation.sql`
- `lib/supabase/{env,server,service}.ts`
- `lib/admin/{auth,actions,session-actions,queries,sync,finance,labels,money,time,chart}.ts`
- `components/admin/*`
- `app/admin/**`
- `tests/admin-finance.test.ts`

**Changed**
- `app/api/booking/webhooks/{cal,stripe}/route.ts`: admin sync calls, plus balance-link payments in the Stripe webhook
- `components/booking/BookingPortal.tsx`: optional "How did you find us?" question
- `next.config.ts`: admin host rewrite and headers
- `.env.example`
- `package.json`: added `@supabase/supabase-js`, `@supabase/ssr` and `server-only`
