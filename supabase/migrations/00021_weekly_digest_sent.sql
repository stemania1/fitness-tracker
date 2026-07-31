-- De-dupe for the weekly coach digest push.
--
-- The digest cron runs hourly (it has to, so it can catch 18:00 in every
-- timezone) and fires when the user's LOCAL time is Sunday 18:00. Storing the
-- local date it last sent on stops a second send if the hourly job runs twice
-- inside that local hour — which a daylight-saving fall-back makes possible,
-- since 18:00 local occurs twice that day.
alter table user_profiles
  add column last_digest_sent_on date;
