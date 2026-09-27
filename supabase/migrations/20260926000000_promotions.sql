-- Package promotions. Prices are server-owned integer USD cents.
create type studio_admin.discount_type as enum ('flat', 'percentage');

create table studio_admin.promotions (
  id uuid primary key default gen_random_uuid(),
  package_id text not null,
  enabled boolean not null default false,
  original_price_cents integer not null check (original_price_cents > 0),
  discounted_price_cents integer not null check (discounted_price_cents > 0),
  discount_type studio_admin.discount_type not null default 'flat',
  label text check (label is null or length(label) <= 40),
  starts_on date not null,
  ends_on date not null,
  booking_deadline date,
  limited_quantity integer check (limited_quantity is null or limited_quantity > 0),
  promo_code text check (promo_code is null or length(promo_code) between 2 and 40),
  value_note text check (value_note is null or length(value_note) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discounted_price_cents < original_price_cents),
  check (ends_on >= starts_on),
  check (booking_deadline is null or booking_deadline between starts_on and ends_on)
);
create unique index one_enabled_promotion_per_package on studio_admin.promotions (package_id) where enabled;
create index promotions_active_idx on studio_admin.promotions (enabled, starts_on, ends_on);
create trigger promotions_touch before update on studio_admin.promotions for each row execute function studio_admin.touch_updated_at();

alter table studio_admin.bookings add column promotion_id uuid references studio_admin.promotions (id) on delete set null;
alter table studio_admin.bookings add column original_package_price_cents integer check (original_package_price_cents is null or original_package_price_cents >= 0);
alter table studio_admin.bookings add column promotion_savings_cents integer not null default 0 check (promotion_savings_cents >= 0);

alter table studio_admin.promotions enable row level security;
create policy promotions_admin_all on studio_admin.promotions for all to authenticated
  using ((select studio_admin.is_admin())) with check ((select studio_admin.is_admin()));
grant select, insert, update, delete on studio_admin.promotions to authenticated, service_role;
