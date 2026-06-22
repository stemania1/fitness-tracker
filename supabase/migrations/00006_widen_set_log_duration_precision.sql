-- Widen set_logs.duration_mins so sub-minute cardio durations survive a
-- round-trip. decimal(5,1) only resolves to 0.1 min (6 seconds), which means
-- a 10m 45s run (10.75 min) would round to 10.8 and throw off the derived
-- pace. decimal(6,2) gives 0.01 min (0.6 second) resolution, enough to store
-- mm:ss durations exactly.
alter table set_logs
  alter column duration_mins type decimal(6, 2);
