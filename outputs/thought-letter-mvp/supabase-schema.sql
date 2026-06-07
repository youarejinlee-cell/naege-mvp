create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  first_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  mood text not null,
  mood_category text,
  energy integer not null check (energy between 1 and 5),
  source text not null default 'web',
  demo_tag text,
  created_at timestamptz not null,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.letter_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_start_date date not null,
  input_end_date date not null,
  send_date date not null,
  status text not null default 'delivered' check (status in ('scheduled', 'delivered', 'skipped')),
  created_at timestamptz not null default now(),
  unique (user_id, send_date)
);

create table if not exists public.letters (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid references public.letter_periods(id) on delete set null,
  period_start date not null,
  period_end date not null,
  delivered_at date not null,
  title text not null,
  body text not null,
  html text not null,
  summary_json jsonb not null default '{}'::jsonb,
  themes jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  postscript text not null default '',
  model text,
  prompt_version text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  notifications_enabled boolean not null default false,
  schedule_mode text not null default 'interval' check (schedule_mode in ('interval', 'fixed')),
  start_time time not null default '09:30',
  interval_minutes integer not null default 120 check (interval_minutes between 10 and 120),
  dnd_start time not null default '22:30',
  dnd_end time not null default '08:00',
  weekdays integer[] not null default array[1,2,3,4,5,6,7],
  fixed_times text[] not null default array['10:00'],
  timezone text not null default 'Asia/Seoul',
  updated_at timestamptz not null default now()
);

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  device_id text,
  provider text not null default 'expo',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  letter_settings jsonb not null default '{}'::jsonb,
  test_overrides jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.entries add column if not exists mood_category text;
alter table public.entries add column if not exists source text not null default 'web';
alter table public.entries add column if not exists updated_at timestamptz not null default now();

alter table public.letters add column if not exists period_id uuid references public.letter_periods(id) on delete set null;
alter table public.letters add column if not exists body text not null default '';
alter table public.letters add column if not exists summary_json jsonb not null default '{}'::jsonb;
alter table public.letters add column if not exists model text;
alter table public.letters add column if not exists prompt_version text;
alter table public.letters add column if not exists updated_at timestamptz not null default now();

alter table public.notification_settings add column if not exists schedule_mode text not null default 'interval';
alter table public.notification_settings add column if not exists weekdays integer[] not null default array[1,2,3,4,5,6,7];
alter table public.notification_settings add column if not exists fixed_times text[] not null default array['10:00'];
alter table public.notification_settings drop constraint if exists notification_settings_interval_minutes_check;
alter table public.notification_settings
  add constraint notification_settings_interval_minutes_check
  check (interval_minutes between 10 and 120);

create index if not exists entries_user_created_at_idx on public.entries (user_id, created_at desc);
create index if not exists letters_user_delivered_at_idx on public.letters (user_id, delivered_at desc);
create index if not exists letter_periods_user_send_date_idx on public.letter_periods (user_id, send_date desc);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.letter_periods enable row level security;
alter table public.letters enable row level security;
alter table public.notification_settings enable row level security;
alter table public.push_tokens enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "Users can read own profiles" on public.profiles;
create policy "Users can read own profiles"
on public.profiles for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own profiles" on public.profiles;
create policy "Users can insert own profiles"
on public.profiles for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own profiles" on public.profiles;
create policy "Users can update own profiles"
on public.profiles for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own entries" on public.entries;
create policy "Users can read own entries"
on public.entries for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own entries" on public.entries;
create policy "Users can insert own entries"
on public.entries for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own entries" on public.entries;
create policy "Users can update own entries"
on public.entries for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own entries" on public.entries;
create policy "Users can delete own entries"
on public.entries for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own letter periods" on public.letter_periods;
create policy "Users can read own letter periods"
on public.letter_periods for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own letter periods" on public.letter_periods;
create policy "Users can insert own letter periods"
on public.letter_periods for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own letter periods" on public.letter_periods;
create policy "Users can update own letter periods"
on public.letter_periods for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own letter periods" on public.letter_periods;
create policy "Users can delete own letter periods"
on public.letter_periods for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own letters" on public.letters;
create policy "Users can read own letters"
on public.letters for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own letters" on public.letters;
create policy "Users can insert own letters"
on public.letters for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own letters" on public.letters;
create policy "Users can update own letters"
on public.letters for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own letters" on public.letters;
create policy "Users can delete own letters"
on public.letters for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own notification settings" on public.notification_settings;
create policy "Users can read own notification settings"
on public.notification_settings for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own notification settings" on public.notification_settings;
create policy "Users can insert own notification settings"
on public.notification_settings for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own notification settings" on public.notification_settings;
create policy "Users can update own notification settings"
on public.notification_settings for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own notification settings" on public.notification_settings;
create policy "Users can delete own notification settings"
on public.notification_settings for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own push tokens" on public.push_tokens;
create policy "Users can read own push tokens"
on public.push_tokens for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own push tokens" on public.push_tokens;
create policy "Users can insert own push tokens"
on public.push_tokens for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own push tokens" on public.push_tokens;
create policy "Users can update own push tokens"
on public.push_tokens for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own push tokens" on public.push_tokens;
create policy "Users can delete own push tokens"
on public.push_tokens for delete
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read own app settings" on public.app_settings;
create policy "Users can read own app settings"
on public.app_settings for select
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own app settings" on public.app_settings;
create policy "Users can insert own app settings"
on public.app_settings for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own app settings" on public.app_settings;
create policy "Users can update own app settings"
on public.app_settings for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own app settings" on public.app_settings;
create policy "Users can delete own app settings"
on public.app_settings for delete
using ((select auth.uid()) = user_id);
