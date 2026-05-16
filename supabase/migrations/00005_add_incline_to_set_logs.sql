-- Add incline_percent to set_logs for treadmill exercise tracking.
-- Stored as an optional decimal so users can record incline level
-- (e.g. 5.0 = 5%) alongside duration and distance.

alter table set_logs
  add column if not exists incline_percent decimal(4, 1);
