-- Recreating these security-invoker views in the automation migration reset
-- the service_role grants established by the foundation migration. Server-only
-- jobs (including booking SMS reminders) query the views with that role.
grant select on studio_admin.booking_ledger, studio_admin.client_summary to service_role;
