-- Run this in Neon (SQL Editor) to set up the database

create table if not exists tasks (
  id uuid primary key,
  title text not null,
  completed boolean not null default false,
  priority smallint not null default 1,
  due_date timestamptz null,
  tags text[] not null default '{}',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_created_at on tasks(created_at desc);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_tasks_priority on tasks(priority);
create index if not exists idx_tasks_title_lower on tasks((lower(title)));
create index if not exists idx_tasks_tags on tasks using gin(tags);

