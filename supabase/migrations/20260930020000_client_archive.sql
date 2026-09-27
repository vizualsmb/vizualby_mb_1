-- Removing a client hides them from the client directory while preserving
-- booking, payment, and production history that still references the client.
alter table studio_admin.clients add column archived_at timestamptz;

drop view studio_admin.client_summary;
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
where c.archived_at is null
group by c.id;

grant select on studio_admin.client_summary to authenticated;
