alter table studio_admin.projects add column is_focus boolean not null default false;
create unique index projects_one_focus_idx on studio_admin.projects (is_focus) where is_focus;
