-- ═══════════════════════════════════════════════════════════════════════════
-- FLOW BY ANECDOTE — Supabase Database Setup
-- Run this ENTIRE script in Supabase → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── USERS ────────────────────────────────────────────────────────────────────
create table if not exists users (
  id           serial primary key,
  name         text not null,
  username     text unique not null,
  display_name text,
  password     text not null,
  role         text not null default 'executive',
  avatar       text,
  email        text
);

-- ── CLIENTS ──────────────────────────────────────────────────────────────────
create table if not exists clients (
  id            serial primary key,
  name          text not null,
  contact       text,
  email         text,
  phone         text,
  services      text[]  default '{}',
  status        text    default 'enquiry',
  onboarded     boolean default false,
  social_access jsonb   default '{}',
  enquiry_date  text,
  deal_date     text
);

-- ── CONTENT ──────────────────────────────────────────────────────────────────
create table if not exists content (
  id             serial primary key,
  client_id      int references clients(id) on delete cascade,
  title          text,
  exec_caption   text default '',
  admin_caption  text default '',
  admin_comment  text default '',
  status         text default 'draft',
  scheduled_date text,
  scheduled_time text default '10:00',
  exec_id        int references users(id),
  media_type     text,
  media_name     text,
  media_data_url text,
  created_at     text,
  posted_at      text
);

-- ── CALENDAR ─────────────────────────────────────────────────────────────────
create table if not exists calendar (
  id          serial primary key,
  client_id   int references clients(id) on delete cascade,
  month       text,
  posts       text[]  default '{}',
  dates       text[]  default '{}',
  status      text    default 'pending',
  created_by  int references users(id),
  approved_by int references users(id)
);

-- ── LEAVES ───────────────────────────────────────────────────────────────────
create table if not exists leaves (
  id          serial primary key,
  user_id     int references users(id) on delete cascade,
  reason      text,
  from_date   text,
  to_date     text,
  status      text default 'pending',
  applied_on  text
);

-- ── ATTENDANCE ───────────────────────────────────────────────────────────────
create table if not exists attendance (
  id           serial primary key,
  user_id      int references users(id) on delete cascade,
  date         text,
  login_time   text,
  logout_time  text,
  unique(user_id, date)
);

-- ── MESSAGES ─────────────────────────────────────────────────────────────────
create table if not exists messages (
  id       serial primary key,
  from_id  int references users(id),
  to_id    text,   -- 'all' or user id as string
  text     text,
  time     text,
  date     text
);

-- ── PLANNER EVENTS ───────────────────────────────────────────────────────────
create table if not exists planner_events (
  id         serial primary key,
  user_id    int references users(id) on delete cascade,
  title      text,
  date       text,
  start_hour int,
  end_hour   int,
  color      text default '#C4954A'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA — Initial users and sample data
-- ═══════════════════════════════════════════════════════════════════════════

insert into users (name, username, display_name, password, role, avatar, email) values
  ('Aryan Shah',  'SuperAdmin',  'Super Admin',  'super123', 'superadmin', 'AS', 'aryan@agency.com'),
  ('Priya Mehta', 'Admin',       'Admin',        'admin123', 'admin',      'PM', 'priya@agency.com'),
  ('Rahul Verma', 'Executive_1', 'Executive 1',  'exec123',  'executive',  'RV', 'rahul@agency.com'),
  ('Sneha Joshi', 'Executive_2', 'Executive 2',  'exec456',  'executive',  'SJ', 'sneha@agency.com')
on conflict (username) do nothing;

insert into clients (name, contact, email, phone, services, status, onboarded, social_access, enquiry_date, deal_date) values
  ('Lumière Cosmetics', 'Aisha Kapoor', 'aisha@lumiere.com', '+91 98765 43210',
   '{"Social Media Management","Branding"}', 'active', true,
   '{"instagram":"@lumiere_beauty","facebook":"Lumière Official"}', '2024-01-10', '2024-01-20'),
  ('Verde Architecture', 'Rohan Gupta', 'rohan@verde.in', '+91 87654 32109',
   '{"Design","Video Editing"}', 'active', true, '{}', '2024-02-05', '2024-02-15'),
  ('Noor Jewels', 'Fatima Shaikh', 'fatima@noor.com', '+91 76543 21098',
   '{"Social Media Management"}', 'enquiry', false, '{}', '2024-03-01', null)
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — Allow all operations for anon key (simple auth model)
-- For production with proper auth, replace with user-based policies
-- ═══════════════════════════════════════════════════════════════════════════

alter table users           enable row level security;
alter table clients         enable row level security;
alter table content         enable row level security;
alter table calendar        enable row level security;
alter table leaves          enable row level security;
alter table attendance      enable row level security;
alter table messages        enable row level security;
alter table planner_events  enable row level security;

-- Allow full access via anon key (the app handles its own auth)
create policy "allow_all_users"          on users           for all using (true) with check (true);
create policy "allow_all_clients"        on clients         for all using (true) with check (true);
create policy "allow_all_content"        on content         for all using (true) with check (true);
create policy "allow_all_calendar"       on calendar        for all using (true) with check (true);
create policy "allow_all_leaves"         on leaves          for all using (true) with check (true);
create policy "allow_all_attendance"     on attendance      for all using (true) with check (true);
create policy "allow_all_messages"       on messages        for all using (true) with check (true);
create policy "allow_all_planner_events" on planner_events  for all using (true) with check (true);

-- Enable realtime for messages (live chat)
alter publication supabase_realtime add table messages;
