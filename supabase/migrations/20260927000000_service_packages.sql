-- Admin-managed package catalog. Rows override code defaults by package_id;
-- new package_ids add catalog entries. Archived rows remain for booking history.
create table studio_admin.service_packages (
  package_id text primary key check (package_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category studio_admin.service_category not null,
  name text not null check (length(name) between 1 and 100),
  tagline text not null default '' check (length(tagline) <= 240),
  price_cents integer not null default 0 check (price_cents >= 0),
  deposit_percent numeric(5,2) not null default 50 check (deposit_percent between 0 and 100),
  duration_minutes integer not null default 60 check (duration_minutes between 0 and 4320),
  locations integer not null default 1 check (locations between 0 and 100),
  location_label text check (location_label is null or length(location_label) <= 80),
  revisions integer not null default 1 check (revisions between 0 and 100),
  delivery text not null default '' check (length(delivery) <= 120),
  includes text[] not null default '{}',
  featured boolean not null default false,
  inquiry_only boolean not null default false,
  starting_price boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inquiry_only or price_cents > 0)
);
create index service_packages_catalog_idx on studio_admin.service_packages (active, category, sort_order);
create trigger service_packages_touch before update on studio_admin.service_packages for each row execute function studio_admin.touch_updated_at();

alter table studio_admin.service_packages enable row level security;
create policy service_packages_admin_all on studio_admin.service_packages for all to authenticated
  using ((select studio_admin.is_admin())) with check ((select studio_admin.is_admin()));
grant select, insert, update, delete on studio_admin.service_packages to authenticated, service_role;
