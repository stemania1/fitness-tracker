-- Caffeine intake log: one row per drink (mg + when). Feeds the Energy
-- Check-In — an alertness/crash driver on today's read, and a forward-looking
-- "late caffeine may hurt tonight's sleep" warning.
create table caffeine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- caffeine content in milligrams
  mg integer not null check (mg > 0 and mg <= 1000),
  -- optional label for the source (e.g. "Coffee", "Cold brew")
  source text,
  logged_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index caffeine_logs_user_time_idx on caffeine_logs (user_id, logged_at);

-- RLS: users can only see/manage their own caffeine logs
alter table caffeine_logs enable row level security;

create policy "Users can view own caffeine logs"
  on caffeine_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own caffeine logs"
  on caffeine_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own caffeine logs"
  on caffeine_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own caffeine logs"
  on caffeine_logs for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at
create trigger update_caffeine_logs_updated_at
  before update on caffeine_logs
  for each row execute function update_updated_at();
