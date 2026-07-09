-- Photo-based food logging: an estimate (calories + macros) per meal, from a
-- photo analyzed by Claude vision (/api/estimate-food). Values are the
-- user-confirmed numbers, which may differ from the model's raw estimate.
create table food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Free-text description of the meal (from the model, user-editable).
  description text not null,
  meal_type text not null default 'meal'
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'meal')),
  calories integer not null check (calories >= 0),
  protein_g integer not null default 0 check (protein_g >= 0),
  carbs_g integer not null default 0 check (carbs_g >= 0),
  fat_g integer not null default 0 check (fat_g >= 0),
  -- Storage path in the meal-photos bucket, when the user kept the photo.
  image_path text,
  -- The model's own confidence in the estimate: low | medium | high.
  confidence text check (confidence in ('low', 'medium', 'high')),
  -- True when the user changed the numbers before saving.
  edited boolean not null default false,
  logged_at timestamptz not null default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index food_logs_user_logged_idx on food_logs (user_id, logged_at);

alter table food_logs enable row level security;

create policy "Users can view own food logs"
  on food_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own food logs"
  on food_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own food logs"
  on food_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own food logs"
  on food_logs for delete
  using (auth.uid() = user_id);

create trigger update_food_logs_updated_at
  before update on food_logs
  for each row execute function update_updated_at();

-- ── Meal photo storage ──────────────────────────────────────────────
-- Private bucket; users may only touch objects under a folder named for
-- their own user id (path convention: "<user_id>/<uuid>.jpg").
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

create policy "Users can read own meal photos"
  on storage.objects for select
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload own meal photos"
  on storage.objects for insert
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own meal photos"
  on storage.objects for delete
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
