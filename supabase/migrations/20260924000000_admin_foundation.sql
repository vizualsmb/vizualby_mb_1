-- Vizuals by MB admin: foundation schema (Phase 1).
-- Money is integer USD cents everywhere, matching data/booking.ts.
-- Timestamps are timestamptz; business-day logic uses America/New_York.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.booking_status as enum (
  'new_inquiry', 'deposit_pending', 'deposit_paid', 'confirmed', 'pre_production',
  'shoot_scheduled', 'shoot_completed', 'editing', 'client_review', 'revision',
  'final_payment_due', 'paid', 'delivered', 'archived', 'canceled'
);
create type public.service_category as enum ('content', 'music', 'brand', 'events', 'estate', 'custom');
create type public.lead_source as enum (
  'instagram', 'google', 'website', 'referral', 'repeat_client', 'tiktok',
  'youtube', 'linkedin', 'direct_outreach', 'other'
);
create type public.client_type as enum (
  'artist', 'brand', 'business', 'restaurant', 'barbershop', 'real_estate_agent',
  'event_client', 'agency', 'other'
);
-- A refund is stored as refunded_cents on the payment it reverses (Stripe's model),
-- so there is exactly one way to express it.
create type public.payment_type as enum ('deposit', 'partial', 'final', 'other');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');
create type public.payment_method as enum ('stripe', 'cash', 'zelle', 'venmo', 'cash_app', 'bank_transfer', 'check', 'other');
create type public.expense_category as enum (
  'gear', 'gear_rental', 'transportation', 'gas', 'parking', 'location', 'talent', 'crew',
  'editing_software', 'subscriptions', 'music_licensing', 'props', 'food', 'marketing',
  'advertising', 'insurance', 'website', 'taxes', 'contractors', 'other'
);

-- ── Helpers ──────────────────────────────────────────────────────────────────
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ── Admins (allowlist) ───────────────────────────────────────────────────────
-- Rows are added by hand in the Supabase SQL editor; no API can insert them.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- ── Clients ──────────────────────────────────────────────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  email text check (email is null or email = lower(email)),
  phone text,
  company text,
  social text,
  client_type public.client_type not null default 'other',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_email_key on public.clients (email) where email is not null;
create index clients_name_idx on public.clients (lower(name));
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();

-- ── Bookings ─────────────────────────────────────────────────────────────────
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  -- MB reference from the booking portal session; also shown to the client in Cal notes.
  reference text unique,
  cal_uid text unique,
  client_id uuid not null references public.clients (id) on delete restrict,
  source text not null default 'manual' check (source in ('website', 'manual')),
  status public.booking_status not null default 'new_inquiry',
  -- Catalog id from data/booking.ts plus snapshots, so later catalog edits never rewrite history.
  package_id text,
  package_name text,
  service_category public.service_category,
  project_title text,
  project_description text,
  client_message text,
  location text,
  shoot_start timestamptz,
  shoot_end timestamptz,
  package_price_cents integer not null default 0 check (package_price_cents >= 0),
  addons_cents integer not null default 0 check (addons_cents >= 0),
  -- Discounts (negative) or agreed extras (positive) outside the catalog.
  adjustment_cents integer not null default 0,
  total_cents integer generated always as (package_price_cents + addons_cents + adjustment_cents) stored,
  deposit_required_cents integer not null default 0 check (deposit_required_cents >= 0),
  -- When null, the balance is treated as due on the shoot date.
  balance_due_date date,
  lead_source public.lead_source,
  lead_source_detail text,
  notes text,
  policy_version text,
  delivered_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_cents >= 0),
  check (shoot_end is null or shoot_start is null or shoot_end >= shoot_start)
);
create index bookings_client_idx on public.bookings (client_id);
create index bookings_status_idx on public.bookings (status);
create index bookings_shoot_start_idx on public.bookings (shoot_start);
create index bookings_created_idx on public.bookings (created_at desc);
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();

create table public.booking_addons (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  addon_id text not null,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  primary key (booking_id, addon_id)
);

-- ── Payments ─────────────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  type public.payment_type not null,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount_cents integer not null check (amount_cents > 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0 and refunded_cents <= amount_cents),
  currency text not null default 'usd' check (currency = 'usd'),
  paid_at timestamptz,
  stripe_payment_intent_id text unique,
  cal_payment_id bigint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id);
create index payments_paid_at_idx on public.payments (paid_at);
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

-- ── Expenses ─────────────────────────────────────────────────────────────────
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 160),
  amount_cents integer not null check (amount_cents > 0),
  spent_on date not null,
  category public.expense_category not null,
  vendor text,
  booking_id uuid references public.bookings (id) on delete set null,
  payment_method public.payment_method,
  receipt_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_spent_on_idx on public.expenses (spent_on);
create index expenses_booking_idx on public.expenses (booking_id);
create trigger expenses_touch before update on public.expenses for each row execute function public.touch_updated_at();

-- ── Booking timeline ─────────────────────────────────────────────────────────
-- One timeline table doubles as status history: status and payment changes are
-- written by triggers below, so the timeline can never drift from the data.
create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null,
  from_status public.booking_status,
  to_status public.booking_status,
  detail text,
  actor text not null default 'system' check (actor in ('system', 'admin', 'cal', 'stripe')),
  occurred_at timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, occurred_at);

create function public.log_booking_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare who text := case when (select auth.uid()) is null then 'system' else 'admin' end;
begin
  if tg_op = 'INSERT' then
    insert into public.booking_events (booking_id, kind, to_status, actor, detail)
    values (new.id, 'created', new.status, who, case when new.source = 'website' then 'Booked through the website' else 'Added manually' end);
  elsif new.status is distinct from old.status then
    insert into public.booking_events (booking_id, kind, from_status, to_status, actor)
    values (new.id, 'status_changed', old.status, new.status, who);
  end if;
  return new;
end $$;
create trigger bookings_log after insert or update of status on public.bookings
  for each row execute function public.log_booking_change();

create function public.log_payment_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare who text := case when new.method = 'stripe' then 'stripe' when (select auth.uid()) is null then 'system' else 'admin' end;
begin
  if new.status = 'succeeded' and (tg_op = 'INSERT' or old.status is distinct from 'succeeded') then
    insert into public.booking_events (booking_id, kind, actor, detail)
    values (new.booking_id, 'payment_received', who, format('%s payment of $%s', initcap(new.type::text), to_char(new.amount_cents / 100.0, 'FM999,999,990.00')));
  elsif new.status = 'failed' and (tg_op = 'INSERT' or old.status is distinct from 'failed') then
    insert into public.booking_events (booking_id, kind, actor, detail)
    values (new.booking_id, 'payment_failed', who, format('Payment of $%s failed', to_char(new.amount_cents / 100.0, 'FM999,999,990.00')));
  end if;
  if tg_op = 'UPDATE' and new.refunded_cents > old.refunded_cents then
    insert into public.booking_events (booking_id, kind, actor, detail)
    values (new.booking_id, 'payment_refunded', who, format('Refunded $%s', to_char((new.refunded_cents - old.refunded_cents) / 100.0, 'FM999,999,990.00')));
  end if;
  return new;
end $$;
create trigger payments_log after insert or update on public.payments
  for each row execute function public.log_payment_change();

-- ── Business settings (single row) ───────────────────────────────────────────
create table public.business_settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Vizuals by MB',
  email text,
  phone text,
  address text,
  currency text not null default 'usd',
  default_deposit_percent numeric(5, 2) not null default 50 check (default_deposit_percent between 0 and 100),
  tax_percent numeric(5, 2) not null default 0 check (tax_percent between 0 and 100),
  invoice_terms text,
  cancellation_terms text,
  payment_terms text,
  updated_at timestamptz not null default now()
);
insert into public.business_settings (id) values (true);
create trigger business_settings_touch before update on public.business_settings for each row execute function public.touch_updated_at();

-- ── Audit log ────────────────────────────────────────────────────────────────
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ── Derived views (security_invoker: RLS of the caller applies) ──────────────
-- Collected money per payment: refunds reduce it, pending/failed never count.
create view public.booking_ledger with (security_invoker = true) as
with paid as (
  select booking_id,
    coalesce(sum(amount_cents - refunded_cents) filter (where status in ('succeeded', 'partially_refunded', 'refunded')), 0)::integer as paid_cents,
    coalesce(sum(refunded_cents), 0)::integer as refunded_cents,
    max(paid_at) as last_paid_at
  from public.payments group by booking_id
), base as (
  select b.*, c.name as client_name, c.email as client_email, c.phone as client_phone, c.company as client_company,
    coalesce(p.paid_cents, 0) as paid_cents,
    coalesce(p.refunded_cents, 0) as refunded_cents,
    p.last_paid_at,
    case when b.status = 'canceled' then 0 else greatest(b.total_cents - coalesce(p.paid_cents, 0), 0) end as balance_cents,
    coalesce(b.balance_due_date, (b.shoot_start at time zone 'America/New_York')::date) as due_date
  from public.bookings b
  join public.clients c on c.id = b.client_id
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

create view public.client_summary with (security_invoker = true) as
select c.*,
  count(l.id) filter (where l.status <> 'canceled')::integer as booking_count,
  min(l.created_at) as first_booking_at,
  max(l.created_at) as last_booking_at,
  coalesce(sum(l.paid_cents), 0)::integer as lifetime_revenue_cents,
  coalesce(sum(l.total_cents) filter (where l.status not in ('canceled', 'new_inquiry')), 0)::integer as booked_value_cents,
  coalesce(sum(l.balance_cents), 0)::integer as outstanding_cents,
  max(l.shoot_start) filter (where l.shoot_start > now() and l.status <> 'canceled') as next_shoot_at
from public.clients c
left join public.booking_ledger l on l.client_id = c.id
group by c.id;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Browser (anon) gets nothing. Signed-in users get data only if they are in admins.
-- Webhooks use the service role on the server, which bypasses RLS.
alter table public.admins enable row level security;
alter table public.clients enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_addons enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.booking_events enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "admins read own row" on public.admins for select to authenticated using (user_id = (select auth.uid()));

create policy "admin access" on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin access" on public.bookings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin access" on public.booking_addons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin access" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin access" on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read" on public.booking_events for select to authenticated using (public.is_admin());
create policy "admin note" on public.booking_events for insert to authenticated with check (public.is_admin() and actor = 'admin');
create policy "admin access" on public.business_settings for select to authenticated using (public.is_admin());
create policy "admin update" on public.business_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read" on public.audit_logs for select to authenticated using (public.is_admin());
create policy "admin write" on public.audit_logs for insert to authenticated with check (public.is_admin() and actor_id = (select auth.uid()));

revoke all on all tables in schema public from anon;
revoke execute on function public.is_admin() from anon;
grant select, insert, update, delete on public.clients, public.bookings, public.booking_addons, public.payments, public.expenses to authenticated;
grant select, insert on public.booking_events, public.audit_logs to authenticated;
grant select, update on public.business_settings to authenticated;
grant select on public.admins, public.booking_ledger, public.client_summary to authenticated;
