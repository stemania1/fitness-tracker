-- Daily creatine tracker. One row per local day the user took creatine, so a
-- day is "taken" iff a row exists. `taken_on` is the user's local date (the
-- client sends it), and (user_id, taken_on) is unique so logging is idempotent
-- (upsert on conflict).
create table creatine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_on date not null,
  dose_g numeric not null default 5,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, taken_on)
);

create index creatine_logs_user_idx on creatine_logs (user_id, taken_on desc);

alter table creatine_logs enable row level security;

create policy "Users can view own creatine logs"
  on creatine_logs for select using (auth.uid() = user_id);
create policy "Users can insert own creatine logs"
  on creatine_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own creatine logs"
  on creatine_logs for update using (auth.uid() = user_id);
create policy "Users can delete own creatine logs"
  on creatine_logs for delete using (auth.uid() = user_id);

create trigger update_creatine_logs_updated_at
  before update on creatine_logs
  for each row execute function update_updated_at();
