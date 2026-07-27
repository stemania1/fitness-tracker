-- Stored Oura daily history (sleep + readiness). The rest of the Oura summary
-- is fetched live and not persisted; this durable slice lets sleep/readiness
-- join the energy correlations and power long-term trends. `day` is the Oura
-- wake-up day; (user_id, day) is unique so the backfill sync is idempotent.
create table oura_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  sleep_score integer,
  sleep_minutes integer,
  readiness_score integer,
  average_hrv numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, day)
);

create index oura_daily_user_idx on oura_daily (user_id, day desc);

alter table oura_daily enable row level security;

create policy "Users can view own oura daily"
  on oura_daily for select using (auth.uid() = user_id);
create policy "Users can insert own oura daily"
  on oura_daily for insert with check (auth.uid() = user_id);
create policy "Users can update own oura daily"
  on oura_daily for update using (auth.uid() = user_id);
create policy "Users can delete own oura daily"
  on oura_daily for delete using (auth.uid() = user_id);

create trigger update_oura_daily_updated_at
  before update on oura_daily
  for each row execute function update_updated_at();
