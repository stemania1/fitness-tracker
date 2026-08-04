-- Caffeine that came from a logged meal or drink.
--
-- A 32 oz Dr Pepper is ~110mg — about a cup of coffee — and before this the
-- only way it reached the caffeine tracker was logging the same drink twice,
-- once as a meal and once as a drink. Snapping the meal now offers to log the
-- caffeine with it.
--
-- The FK is what keeps the two rows from drifting: deleting the meal takes
-- its caffeine with it, and rescaling the portion rescales the dose. Null for
-- a drink logged on its own through Log Caffeine, which is still the common
-- case.
alter table caffeine_logs
  add column source_food_log_id uuid
    references food_logs(id) on delete cascade;

-- Supports the reverse lookup ("what caffeine came from this meal?") that the
-- nutrition card does when rescaling or repeating a meal.
create index caffeine_logs_source_food_idx
  on caffeine_logs (source_food_log_id)
  where source_food_log_id is not null;

comment on column caffeine_logs.source_food_log_id is
  'The food_log this dose came from, when it was logged as part of a meal. Cascades on delete so the two stay in step.';
