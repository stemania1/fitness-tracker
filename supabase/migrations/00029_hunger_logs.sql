-- Hunger recorded on its own, with no meal attached.
--
-- 00028 put a hunger rating on the meal log, which measures the gap that just
-- ended: rate your noon lunch and you have described how well breakfast held
-- you. That covers the common case for free, but it can only ever record
-- hunger at the moments you happen to eat.
--
-- The interesting moment is usually earlier than that. "Starving at 10:30"
-- says something about breakfast that "moderately hungry at noon" does not,
-- and waiting for the next meal to ask rounds it off — you ate at noon, so
-- noon is the only timestamp the data ever sees. Worse, the strongest signal
-- of a meal that failed is hunger arriving well before you next sit down,
-- which the meal-attached rating structurally cannot capture.
--
-- Same 1-5 scale as food_logs.pre_meal_hunger, deliberately: the two streams
-- are merged into one timeline of rated observations by satietyIntervals in
-- src/lib/satiety.ts, so they have to mean the same thing.
--
-- logged_at, not a date: the whole value is in when the hunger arrived.
create table hunger_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 1 (still full) .. 5 (ravenous)
  level smallint not null check (level between 1 and 5),
  logged_at timestamptz not null default now(),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table hunger_logs is
  'Standalone hunger ratings, not tied to a meal. Merged with food_logs.pre_meal_hunger by satietyIntervals — same 1-5 scale.';

create index hunger_logs_user_time_idx on hunger_logs (user_id, logged_at desc);

alter table hunger_logs enable row level security;

create policy "Users can view own hunger logs"
  on hunger_logs for select using (auth.uid() = user_id);
create policy "Users can insert own hunger logs"
  on hunger_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own hunger logs"
  on hunger_logs for update using (auth.uid() = user_id);
create policy "Users can delete own hunger logs"
  on hunger_logs for delete using (auth.uid() = user_id);

create trigger update_hunger_logs_updated_at
  before update on hunger_logs
  for each row execute function update_updated_at();
