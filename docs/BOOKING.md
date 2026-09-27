# Visuals by MB booking portal

## Current status

Implemented in the existing Next.js app at `/booking`. The host rewrite serves it at the root of **booking.vizualbymb.com**. The portfolio remains at its existing routes.

The default is **preview only**: owner-supplied music-video pricing, sample pricing for other categories, sample availability, no reservation, no payment. See `MUSIC-BOOKING-SETUP.md` for the approved music scope and remaining decisions. Do not advertise other sample categories as approved business pricing. A private link and `noindex` discourage discovery; they are not authentication or an access-control boundary.

## Architecture

- `data/booking.ts`: editable categories, packages, durations, inclusions, location/revision limits, add-ons and conditional intake questions. All prices are integer USD cents. Add-ons increase the remaining balance, not the fixed deposit. Duration-changing work requires a custom quote.
- `components/booking/`: branded package selection, add-ons, date selection, intake and confirmation. Existing fonts, logo, photographic assets and dark palette are reused.
- `lib/booking/`: server-only provider configuration, input validation, records, signature verification and payment reconciliation.
- `/api/booking/availability`: allowlisted Cal slots; no calendar titles or private calendar details returned.
- `/api/booking/session`: validates consent, trusted prices, selected slot and Cal event payment configuration; saves a draft and sets an HttpOnly session cookie.
- Cal is loaded only at the final scheduling/deposit stage. The chosen date/time and intake are passed into its embed. Cal may request final scheduling confirmation. **Native Cal Stripe payment-on-booking** owns slot reservation and the PCI-compliant card flow. There is no second independent Stripe Checkout session that could race Cal's reservation.
- Signed Cal and Stripe webhooks reconcile persistent Redis records. The branded success page requires both payment proofs, exact deposit/currency/identity matches and an accepted booking fetched from Cal. A browser callback or success URL alone never confirms payment.
- Cal owns calendar invitations, booking emails, reminder workflows and secure management links in its email. The custom success page links to terms, Google Calendar and studio contact; direct reschedule/cancel controls remain in the Cal email.
- The Base44 assistant integration is a thin server-to-server layer under `/api/assistant/*`. It reuses this catalog, quote, Cal availability, slot validation, and booking-session flow. HMAC-authenticated requests can create a short-lived draft; a one-time-style browser handoff exchanges the opaque token for an HttpOnly cookie and opens `/checkout/review` with no customer details in the URL. See `ASSISTANT-API.md` for the signing contract and schemas.

## Account setup and launch gates

1. Approve or replace every sample package in `data/booking.ts`. Confirm the actual studio contact email currently used in the portal (`hello@vizualbymb.com`). Supply cancellation/refund, rescheduling and balance-payment policies; the app does not invent business terms.
2. Finish Cal.com onboarding. Connect Google Calendar yourself through Cal's authorization flow. Select **all calendars that should block availability** and the correct destination calendar for new bookings. Use America/New_York. Verify busy versus free events and all-day events.
3. Create one single-attendee Cal event type per bookable package. Duration must match the catalog. Connect Stripe, enable payment **on booking**, use USD, and set the price to the package's **deposit**, not its full price. Do not use card holds, seats, approval-required bookings or disabled booking notifications. Server preflight rejects these mismatches.
4. In Cal, set working hours, time off/date overrides, minimum notice, before/after buffers, maximum future booking window and blocked dates. Choose these actual business values with the owner; none are silently assumed in the app. Configure reminder workflows supported by the account plan. Ensure owner and attendee confirmation emails are enabled. Enforce applicable cancellation/rescheduling cutoffs in Cal where supported; otherwise establish a studio-managed process before launch.
5. Configure `CAL_BOOKING_EVENTS` as a JSON object, e.g. `{"content-signature":{"eventTypeId":123456,"calLink":"your-username/content-signature"}}`. Replace the sample ID/link. Only mapped catalog packages are bookable in live mode.
6. Set Cal API and webhook secrets in the hosting environment. Subscribe the webhook at `https://booking.vizualbymb.com/api/booking/webhooks/cal` to BOOKING_CREATED, BOOKING_PAYMENT_INITIATED, BOOKING_PAID, BOOKING_CANCELLED, BOOKING_REJECTED and BOOKING_RESCHEDULED. Use the same signing secret as `CAL_WEBHOOK_SECRET`.
7. Configure Stripe event delivery at `https://booking.vizualbymb.com/api/booking/webhooks/stripe` for payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled and charge.refunded. The API key, event destination and connected account must actually have access to the payment intents Cal creates. Set `STRIPE_CONNECTED_ACCOUNT_ID` for connected-account events. Do not assume a key from an unrelated Stripe account can verify Cal payments. Test mode requires `BOOKING_STRIPE_LIVE=false`; production requires true and matching live keys/secrets.
8. Provision a private Upstash Redis database and set its REST URL/token. Store secrets only in local `.env.local` or hosting environment settings, never source control or client-visible variables. Draft/session retention is seven days; booking/payment records are retained for one year. Review this retention policy before accepting real clients.
9. Set the four policy environment values shown in `.env.example`. Set `BOOKING_CATALOG_APPROVED=true` only after approval. Test on a non-production deployment with `BOOKING_ENABLED=true` and test credentials. Keep production disabled until every acceptance test below passes.
10. Keep `booking.vizualbymb.com` attached to this Vercel project and preserve its registrar DNS record. Do not change the apex portfolio record. Verify TLS, the root host rewrite, API routes, redirects and portfolio routes after deployment. The fallback `/booking` remains available.

The embed listens for Cal's completed non-payment-pending booking callback. Verify the paid-booking callback on the actual account. If Cal's configured success redirect is needed, configure it to the portal success page with the real booking UID using Cal's supported redirect parameters, and verify the resulting URL; do not guess a template parameter. Missing cookies on another device intentionally cannot expose a receipt: use the Cal email instead.

## Required live-provider acceptance tests (not yet completed)

- Google busy event, all-day block, days off, notice, booking horizon and buffers remove the appropriate slots; timezone and daylight-saving transitions behave correctly.
- Two browsers compete for one slot: only one paid booking succeeds; no duplicate charge or orphan reservation. Refresh, double-click, abandon payment and retry. Confirm Cal's unpaid reservation release behavior and document its timeout.
- Successful test deposit produces one correct payment, one confirmed calendar event, owner/client emails and the branded verified receipt. Declined/cancelled payments never produce a confirmed receipt. Test 3DS where supported.
- Deliver Stripe before Cal and Cal before Stripe; replay events, delay events and simulate a failed webhook for provider retry. Confirm refund, cancellation and rescheduling cannot resurrect an old confirmed booking.
- Exercise permitted and prohibited reschedules/cancellations using email links. Verify whether refunds require manual Stripe action; cancellation must not be advertised as automatically refunding a deposit. Verify reminders arrive.
- Confirm no personal data appears in routine logs, no card details reach application endpoints, secrets remain server-side, and webhook signature failures are rejected.

## Local verification

```sh
npm run dev
npm run lint
npx tsc --noEmit
npm run test:booking
npm run test:assistant
npm run test:booking:ui
npm run build
```

Browser tests use Chrome and localhost:3000 (override with `BOOKING_TEST_URL`), with preview mode expected. They cover the complete preview journey at seven widths: 320, 360, 375, 393, 430, 768 and 1440 pixels. Screenshots are written to `artifacts/booking/` and are ignored by source control.

The local verification suite covers booking, admin finance, Assistant API signing/pricing, and nine production-build browser journeys. These checks **do not** establish production readiness or validate actual Stripe/Google/Cal account behavior. No live charge, calendar booking, email delivery, DNS cutover or deployment has been performed. Cal's installed-app screen was checked: Google Calendar has conflict checking enabled, and Stripe is installed; payment readiness is not yet verified.

## Security and operational limitations

Prices and consent are validated server-side. Public endpoints have request-size/input constraints and Redis rate limits. Webhooks use raw-body signatures, minimal retained payment data and replay-aware records; Stripe payment status is retrieved independently. Polling also rechecks current Cal status. Provider outages fail closed rather than displaying a fabricated confirmation.

This is an application-level review, not an independent security audit. Account permissions, webhook delivery from Cal's Stripe integration, concurrency, provider replay ordering and refund/reschedule behavior require staging verification. Redis persistence and both providers' webhook retry/monitoring must be enabled operationally. Add operational alerts and reconcile provider records before launch; never ask a client to repay solely because a webhook is delayed.

Primary integration references: [Cal slots](https://cal.com/docs/api-reference/v2/slots/get-available-time-slots-for-an-event-type), [Cal event types](https://cal.com/docs/api-reference/v2/event-types/get-an-event-type), [Cal booking lookup](https://cal.com/docs/api-reference/v2/bookings/get-a-booking), [Cal webhooks](https://cal.com/docs/developing/guides/automation/webhooks).
