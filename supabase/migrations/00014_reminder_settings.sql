-- Reminder preferences: per-user control over the in-app reminder nudges
-- (master switch, per-category toggles, quiet hours). Stored as JSON on the
-- profile; the app reads it through normalizeReminderSettings(), so an empty
-- object safely means "all defaults".
alter table user_profiles
  add column reminder_settings jsonb not null default '{}'::jsonb;
