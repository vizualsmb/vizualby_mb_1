-- VIZUAL BY MB Production OS: projects are a production layer over bookings.
-- A linked project keeps booking/client/price facts in their existing tables;
-- custom projects have no booking row and store only their own agreed details.

create type studio_admin.production_stage as enum (
  'footage', 'editing', 'vfx', 'color', 'sound', 'client_review', 'delivery'
);
create type studio_admin.production_status as enum (
  'not_started', 'in_progress', 'completed', 'waiting', 'overdue'
);
create type studio_admin.time_category as enum (
  'editing', 'vfx', 'color', 'sound', 'revisions', 'other'
);

create table studio_admin.projects (
  id uuid primary key default gen_random_uuid(),
  -- One production workspace may be linked to one booking. A null booking_id is
  -- a manual/custom project; booking financial facts are never copied here.
  booking_id uuid unique references studio_admin.bookings (id) on delete set null,
  client_id uuid references studio_admin.clients (id) on delete restrict,
  title text check (title is null or length(title) between 1 and 160),
  project_type text check (project_type is null or length(project_type) <= 100),
  quoted_price_cents integer check (quoted_price_cents is null or quoted_price_cents >= 0),
  shoot_at timestamptz,
  delivery_at timestamptz,
  revisions_included smallint not null default 2 check (revisions_included between 0 and 20),
  notes text,
  current_stage studio_admin.production_stage not null default 'footage',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((booking_id is not null) or (client_id is not null and title is not null))
);
create index projects_booking_idx on studio_admin.projects (booking_id) where booking_id is not null;
create index projects_client_idx on studio_admin.projects (client_id);
create index projects_delivery_idx on studio_admin.projects (delivery_at);
create trigger projects_touch before update on studio_admin.projects for each row execute function studio_admin.touch_updated_at();

create table studio_admin.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references studio_admin.projects (id) on delete cascade,
  stage studio_admin.production_stage not null,
  status studio_admin.production_status not null default 'not_started',
  due_at timestamptz,
  completed_at timestamptz,
  sort_order smallint not null check (sort_order between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, stage),
  unique (project_id, sort_order)
);
create index project_stages_project_idx on studio_admin.project_stages (project_id, sort_order);
create trigger project_stages_touch before update on studio_admin.project_stages for each row execute function studio_admin.touch_updated_at();

create table studio_admin.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references studio_admin.projects (id) on delete cascade,
  stage studio_admin.production_stage not null,
  title text not null check (length(title) between 1 and 240),
  completed boolean not null default false,
  completed_at timestamptz,
  due_at timestamptz,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_tasks_project_stage_idx on studio_admin.project_tasks (project_id, stage, sort_order);
create trigger project_tasks_touch before update on studio_admin.project_tasks for each row execute function studio_admin.touch_updated_at();

create table studio_admin.project_time_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references studio_admin.projects (id) on delete cascade,
  category studio_admin.time_category not null default 'editing',
  -- duration_seconds contains completed active time. While active, the server
  -- calculates elapsed seconds from active_started_at; browser clocks are never
  -- authoritative.
  started_at timestamptz not null default now(),
  active_started_at timestamptz,
  paused_at timestamptz,
  resumed_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((ended_at is null) or active_started_at is null),
  check ((ended_at is not null) or active_started_at is not null or paused_at is not null)
);
-- One running session per project prevents timer overlap and double-counting.
create unique index project_time_one_active_idx on studio_admin.project_time_sessions (project_id)
  where ended_at is null;
create index project_time_project_idx on studio_admin.project_time_sessions (project_id, started_at desc);
create trigger project_time_sessions_touch before update on studio_admin.project_time_sessions for each row execute function studio_admin.touch_updated_at();

alter table studio_admin.projects enable row level security;
alter table studio_admin.project_stages enable row level security;
alter table studio_admin.project_tasks enable row level security;
alter table studio_admin.project_time_sessions enable row level security;

create policy "admin access" on studio_admin.projects for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());
create policy "admin access" on studio_admin.project_stages for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());
create policy "admin access" on studio_admin.project_tasks for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());
create policy "admin access" on studio_admin.project_time_sessions for all to authenticated using (studio_admin.is_admin()) with check (studio_admin.is_admin());

grant select, insert, update, delete on studio_admin.projects, studio_admin.project_stages, studio_admin.project_tasks, studio_admin.project_time_sessions to authenticated;
grant all on studio_admin.projects, studio_admin.project_stages, studio_admin.project_tasks, studio_admin.project_time_sessions to service_role;
