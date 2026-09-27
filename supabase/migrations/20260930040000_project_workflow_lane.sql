alter table studio_admin.projects
  add column if not exists workflow_lane text not null default 'active'
  check (workflow_lane in ('active', 'review', 'delivered'));

create index if not exists projects_workflow_lane_idx on studio_admin.projects (workflow_lane, delivery_at);
notify pgrst, 'reload schema';
