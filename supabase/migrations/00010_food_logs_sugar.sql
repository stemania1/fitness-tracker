-- Track total sugars per meal. A subset of carbs_g; rows logged before
-- this column existed default to 0 (unknown, not "sugar-free").
alter table food_logs
  add column sugar_g integer not null default 0 check (sugar_g >= 0);
