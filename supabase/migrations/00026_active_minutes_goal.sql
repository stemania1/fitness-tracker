-- A daily moderate-or-higher activity goal, alongside the step goal.
--
-- Steps and intensity fail differently. A day spent walking the airport
-- clears 10,000 steps without a minute of real effort; a hard 40-minute
-- session barely moves the step count. Tracking only one of them lets the
-- other rot unnoticed, so the Daily Movement card now carries both targets.
--
-- "Active" here means Oura's medium + high activity time, NOT low. Low
-- activity is standing and ambling — worth charting, but folding it in would
-- let an ordinary desk day clear a 30-minute health target, which is exactly
-- the claim the target exists to make.
alter table oura_daily
  add column active_minutes integer;

comment on column oura_daily.active_minutes is
  'Moderate + high activity minutes (Oura medium_activity_time + high_activity_time). Excludes low activity. Partial for the current day.';

-- 150 minutes of moderate activity a week is the underlying guideline, which
-- is ~22/day — but it is near-universally restated as "30 minutes a day", and
-- a round number is one people actually aim at. 30 also leaves room for the
-- rest days the weekly figure assumes.
alter table user_profiles
  add column daily_active_minutes_goal integer not null default 30;
