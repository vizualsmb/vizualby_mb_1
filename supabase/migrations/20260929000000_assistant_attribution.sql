-- Durable attribution for bookings handed off by a server-side assistant.
-- The client id is an identifier, never a credential. Draft ids are one-way hashes.
alter table studio_admin.bookings add column if not exists assistant_client_id text
  check (assistant_client_id is null or length(assistant_client_id) between 1 and 40);
alter table studio_admin.bookings add column if not exists assistant_draft_id text
  check (assistant_draft_id is null or assistant_draft_id ~ '^[a-f0-9]{24}$');
create index if not exists bookings_assistant_client_idx
  on studio_admin.bookings (assistant_client_id, created_at desc)
  where assistant_client_id is not null;

-- Upgrade safely if the earlier assistant_requests migration was already applied
-- before idempotency was added to its original definition.
alter table studio_admin.assistant_requests add column if not exists idempotency_key_hash text;
update studio_admin.assistant_requests
set idempotency_key_hash = md5(id::text || ':legacy:1') || md5(id::text || ':legacy:2')
where idempotency_key_hash is null;
alter table studio_admin.assistant_requests alter column idempotency_key_hash set not null;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'assistant_requests_idempotency_key_hash_check'
      and conrelid = 'studio_admin.assistant_requests'::regclass
  ) then
    alter table studio_admin.assistant_requests
      add constraint assistant_requests_idempotency_key_hash_check
      check (idempotency_key_hash ~ '^[a-f0-9]{64}$');
  end if;
end $$;
create unique index if not exists assistant_requests_idempotency_idx
  on studio_admin.assistant_requests (client_id, idempotency_key_hash);
