-- Oura Ring integration: store OAuth tokens per user
create table oura_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: users can only see/manage their own Oura tokens
alter table oura_tokens enable row level security;

create policy "Users can view own oura tokens"
  on oura_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert own oura tokens"
  on oura_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update own oura tokens"
  on oura_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete own oura tokens"
  on oura_tokens for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at
create trigger update_oura_tokens_updated_at
  before update on oura_tokens
  for each row execute function update_updated_at();
