-- Schedule-aware weekly plan: how much time is realistically available on a
-- weekday vs a weekend day. With a long commute, weekdays only support short
-- sessions while the weekend carries the longer work, so the planner needs
-- both budgets rather than assuming every day is equal.
alter table user_profiles
  add column weekday_workout_minutes integer not null default 25,
  add column weekend_workout_minutes integer not null default 60;
