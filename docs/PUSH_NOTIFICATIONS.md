# Web-push reminders — setup

The in-app reminders (dashboard nudges) work with no setup. **Web-push** —
getting a notification on your phone when the app is closed — needs a few
one-time configuration steps that live outside the codebase.

Until these are done the feature is inert: the Push toggle will fail to
subscribe, and `/api/cron/reminders` returns `VAPID keys not configured`.

## 1. Apply the migration
`00015_push_subscriptions.sql` adds the `push_subscriptions` table and the
`timezone` / `last_push_sent_on` columns on `user_profiles`. Apply it like any
other migration (see `supabase/README.md`).

## 2. Generate VAPID keys
```bash
npx web-push generate-vapid-keys
```
This prints a public and a private key.

## 3. Set environment variables (Vercel → Project → Settings → Environment Variables)
| Variable | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the VAPID **public** key | exposed to the browser |
| `VAPID_PRIVATE_KEY` | the VAPID **private** key | secret |
| `VAPID_SUBJECT` | `mailto:you@example.com` | contact for the push service |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | secret; bypasses RLS, cron-only |
| `CRON_SECRET` | any random string | Vercel sends it to the cron as a Bearer token |

Redeploy after setting these so the new env is picked up.

## 4. The cron
`vercel.json` already registers the hourly schedule:
```json
{ "crons": [ { "path": "/api/cron/reminders", "schedule": "0 * * * *" } ] }
```
Vercel runs it automatically on a Pro plan (Hobby allows a smaller number of
daily cron invocations — check your plan's limits). It authenticates with
`CRON_SECRET`.

## 5. Enable it in the app
Profile → **Reminders → Push notifications**. This registers the service
worker (`public/sw.js`), asks for permission, subscribes, and stores your
browser's timezone.

## iOS note
Safari only delivers web-push to **installed** PWAs (iOS 16.4+). Add the app
to your Home Screen and open it from that icon first, or the toggle won't be
available.

## How it decides what to send
The cron runs hourly in UTC. For each user with a subscription it converts to
their local time, rebuilds the same reminder context the dashboard uses
(`computeReminders`), and — respecting the master switch, per-category
toggles, and quiet hours — sends **at most one** push per local day
(`last_push_sent_on` guards against repeats). Dead subscriptions (HTTP
404/410 from the push service) are pruned automatically.
