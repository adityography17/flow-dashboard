-- ═══════════════════════════════════════════════════════════════════
-- Flow by Anecdote — Supabase Setup Script v2
-- Run this entire script in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════

-- Drop old tables if they exist (clean slate)
drop table if exists flow_planner    cascade;
drop table if exists flow_messages   cascade;
drop table if exists flow_attendance cascade;
drop table if exists flow_leaves     cascade;
drop table if exists flow_calendar   cascade;
drop table if exists flow_content    cascade;
drop table if exists flow_clients    cascade;
drop table if exists flow_users      cascade;

-- ── Users ──────────────────────────────────────────────────────────
create table flow_users (
  id           int primary key,
  name         text,
  display_name text,
  "displayName" text,
  username     text unique,
  password     text,
  role         text,
  avatar       text,
  email        text,
  created_at   timestamptz default now()
);

-- ── Clients ────────────────────────────────────────────────────────
create table flow_clients (
  id            bigint primary key default extract(epoch from now())::bigint,
  name          text,
  contact       text,
  email         text,
  phone         text,
  services      jsonb default '[]',
  status        text default 'enquiry',
  onboarded     boolean default false,
  "socialAccess" jsonb default '{}',
  "enquiryDate" text,
  "dealDate"    text,
  data          jsonb default '{}'
);

-- ── Content ────────────────────────────────────────────────────────
create table flow_content (
  id              bigint primary key,
  "clientId"      bigint,
  title           text,
  "scheduledDate" text,
  "scheduledTime" text,
  "execCaption"   text,
  "adminCaption"  text,
  "adminComment"  text,
  status          text default 'draft',
  "clientStatus"  text default 'not_submitted',
  "execId"        int,
  "mediaType"     text,
  "mediaName"     text,
  "mediaDataUrl"  text,
  "createdAt"     text,
  "postedAt"      text,
  data            jsonb default '{}'
);

-- ── Content Calendar ───────────────────────────────────────────────
create table flow_calendar (
  id          bigint primary key,
  "clientId"  bigint,
  month       text,
  dates       jsonb default '[]',
  posts       jsonb default '[]',
  tasks       jsonb default '[]',
  status      text default 'draft',
  "createdBy" int,
  "approvedBy" int,
  data        jsonb default '{}'
);

-- ── Leaves ─────────────────────────────────────────────────────────
create table flow_leaves (
  id          bigint primary key,
  "userId"    int,
  reason      text,
  "from"      text,
  "to"        text,
  status      text default 'pending',
  "appliedOn" text,
  data        jsonb default '{}'
);

-- ── Attendance ─────────────────────────────────────────────────────
create table flow_attendance (
  id          bigint primary key,
  "userId"    int,
  date        text,
  login       text,
  logout      text,
  "selfieIn"  text,
  "selfieOut" text,
  data        jsonb default '{}'
);

-- ── Messages ───────────────────────────────────────────────────────
create table flow_messages (
  id        bigint primary key,
  "fromId"  int,
  "toId"    text,
  text      text,
  time      text,
  date      text,
  "replyTo" jsonb,
  "readBy"  jsonb default '[]',
  data      jsonb default '{}'
);

-- ── Planner ────────────────────────────────────────────────────────
create table flow_planner (
  id        int primary key,
  "userId"  int unique,
  events    jsonb default '[]'
);

-- ═══════════════════════════════════════════════════════════════════
-- Enable Row Level Security + allow all for anon key
-- (App handles its own auth internally)
-- ═══════════════════════════════════════════════════════════════════
alter table flow_users      enable row level security;
alter table flow_clients     enable row level security;
alter table flow_content     enable row level security;
alter table flow_calendar    enable row level security;
alter table flow_leaves      enable row level security;
alter table flow_attendance  enable row level security;
alter table flow_messages    enable row level security;
alter table flow_planner     enable row level security;

create policy "allow_all" on flow_users      for all using (true) with check (true);
create policy "allow_all" on flow_clients     for all using (true) with check (true);
create policy "allow_all" on flow_content     for all using (true) with check (true);
create policy "allow_all" on flow_calendar    for all using (true) with check (true);
create policy "allow_all" on flow_leaves      for all using (true) with check (true);
create policy "allow_all" on flow_attendance  for all using (true) with check (true);
create policy "allow_all" on flow_messages    for all using (true) with check (true);
create policy "allow_all" on flow_planner     for all using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════
-- Enable real-time on all tables
-- ═══════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table flow_users;
alter publication supabase_realtime add table flow_clients;
alter publication supabase_realtime add table flow_content;
alter publication supabase_realtime add table flow_calendar;
alter publication supabase_realtime add table flow_leaves;
alter publication supabase_realtime add table flow_attendance;
alter publication supabase_realtime add table flow_messages;
alter publication supabase_realtime add table flow_planner;

-- ═══════════════════════════════════════════════════════════════════
-- Seed the 4 default users
-- ═══════════════════════════════════════════════════════════════════
insert into flow_users (id, name, "displayName", username, password, role, avatar, email) values
  (1, 'Aryan Shah',  'Super Admin', 'SuperAdmin',  'super123', 'superadmin', 'AS', 'aryan@agency.com'),
  (2, 'Priya Mehta', 'Admin',       'Admin',        'admin123', 'admin',      'PM', 'priya@agency.com'),
  (3, 'Rahul Verma', 'Executive 1', 'Executive_1',  'exec123',  'executive',  'RV', 'rahul@agency.com'),
  (4, 'Sneha Joshi', 'Executive 2', 'Executive_2',  'exec456',  'executive',  'SJ', 'sneha@agency.com')
on conflict (id) do update set
  name="excluded".name, "displayName"="excluded"."displayName",
  username="excluded".username, role="excluded".role;

select 'Setup complete! All tables created with real-time enabled.' as status;
