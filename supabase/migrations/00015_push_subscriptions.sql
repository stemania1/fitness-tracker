-- Web-push support for reminders.
--
-- push_subscriptions: one row per browser/device the user has granted
-- notification permission on (a user can have several). The scheduled sender
-- pushes to every subscription; a 410/404 from the push service means the
-- subscription is dead and the row is deleted.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "Users can view own push subscriptions"
  on push_subscriptions for select using (auth.uid() = user_id);
create policy "Users can insert own push subscriptions"
  on push_subscriptions for insert with check (auth.uid() = user_id);
create policy "Users can update own push subscriptions"
  on push_subscriptions for update using (auth.uid() = user_id);
create policy "Users can delete own push subscriptions"
  on push_subscriptions for delete using (auth.uid() = user_id);

create trigger update_push_subscriptions_updated_at
  before update on push_subscriptions
  for each row execute function update_updated_at();

-- The reminder cron runs in UTC; it needs each user's IANA timezone to know
-- their local hour (so quiet hours + time-gating match the in-app behavior).
-- last_push_sent_on de-dupes to at most one reminder push per local day.
alter table user_profiles
  add column timezone text,
  add column last_push_sent_on date;
