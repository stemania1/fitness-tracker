-- Alcohol intake log: one row per drink (grams of ethanol + when).
--
-- Modelled on caffeine_logs rather than on meal_type, because alcohol's
-- interesting effects are dose- and time-dependent: what it does to REM sleep,
-- HRV, and next-day readiness depends on how much and how close to bed, none
-- of which a category label on a food row can express.
--
-- Stored as grams of ethanol, not "drinks". A standard drink is a unit of
-- convenience (14g in the US, 10g in the UK and Australia) and a pint of IPA
-- is not one of them; grams are the physical quantity every model here wants,
-- and the display converts.
create table alcohol_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Ethanol in grams. The ceiling is a data-entry guard, not a health
  -- statement: 500g is far past any plausible single log.
  grams_ethanol numeric(6,2) not null
    check (grams_ethanol > 0 and grams_ethanol <= 500),
  -- Optional label for the source (e.g. "Red wine", "IPA").
  source text,
  logged_at timestamptz not null default now(),
  -- Alcohol that came from a logged meal or drink. The FK is what keeps the
  -- two rows from drifting: deleting the meal takes its alcohol with it.
  -- Null for a drink logged on its own.
  source_food_log_id uuid references food_logs(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index alcohol_logs_user_time_idx on alcohol_logs (user_id, logged_at);

create index alcohol_logs_source_food_idx
  on alcohol_logs (source_food_log_id)
  where source_food_log_id is not null;

alter table alcohol_logs enable row level security;

create policy "Users can view own alcohol logs"
  on alcohol_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own alcohol logs"
  on alcohol_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own alcohol logs"
  on alcohol_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own alcohol logs"
  on alcohol_logs for delete
  using (auth.uid() = user_id);

create trigger update_alcohol_logs_updated_at
  before update on alcohol_logs
  for each row execute function update_updated_at();
