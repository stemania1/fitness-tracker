-- Daily movement: steps become durable, and the step goal becomes per-user.
--
-- `oura_daily` previously stored only the sleep/readiness slice, so the step
-- count on the dashboard was a live read with no history behind it — there
-- was no way to show a weekly average, a best day, or whether a low day was
-- unusual. Steps are cheap to carry on the row the sync already upserts.
alter table oura_daily
  add column steps integer,
  add column active_calories integer,
  add column activity_score integer;

comment on column oura_daily.steps is
  'Oura daily_activity step total for the day. Partial for the current day — the sync overwrites it as the ring reports more.';

-- Configurable daily step target.
--
-- 10,000 is a 1960s pedometer marketing number, not a finding; the observed
-- benefit curve flattens well before it. 8,000 is the default because it is a
-- target a member can actually hit on a working day, and a goal that is
-- missed daily stops being read at all.
alter table user_profiles
  add column daily_step_goal integer not null default 8000;
