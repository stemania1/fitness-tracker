-- Movement on days the ring wasn't worn.
--
-- The Daily Movement card reads Oura's activity document and renders nothing
-- without one, so a day off the charger erased the whole section — silently,
-- which is the worst way for a tracker to lose a day. This gives those days
-- a hand-entered figure.
--
-- Deliberately NOT stored in `oura_daily`. That table is a cache of what the
-- ring reported: the sync re-upserts a rolling 90-day window on every run, so
-- a manual value written there would be destroyed by the next sync — probably
-- hours later, with no trace of why the number vanished.
--
-- `day` is the user's local date, matching the convention of creatine_logs
-- and energy_checkins; (user_id, day) is unique so re-logging a day corrects
-- it rather than accumulating duplicates.
create table manual_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  steps integer check (steps is null or steps >= 0),
  active_minutes integer check (active_minutes is null or active_minutes >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, day)
);

comment on table manual_activity_logs is
  'Hand-entered steps / moderate+ minutes for days with no Oura data. Ring data wins where both exist — see resolveDailyMovement in src/lib/daily-movement.ts.';

create index manual_activity_logs_user_idx on manual_activity_logs (user_id, day desc);

alter table manual_activity_logs enable row level security;

create policy "Users can view own manual activity"
  on manual_activity_logs for select using (auth.uid() = user_id);
create policy "Users can insert own manual activity"
  on manual_activity_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own manual activity"
  on manual_activity_logs for update using (auth.uid() = user_id);
create policy "Users can delete own manual activity"
  on manual_activity_logs for delete using (auth.uid() = user_id);

create trigger update_manual_activity_logs_updated_at
  before update on manual_activity_logs
  for each row execute function update_updated_at();
