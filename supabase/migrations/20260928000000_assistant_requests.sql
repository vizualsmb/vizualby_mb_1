-- Custom-request intake from the external AI assistant (Base44) and any future
-- assistant-driven client. A request that doesn't match a bookable package lands
-- here for manual review instead of letting an assistant invent a price.
create table studio_admin.assistant_requests (
  id uuid primary key default gen_random_uuid(),
  client_id text not null check (length(client_id) between 1 and 40),
  name text not null check (length(name) between 1 and 100),
  email text not null check (length(email) <= 160),
  phone text check (phone is null or length(phone) <= 30),
  requested_service text not null check (length(requested_service) <= 200),
  preferred_date text check (preferred_date is null or length(preferred_date) <= 40),
  budget text check (budget is null or length(budget) <= 80),
  description text not null check (length(description) between 1 and 2000),
  idempotency_key_hash text not null check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assistant_requests_status_idx on studio_admin.assistant_requests (status, created_at desc);
create unique index assistant_requests_idempotency_idx on studio_admin.assistant_requests (client_id, idempotency_key_hash);
create trigger assistant_requests_touch before update on studio_admin.assistant_requests for each row execute function studio_admin.touch_updated_at();

alter table studio_admin.assistant_requests enable row level security;
create policy assistant_requests_admin_all on studio_admin.assistant_requests for all to authenticated
  using ((select studio_admin.is_admin())) with check ((select studio_admin.is_admin()));
grant select, insert, update, delete on studio_admin.assistant_requests to authenticated, service_role;
