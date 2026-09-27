-- Vizuals by MB admin: automation, notifications, balance payment links, receipts (Phase 5).

-- ── Settings for automation ──────────────────────────────────────────────────
-- Client emails start OFF: nothing is sent to a client until you switch it on.
alter table studio_admin.business_settings
  add column client_emails_enabled boolean not null default false,
  add column admin_emails_enabled boolean not null default true,
  add column auto_status_enabled boolean not null default true,
  add column reminder_days_before_due integer not null default 3 check (reminder_days_before_due between 0 and 30),
  add column archive_after_days integer default 30 check (archive_after_days is null or archive_after_days between 1 and 365);

-- ── Balance payment link (latest one per booking) ────────────────────────────
alter table studio_admin.bookings
  add column payment_link_id text,
  add column payment_link_url text,
  add column payment_link_cents integer check (payment_link_cents is null or payment_link_cents > 0);

-- Views select b.*, which Postgres expands when a view is created, so both are
-- rebuilt to include the new booking columns. Definitions are otherwise unchanged.
drop view studio_admin.client_summary;
drop view studio_admin.booking_ledger;
create view studio_admin.booking_ledger with (security_invoker = true) as
with paid as (
  select booking_id,
    coalesce(sum(amount_cents - refunded_cents) filter (where status in ('succeeded', 'partially_refunded', 'refunded')), 0)::integer as paid_cents,
    coalesce(sum(refunded_cents), 0)::integer as refunded_cents,
    max(paid_at) as last_paid_at
  from studio_admin.payments group by booking_id
), base as (
  select b.*, c.name as client_name, c.email as client_email, c.phone as client_phone, c.company as client_company,
    coalesce(p.paid_cents, 0) as paid_cents,
    coalesce(p.refunded_cents, 0) as refunded_cents,
    p.last_paid_at,
    case when b.status = 'canceled' then 0 else greatest(b.total_cents - coalesce(p.paid_cents, 0), 0) end as balance_cents,
    coalesce(b.balance_due_date, (b.shoot_start at time zone 'America/New_York')::date) as due_date
  from studio_admin.bookings b
  join studio_admin.clients c on c.id = b.client_id
  left join paid p on p.booking_id = b.id
)
select base.*,
  case
    when status = 'canceled' then case when refunded_cents > 0 then 'refunded' else 'canceled' end
    when total_cents > 0 and paid_cents >= total_cents then 'paid'
    when balance_cents > 0 and due_date < (now() at time zone 'America/New_York')::date then 'overdue'
    when paid_cents = 0 then case when refunded_cents > 0 then 'refunded' else 'unpaid' end
    when paid_cents >= deposit_required_cents then 'deposit_paid'
    else 'partially_paid'
  end as payment_state
from base;

create view studio_admin.client_summary with (security_invoker = true) as
select c.*,
  count(l.id) filter (where l.status <> 'canceled')::integer as booking_count,
  min(l.created_at) as first_booking_at,
  max(l.created_at) as last_booking_at,
  coalesce(sum(l.paid_cents), 0)::integer as lifetime_revenue_cents,
  coalesce(sum(l.total_cents) filter (where l.status not in ('canceled', 'new_inquiry')), 0)::integer as booked_value_cents,
  coalesce(sum(l.balance_cents), 0)::integer as outstanding_cents,
  max(l.shoot_start) filter (where l.shoot_start > now() and l.status <> 'canceled') as next_shoot_at
from studio_admin.clients c
left join studio_admin.booking_ledger l on l.client_id = c.id
group by c.id;
grant select on studio_admin.booking_ledger, studio_admin.client_summary to authenticated;

-- ── Notifications log ────────────────────────────────────────────────────────
-- dedupe_key makes every message send at most once, however often the cron or a
-- webhook retry runs. The channel column leaves room for SMS later.
create table studio_admin.notifications (
  id bigint generated always as identity primary key,
  booking_id uuid references studio_admin.bookings (id) on delete cascade,
  kind text not null,
  channel text not null default 'email' check (channel in ('email', 'sms')),
  recipient text not null,
  dedupe_key text not null unique,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  error text,
  created_at timestamptz not null default now()
);
create index notifications_booking_idx on studio_admin.notifications (booking_id, created_at desc);
alter table studio_admin.notifications enable row level security;
create policy "admin read" on studio_admin.notifications for select to authenticated using (studio_admin.is_admin());
grant select on studio_admin.notifications to authenticated;

-- ── Final payment received → Paid ────────────────────────────────────────────
-- Only from "Final payment due", so a payment never jumps a project past editing.
create function studio_admin.advance_on_full_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('succeeded', 'partially_refunded') then
    update studio_admin.bookings b set status = 'paid'
    where b.id = new.booking_id and b.status = 'final_payment_due'
      and (select l.balance_cents from studio_admin.booking_ledger l where l.id = b.id) = 0;
  end if;
  return new;
end $$;
-- Named to sort after payments_log (triggers fire alphabetically), so the timeline reads payment, then Paid.
create trigger payments_status_advance after insert or update on studio_admin.payments
  for each row execute function studio_admin.advance_on_full_payment();

-- ── Receipts (private storage) ───────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vizualby-mb-receipts', 'vizualby-mb-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "vizualby mb admin read receipts" on storage.objects for select to authenticated using (bucket_id = 'vizualby-mb-receipts' and studio_admin.is_admin());
create policy "vizualby mb admin upload receipts" on storage.objects for insert to authenticated with check (bucket_id = 'vizualby-mb-receipts' and studio_admin.is_admin());
create policy "vizualby mb admin delete receipts" on storage.objects for delete to authenticated using (bucket_id = 'vizualby-mb-receipts' and studio_admin.is_admin());

grant all on studio_admin.notifications to service_role;
grant usage, select on all sequences in schema studio_admin to authenticated;
grant all on all sequences in schema studio_admin to service_role;
grant all on all routines in schema studio_admin to service_role;
