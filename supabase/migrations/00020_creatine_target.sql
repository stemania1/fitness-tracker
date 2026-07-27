-- Configurable daily creatine target. 5 g/day is the classic maintenance dose,
-- but some protocols (and higher body weights) call for ~10 g, often split
-- across the day — so the target is per-user and the card tracks the running
-- daily total against it rather than a single all-or-nothing dose.
alter table user_profiles
  add column creatine_target_g numeric not null default 5;
