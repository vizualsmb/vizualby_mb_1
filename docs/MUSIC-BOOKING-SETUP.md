# Owner-supplied music-video catalog

> **Deposit rule (owner, 2026-09-24): the deposit is 50% of the package price** (`DEPOSIT_SHARE` in `data/booking.ts`). The Cal events below were created with a $200 price and **must be updated in Cal**: Run & Gun $250, Creative $400. Checkout preflight rejects any mismatch.

## Cal.com event types created

Created and verified through the Cal.com UI:

- Run & Gun — Music Video: event ID `7205733`, slug `vizualbymb/music-run-and-gun`, created at 180 minutes — **must be changed to 120 minutes in Cal** (owner shortened Run & Gun to 2 hours; checkout preflight rejects the mismatch until then), Stripe USD $200 collected on booking, refund policy Never.
- Creative — Music Video: event ID `7205741`, slug `vizualbymb/music-creative`, 240 minutes, Stripe USD $200 collected on booking, refund policy Never.
- Full Concept — Quote Required: event ID `7205748`, slug `vizualbymb/music-full-concept`, 360 minutes, always requires manual confirmation, no payment collected on request. Unconfirmed requests do not block slots. Obtain the agreed quote and $200 deposit before approving a production request.

All three have descriptions, attendee-provided in-person locations, and are hidden from the public profile. Hidden is not disabled: direct links may still work. Cal's default availability is still Monday–Friday 9am–5pm America/New_York and must be changed to the approved studio hours below. No charge or live booking test was performed. Portal payment gates remain disabled.

Future server environment mapping (non-secret; not enabled yet):

```json
{"music-run-and-gun":{"eventTypeId":7205733,"calLink":"vizualbymb/music-run-and-gun"},"music-creative":{"eventTypeId":7205741,"calLink":"vizualbymb/music-creative"}}
```

Do not add Full Concept to automatic paid checkout: its quote-first/manual approval workflow is intentionally separate.

Music-video pricing replaces the sample music catalog. Other categories remain previews, not approved live offers.

| Package | Price | Deposit | Base balance | Reserved shoot duration |
| --- | --- | --- | --- | --- |
| Run & Gun | $500 | $250 (50%) non-refundable | $250 | 120 minutes |
| Creative | $800 | $400 (50%) non-refundable | $400 | 240 minutes |
| Full Concept | From $1,300 | 50% of the agreed quote, non-refundable | 50% of the agreed quote | Up to 360 minutes; quote first |

The remaining balance is due according to the booking agreement. No delivery timeline was supplied, so none is invented. Full Concept is inquiry-only until the final scope/price is agreed. The deposit alone must not confirm an unknown final price.

Script / concept development adds $75 to the remaining balance on the two fixed-price packages. Full Concept already includes concept development. The following rates are displayed as studio-confirmed requests, not automatic checkout additions: extra filming $100/hour, extra location from $100, rush 48-hour delivery +$150, drone +$100, additional revisions quoted separately, and possible out-of-area travel fees. These need duration, feasibility, capacity, or price confirmation. Drone is already included when appropriate in Full Concept.

Before configuring live Cal events: obtain working hours, minimum notice, buffers, booking horizon, blocked dates, cancellation/rescheduling details, local service-area definition, and the contact email. Confirm whether script development is an appropriate extra on Creative given its included light concept planning.

Use Cal event mappings for `music-run-and-gun` (120 minutes / USD 25000 cents on booking) and `music-creative` (240 minutes / USD 40000 cents on booking). Do not map old sample IDs `music-performance` or `music-story`, or enable sample categories. Do not turn on live payments until provider credentials, webhooks, and real integration tests are complete.

## Approved studio hours

Every day, including weekends, 6:00 AM – 12:00 AM (midnight) America/New_York. A shoot must start and finish inside this window, so the latest start is midnight minus the package duration (Run & Gun 10:00 PM, Creative 8:00 PM). The portal shows each time as the full shoot window, e.g. "10:00 AM – 12:00 PM" for Run & Gun.

The portal enforces this in `lib/booking/hours.ts`, both in the date picker and when a checkout is created, so a looser Cal schedule cannot open extra times. Cal still needs matching settings:

1. Cal → Availability → the schedule used by the music events: Sunday–Saturday, 6:00am to 12:00am (or the last option offered, e.g. 11:59pm; that would drop the final start time of each day). Time zone America/New_York.
2. Busy time and existing bookings are blocked through the connected Google Calendar (conflict checking is enabled). Google all-day events default to **Free** and will not block; set them to **Busy**.
3. Days off: add a Cal date override marked unavailable, or put a Busy all-day event on the checked Google Calendar.

## Deposit or pay in full

At the Payment step clients choose **Pay the deposit** (50% of the package price today, the other 50% later) or **Pay in full** (the whole package price today, $0 balance). Terms and consent are shown on that step. The Details step no longer asks for a shoot location; collect it when following up.

Cal charges one fixed price per event type, so paying in full needs a **second, hidden Cal event per package** with the same duration, availability and settings, priced at the full package price (Run & Gun $500 / 120 min, Creative $800 / 240 min). Add it to `CAL_BOOKING_EVENTS` under `full`:

```json
{"music-run-and-gun":{"eventTypeId":7205733,"calLink":"vizualbymb/music-run-and-gun","full":{"eventTypeId":0,"calLink":"vizualbymb/music-run-and-gun-full"}}}
```

Replace `0` and the link with the real event. Until a package has a `full` mapping, live mode offers only the deposit for it; the preview always shows both. Checkout preflight rejects a full-payment event whose price is not the full package price. Subscribe the Cal webhook to the new events too (it is account-wide by default). Confirm the refund wording for full payments ("the 50% deposit portion is non-refundable") before launch.
