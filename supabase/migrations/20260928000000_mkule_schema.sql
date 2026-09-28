-- ====================================================================
-- MKuLayout Schema Migration
-- Complete, idempotent PostgreSQL schema for Supabase
-- ====================================================================

-- 1. Profiles Table (Linked to Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text,
  college text,
  contact text,
  avatar_url text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Team Members Table
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  display_name text,
  role text not null,
  college text,
  email text,
  contact text,
  status_sem1 text default 'Active',
  status_sem2 text default 'Active',
  type text default 'layout',
  xp integer default 0,
  level integer default 1,
  completed_tasks integer default 0,
  current_sem_pubs integer default 0,
  schedule jsonb default '{}'::jsonb,
  avatar_url text,
  pin text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 3. Tasks Table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type_of_release text,
  type_of_content text,
  writer text,
  illus_layout text,
  graphics text,
  progress text default 'Not Started',
  writeup text,
  priority text default 'Medium',
  release_date text,
  time text,
  estimated_hours numeric,
  actual_hours numeric,
  notes text,
  reviewers text[] default '{}'::text[],
  files text[] default '{}'::text[],
  comments_count integer default 0,
  revision_count integer default 0,
  last_updated timestamptz default timezone('utc'::text, now()),
  canva_link text,
  pubmat_link text,
  draft_link text,
  added_to_layout text,
  graphics_illus text,
  online_handler text,
  is_pending_confirmation boolean default false,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 4. Task Comments Table
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  author_email text not null,
  text text not null,
  timestamp timestamptz default timezone('utc'::text, now()) not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. Personal Calendar Events Table
create table if not exists public.personal_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  user_email text not null,
  title text not null,
  date text not null,
  time text,
  notes text,
  category text default 'Personal',
  completed boolean default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. Team Calendar Events Table
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_at timestamptz not null,
  ends_at timestamptz,
  type text default 'meeting' not null,
  description text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 7. Polls Table
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  category text default 'design' not null,
  anonymous boolean default false not null,
  active boolean default true not null,
  ends_at timestamptz,
  creator text not null,
  creator_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 8. Poll Options Table
create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references public.polls(id) on delete cascade not null,
  text text not null,
  votes jsonb default '[]'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 9. Poll Votes Table (Individual tracking for strict duplicate prevention)
create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references public.polls(id) on delete cascade not null,
  option_id uuid references public.poll_options(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique(poll_id, user_id)
);

-- 10. Notifications Table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text default 'info' not null,
  timestamp timestamptz default timezone('utc'::text, now()) not null,
  read_by text[] default '{}'::text[],
  user_id uuid references public.profiles(id) on delete cascade,
  read boolean default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 11. Announcements Table
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  date text,
  author text,
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 12. Issue Sheets Table
create table if not exists public.issue_sheets (
  id text primary key,
  title text not null,
  rows jsonb default '[]'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 13. Application State Table (Key-Value JSON store for complex settings)
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.personal_calendar_events enable row level security;
alter table public.calendar_events enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.notifications enable row level security;
alter table public.announcements enable row level security;
alter table public.app_state enable row level security;

-- Profiles: Authenticated users can view all profiles; users can update their own
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Allow authenticated read profiles') then
    create policy "Allow authenticated read profiles" on public.profiles for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Allow user update own profile') then
    create policy "Allow user update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
  end if;
end $$;

-- Members: Authenticated team members can read and update directory
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'members' and policyname = 'Allow authenticated read members') then
    create policy "Allow authenticated read members" on public.members for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'members' and policyname = 'Allow authenticated upsert members') then
    create policy "Allow authenticated upsert members" on public.members for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Tasks: Authenticated users can read, insert, update, and delete tasks
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'tasks' and policyname = 'Allow authenticated all tasks') then
    create policy "Allow authenticated all tasks" on public.tasks for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Task Comments: Authenticated users can read and insert comments
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'task_comments' and policyname = 'Allow authenticated all comments') then
    create policy "Allow authenticated all comments" on public.task_comments for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Personal Calendar Events: Users can manage their own calendar events
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'personal_calendar_events' and policyname = 'Allow user manage own events') then
    create policy "Allow user manage own events" on public.personal_calendar_events for all to authenticated 
      using (auth.jwt()->>'email' = user_email or auth.uid() = user_id)
      with check (auth.jwt()->>'email' = user_email or auth.uid() = user_id);
  end if;
end $$;

-- Calendar Events: Authenticated users can view and manage desk events
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'calendar_events' and policyname = 'Allow authenticated all calendar_events') then
    create policy "Allow authenticated all calendar_events" on public.calendar_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Polls & Options: Authenticated users can view and vote on polls
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'polls' and policyname = 'Allow authenticated all polls') then
    create policy "Allow authenticated all polls" on public.polls for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'poll_options' and policyname = 'Allow authenticated all poll_options') then
    create policy "Allow authenticated all poll_options" on public.poll_options for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'poll_votes' and policyname = 'Allow authenticated all poll_votes') then
    create policy "Allow authenticated all poll_votes" on public.poll_votes for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Notifications: Authenticated users can view notifications
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'notifications' and policyname = 'Allow authenticated all notifications') then
    create policy "Allow authenticated all notifications" on public.notifications for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Announcements: Authenticated users can view and manage announcements
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'announcements' and policyname = 'Allow authenticated all announcements') then
    create policy "Allow authenticated all announcements" on public.announcements for all to authenticated using (true) with check (true);
  end if;
end $$;

-- App State: Authenticated users can view and update shared app state
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'app_state' and policyname = 'Allow authenticated all app_state') then
    create policy "Allow authenticated all app_state" on public.app_state for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ====================================================================
-- SUPABASE REALTIME CONFIGURATION
-- Enable realtime publication on necessary workflow tables
-- ====================================================================
do $$ begin
  alter publication supabase_realtime add table public.tasks;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.task_comments;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.personal_calendar_events;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.calendar_events;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.polls;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.poll_options;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.announcements;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.members;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.app_state;
exception when others then null;
end $$;
