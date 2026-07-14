-- Estimated glycemic load per meal (carb grams x glycemic index / 100,
-- for the logged portion). A food property, not a body measurement —
-- used for low/medium/high "glucose impact" guidance, never mg/dL.
-- Rows logged before this column existed default to 0 (unknown).
alter table food_logs
  add column glycemic_load integer not null default 0 check (glycemic_load >= 0);
