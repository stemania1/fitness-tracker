-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- user_profiles (extends auth.users)
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age integer,
  sex text check (sex in ('male', 'female', 'other')),
  height_inches integer,
  current_weight decimal(5,1),
  fitness_level text check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  primary_goal text check (primary_goal in ('lose_weight', 'build_muscle', 'improve_endurance', 'general_fitness')),
  target_weight decimal(5,1),
  workout_days integer check (workout_days between 2 and 6),
  limitations text,
  onboarding_done boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- equipment catalog
create table equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('cardio', 'strength_machine', 'free_weight', 'cable', 'other')),
  muscle_groups text[] not null default '{}',
  available_at_pf boolean default true,
  max_weight decimal(5,1),
  notes text
);

-- exercises
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  equipment_id uuid references equipment(id),
  muscle_groups text[] not null,
  exercise_type text not null check (exercise_type in ('strength', 'cardio', 'flexibility')),
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  instructions text,
  default_sets integer,
  default_reps text,
  pf_friendly boolean default true
);

-- workout_templates
create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  split_type text check (split_type in ('full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'cardio', 'express')),
  estimated_mins integer,
  is_generated boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- template_exercises
create table template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workout_templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  order_index integer not null,
  sets integer default 3,
  reps text default '10',
  rest_seconds integer default 60,
  notes text
);

-- workout_logs
create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references workout_templates(id) on delete set null,
  name text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  duration_mins integer,
  notes text,
  created_at timestamptz default now()
);

-- exercise_logs
create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references workout_logs(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  order_index integer not null,
  notes text
);

-- set_logs
create table set_logs (
  id uuid primary key default gen_random_uuid(),
  exercise_log_id uuid not null references exercise_logs(id) on delete cascade,
  set_number integer not null,
  reps integer,
  weight decimal(5,1),
  duration_mins decimal(5,1),
  distance_miles decimal(5,2),
  heart_rate integer,
  rpe integer check (rpe between 1 and 10)
);

-- weight_logs
create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight decimal(5,1) not null,
  logged_at timestamptz default now(),
  notes text
);

-- user_goals
create table user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('weight', 'strength', 'endurance', 'consistency')),
  exercise_id uuid references exercises(id),
  target_value decimal(7,1) not null,
  current_value decimal(7,1),
  unit text not null,
  deadline date,
  achieved_at timestamptz,
  created_at timestamptz default now()
);

-- Add indexes
create index idx_workout_templates_user on workout_templates(user_id);
create index idx_template_exercises_template on template_exercises(template_id);
create index idx_workout_logs_user on workout_logs(user_id);
create index idx_workout_logs_started on workout_logs(user_id, started_at desc);
create index idx_exercise_logs_workout on exercise_logs(workout_log_id);
create index idx_set_logs_exercise on set_logs(exercise_log_id);
create index idx_weight_logs_user on weight_logs(user_id, logged_at desc);
create index idx_user_goals_user on user_goals(user_id);
create index idx_exercises_type on exercises(exercise_type);
create index idx_exercises_muscle on exercises using gin(muscle_groups);

-- Enable RLS on all tables
alter table user_profiles enable row level security;
alter table equipment enable row level security;
alter table exercises enable row level security;
alter table workout_templates enable row level security;
alter table template_exercises enable row level security;
alter table workout_logs enable row level security;
alter table exercise_logs enable row level security;
alter table set_logs enable row level security;
alter table weight_logs enable row level security;
alter table user_goals enable row level security;

-- RLS policies for user_profiles
create policy "Users can view own profile" on user_profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on user_profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on user_profiles for update using (auth.uid() = id);

-- Equipment and exercises are readable by all authenticated users
create policy "Authenticated users can view equipment" on equipment for select using (auth.role() = 'authenticated');
create policy "Authenticated users can view exercises" on exercises for select using (auth.role() = 'authenticated');

-- RLS for workout_templates
create policy "Users can view own templates" on workout_templates for select using (auth.uid() = user_id);
create policy "Users can insert own templates" on workout_templates for insert with check (auth.uid() = user_id);
create policy "Users can update own templates" on workout_templates for update using (auth.uid() = user_id);
create policy "Users can delete own templates" on workout_templates for delete using (auth.uid() = user_id);

-- RLS for template_exercises (via template ownership)
create policy "Users can view own template exercises" on template_exercises for select using (
  exists (select 1 from workout_templates where id = template_exercises.template_id and user_id = auth.uid())
);
create policy "Users can insert own template exercises" on template_exercises for insert with check (
  exists (select 1 from workout_templates where id = template_exercises.template_id and user_id = auth.uid())
);
create policy "Users can update own template exercises" on template_exercises for update using (
  exists (select 1 from workout_templates where id = template_exercises.template_id and user_id = auth.uid())
);
create policy "Users can delete own template exercises" on template_exercises for delete using (
  exists (select 1 from workout_templates where id = template_exercises.template_id and user_id = auth.uid())
);

-- RLS for workout_logs
create policy "Users can view own logs" on workout_logs for select using (auth.uid() = user_id);
create policy "Users can insert own logs" on workout_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own logs" on workout_logs for update using (auth.uid() = user_id);
create policy "Users can delete own logs" on workout_logs for delete using (auth.uid() = user_id);

-- RLS for exercise_logs (via workout_log ownership)
create policy "Users can view own exercise logs" on exercise_logs for select using (
  exists (select 1 from workout_logs where id = exercise_logs.workout_log_id and user_id = auth.uid())
);
create policy "Users can insert own exercise logs" on exercise_logs for insert with check (
  exists (select 1 from workout_logs where id = exercise_logs.workout_log_id and user_id = auth.uid())
);
create policy "Users can update own exercise logs" on exercise_logs for update using (
  exists (select 1 from workout_logs where id = exercise_logs.workout_log_id and user_id = auth.uid())
);
create policy "Users can delete own exercise logs" on exercise_logs for delete using (
  exists (select 1 from workout_logs where id = exercise_logs.workout_log_id and user_id = auth.uid())
);

-- RLS for set_logs (via exercise_log -> workout_log ownership)
create policy "Users can view own set logs" on set_logs for select using (
  exists (
    select 1 from exercise_logs el
    join workout_logs wl on wl.id = el.workout_log_id
    where el.id = set_logs.exercise_log_id and wl.user_id = auth.uid()
  )
);
create policy "Users can insert own set logs" on set_logs for insert with check (
  exists (
    select 1 from exercise_logs el
    join workout_logs wl on wl.id = el.workout_log_id
    where el.id = set_logs.exercise_log_id and wl.user_id = auth.uid()
  )
);
create policy "Users can update own set logs" on set_logs for update using (
  exists (
    select 1 from exercise_logs el
    join workout_logs wl on wl.id = el.workout_log_id
    where el.id = set_logs.exercise_log_id and wl.user_id = auth.uid()
  )
);
create policy "Users can delete own set logs" on set_logs for delete using (
  exists (
    select 1 from exercise_logs el
    join workout_logs wl on wl.id = el.workout_log_id
    where el.id = set_logs.exercise_log_id and wl.user_id = auth.uid()
  )
);

-- RLS for weight_logs
create policy "Users can view own weight logs" on weight_logs for select using (auth.uid() = user_id);
create policy "Users can insert own weight logs" on weight_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own weight logs" on weight_logs for update using (auth.uid() = user_id);
create policy "Users can delete own weight logs" on weight_logs for delete using (auth.uid() = user_id);

-- RLS for user_goals
create policy "Users can view own goals" on user_goals for select using (auth.uid() = user_id);
create policy "Users can insert own goals" on user_goals for insert with check (auth.uid() = user_id);
create policy "Users can update own goals" on user_goals for update using (auth.uid() = user_id);
create policy "Users can delete own goals" on user_goals for delete using (auth.uid() = user_id);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to call function on user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at trigger function
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_profiles_updated_at before update on user_profiles
  for each row execute function update_updated_at();
create trigger workout_templates_updated_at before update on workout_templates
  for each row execute function update_updated_at();
