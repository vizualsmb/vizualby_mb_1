-- Mobile-first pre-shoot preparation. These tables deliberately sit beside,
-- rather than inside, bookings: a shoot can be linked to a project or exist
-- independently for spontaneous/content work.
create type studio_admin.pre_shoot_status as enum ('not_started', 'packing', 'packed', 'loaded', 'ready', 'completed');
create type studio_admin.pre_shoot_stage as enum ('pack', 'load', 'final', 'ready');

create table studio_admin.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null check (length(trim(category)) between 1 and 80),
  quantity smallint not null default 1 check (quantity between 1 and 99),
  notes text,
  required boolean not null default false,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index equipment_active_category_idx on studio_admin.equipment (active, category, name) where archived_at is null;
create trigger equipment_touch before update on studio_admin.equipment for each row execute function studio_admin.touch_updated_at();

create table studio_admin.equipment_kits (
  id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 100), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (name)
);
create trigger equipment_kits_touch before update on studio_admin.equipment_kits for each row execute function studio_admin.touch_updated_at();
create table studio_admin.equipment_kit_items (
  kit_id uuid not null references studio_admin.equipment_kits(id) on delete cascade,
  equipment_id uuid not null references studio_admin.equipment(id) on delete restrict,
  quantity smallint not null default 1 check (quantity between 1 and 99), primary key (kit_id, equipment_id)
);

create table studio_admin.shoots (
  id uuid primary key default gen_random_uuid(), project_id uuid references studio_admin.projects(id) on delete set null,
  client_id uuid references studio_admin.clients(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 160), shoot_type text, shoot_at timestamptz not null,
  location text, shot_list_url text check (shot_list_url is null or shot_list_url ~ '^https?://'),
  status studio_admin.pre_shoot_status not null default 'not_started', stage studio_admin.pre_shoot_stage not null default 'pack',
  final_checks jsonb not null default '["Camera batteries charged","Light batteries charged","Memory cards inserted / formatted","Audio tested","Camera bag loaded","Lighting bag loaded","Gimbal loaded","Phone","Wallet","Keys","Shoot address confirmed","Client/contact information available"]'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index shoots_upcoming_idx on studio_admin.shoots (shoot_at) where status <> 'completed';
create trigger shoots_touch before update on studio_admin.shoots for each row execute function studio_admin.touch_updated_at();
create table studio_admin.shoot_equipment (
  shoot_id uuid not null references studio_admin.shoots(id) on delete cascade,
  equipment_id uuid not null references studio_admin.equipment(id) on delete restrict,
  quantity smallint not null default 1 check (quantity between 1 and 99), packed boolean not null default false,
  loaded boolean not null default false, required boolean not null default false,
  primary key (shoot_id, equipment_id), check (not loaded or packed)
);
create table studio_admin.shoot_final_checks (
  shoot_id uuid not null references studio_admin.shoots(id) on delete cascade, item text not null,
  checked boolean not null default false, sort_order smallint not null, primary key (shoot_id, sort_order)
);

alter table studio_admin.equipment enable row level security;
alter table studio_admin.equipment_kits enable row level security;
alter table studio_admin.equipment_kit_items enable row level security;
alter table studio_admin.shoots enable row level security;
alter table studio_admin.shoot_equipment enable row level security;
alter table studio_admin.shoot_final_checks enable row level security;
create policy "admin access" on studio_admin.equipment for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());
create policy "admin access" on studio_admin.equipment_kits for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());
create policy "admin access" on studio_admin.equipment_kit_items for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());
create policy "admin access" on studio_admin.shoots for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());
create policy "admin access" on studio_admin.shoot_equipment for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());
create policy "admin access" on studio_admin.shoot_final_checks for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());
grant select, insert, update, delete on all tables in schema studio_admin to authenticated;
grant all on studio_admin.equipment, studio_admin.equipment_kits, studio_admin.equipment_kit_items, studio_admin.shoots, studio_admin.shoot_equipment, studio_admin.shoot_final_checks to service_role;
