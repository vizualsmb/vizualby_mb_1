-- Simplify the production workspace to the five stages used in the studio:
-- Cut, Edit, Color Grade, VFX, and SFX.

create temporary table _production_stage_progress on commit drop as
select
  p.id as project_id,
  coalesce(bool_or(t.completed) filter (where t.stage = 'footage'), false) as cut_done,
  coalesce(bool_or(t.completed) filter (where t.stage = 'editing'), false) as edit_done,
  coalesce(bool_or(t.completed) filter (where t.stage = 'color'), false) as color_done,
  coalesce(bool_or(t.completed) filter (where t.stage = 'vfx'), false) as vfx_done,
  coalesce(bool_or(t.completed) filter (where t.stage = 'sound'), false) as sfx_done
from studio_admin.projects p
left join studio_admin.project_tasks t on t.project_id = p.id
group by p.id;

delete from studio_admin.project_tasks;
delete from studio_admin.project_stages;

insert into studio_admin.project_stages (project_id, stage, status, completed_at, sort_order)
select project_id, stage, case when done then 'completed'::studio_admin.production_status else 'not_started'::studio_admin.production_status end,
  case when done then now() else null end, sort_order
from _production_stage_progress p
cross join lateral (values
  ('footage'::studio_admin.production_stage, p.cut_done, 1),
  ('editing'::studio_admin.production_stage, p.edit_done, 2),
  ('color'::studio_admin.production_stage, p.color_done, 3),
  ('vfx'::studio_admin.production_stage, p.vfx_done, 4),
  ('sound'::studio_admin.production_stage, p.sfx_done, 5)
) as stages(stage, done, sort_order);

insert into studio_admin.project_tasks (project_id, stage, title, completed, completed_at, sort_order)
select project_id, stage, title, done, case when done then now() else null end, sort_order
from _production_stage_progress p
cross join lateral (values
  ('footage'::studio_admin.production_stage, 'Cut', p.cut_done, 1),
  ('editing'::studio_admin.production_stage, 'Edit', p.edit_done, 2),
  ('color'::studio_admin.production_stage, 'Color Grade', p.color_done, 3),
  ('vfx'::studio_admin.production_stage, 'VFX', p.vfx_done, 4),
  ('sound'::studio_admin.production_stage, 'SFX', p.sfx_done, 5)
) as tasks(stage, title, done, sort_order);

update studio_admin.projects p
set current_stage = case
  when not s.cut_done then 'footage'::studio_admin.production_stage
  when not s.edit_done then 'editing'::studio_admin.production_stage
  when not s.color_done then 'color'::studio_admin.production_stage
  when not s.vfx_done then 'vfx'::studio_admin.production_stage
  else 'sound'::studio_admin.production_stage
end
from _production_stage_progress s
where s.project_id = p.id;

notify pgrst, 'reload schema';
