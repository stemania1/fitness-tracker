-- Sleep-anchored bedtime target: with a fixed wake time (e.g. an early
-- commute), sleep is won at night, not by sleeping in. wake_time is a plain
-- "HH:MM" local time; sleep_goal_hours defaults to 7.5 (the commonly cited
-- adult target) and is editable per user.
alter table user_profiles
  add column wake_time text,
  add column sleep_goal_hours numeric not null default 7.5;
