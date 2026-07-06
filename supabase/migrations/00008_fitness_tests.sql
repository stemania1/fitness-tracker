-- Fitness field tests: periodic benchmark results (Cooper 12-min run,
-- max strict pull-ups) that feed the VO2 Max trend on the dashboard.
create table fitness_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_type text not null check (test_type in ('cooper_run', 'pullup_max')),
  -- cooper_run: distance covered in meters; pullup_max: strict reps
  result decimal(7,1) not null check (result > 0),
  tested_at date not null default current_date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index fitness_tests_user_date_idx on fitness_tests (user_id, tested_at);

-- RLS: users can only see/manage their own test results
alter table fitness_tests enable row level security;

create policy "Users can view own fitness tests"
  on fitness_tests for select
  using (auth.uid() = user_id);

create policy "Users can insert own fitness tests"
  on fitness_tests for insert
  with check (auth.uid() = user_id);

create policy "Users can update own fitness tests"
  on fitness_tests for update
  using (auth.uid() = user_id);

create policy "Users can delete own fitness tests"
  on fitness_tests for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at
create trigger update_fitness_tests_updated_at
  before update on fitness_tests
  for each row execute function update_updated_at();
