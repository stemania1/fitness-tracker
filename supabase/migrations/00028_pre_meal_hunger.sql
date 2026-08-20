-- How hungry you were *before* this meal.
--
-- The app currently guesses at fullness. `deriveFuelState` calls you "over"
-- fed if you ate within the last 45 minutes — a clock reading, not a
-- measurement, and one that cannot tell 600 calories of steak from 600
-- calories of pastry.
--
-- Asked at the moment of logging, this rating describes the state at the END
-- of the gap since the previous meal, which makes it a measure of how well
-- that PREVIOUS meal held you. Satiety rated at the moment you finish eating
-- would be meaningless — everyone is full — and a delayed prompt two hours
-- later is a new ritual that would go unanswered. Riding the next meal log
-- costs no new habit and captures exactly the interval that matters.
--
-- 1 still full … 5 ravenous. Nullable throughout: it is optional on the form,
-- and every meal logged before this column existed has no answer. A missing
-- rating must read as "not asked", never as "not hungry".
alter table food_logs
  add column pre_meal_hunger smallint
    check (pre_meal_hunger is null or pre_meal_hunger between 1 and 5);

comment on column food_logs.pre_meal_hunger is
  'Hunger before this meal, 1 (still full) to 5 (ravenous). Rates the interval since the PREVIOUS meal, so it measures that meal''s staying power. Null = not asked.';
