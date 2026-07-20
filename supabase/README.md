# Supabase — migrations

## Applying migrations (manual)

This project's remote Supabase database is **applied manually**, not through
an automated `db push` in CI or on deploy. When you add a migration under
`supabase/migrations/`, it does **not** reach the remote database until you
apply it yourself. The app will surface a
`Could not find the table 'public.<name>' in the schema cache` error at
runtime until the migration is applied.

Pick one of:

### Option A — SQL Editor (quickest)
1. Open the Supabase dashboard for the fitness-tracker project.
2. **SQL Editor → New query**, paste the contents of the new migration file,
   and **Run**.
3. If the app still can't see the table right after, the PostgREST schema
   cache is stale — run `NOTIFY pgrst, 'reload schema';` or wait a minute.

### Option B — Supabase CLI
```bash
npx supabase link --project-ref <fitness-tracker-project-ref>
npx supabase db push
```

> Note: the fitness-tracker Supabase project lives in a separate
> account/organization, so tooling connected to other projects (e.g. an MCP
> integration) can't apply these for you — run them against this project
> directly.

## Conventions
See `CLAUDE.md → Database Conventions`. In short: `snake_case` plural table
names; every table has `id` / `created_at` / `updated_at`; user-owned tables
carry a `user_id` referencing `auth.users` with RLS enabled; and an
`update_<table>_updated_at` trigger calling the shared `update_updated_at()`
function keeps `updated_at` current.
