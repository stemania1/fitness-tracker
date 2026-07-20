-- Energy check-ins: a lightweight subjective log ("how's your energy right
-- now?", 1 drained … 5 energized). Paired with the day's objective signals
-- (sleep, recovery, training, fuel) it powers the felt-vs-expected energy
-- read on the dashboard, and over time surfaces personal energy drivers.
create table energy_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- subjective energy, 1 (drained) .. 5 (energized)
  level smallint not null check (level between 1 and 5),
  -- local hour 0-23 at check-in, for circadian context
  logged_hour smallint not null check (logged_hour between 0 and 23),
  part_of_day text not null check (part_of_day in ('morning', 'afternoon', 'evening')),
  logged_on date not null default current_date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index energy_checkins_user_date_idx on energy_checkins (user_id, logged_on);

-- RLS: users can only see/manage their own check-ins
alter table energy_checkins enable row level security;

create policy "Users can view own energy checkins"
  on energy_checkins for select
  using (auth.uid() = user_id);

create policy "Users can insert own energy checkins"
  on energy_checkins for insert
  with check (auth.uid() = user_id);

create policy "Users can update own energy checkins"
  on energy_checkins for update
  using (auth.uid() = user_id);

create policy "Users can delete own energy checkins"
  on energy_checkins for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at
create trigger update_energy_checkins_updated_at
  before update on energy_checkins
  for each row execute function update_updated_at();
