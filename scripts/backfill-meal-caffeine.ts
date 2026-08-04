/**
 * One-off backfill: caffeine for meals logged before Snap Meal offered it.
 *
 * Every drink already in `food_logs` contributes zero milligrams today, so a
 * 32 oz Dr Pepper logged last month is invisible to the energy read, the
 * crash window, and the late-caffeine sleep warning. This walks the history
 * and inserts the linked `caffeine_logs` row that would exist had the meal
 * been logged today.
 *
 * The rules for what gets a row — recognized drinks only, no double-counting
 * a hand-logged drink, portion prefixes respected, re-runs safe — live in
 * `src/lib/caffeine-backfill.ts` where they are unit tested. This file is the
 * I/O shell around them.
 *
 * Dry run by default: it prints every insert it would make and every skip
 * with its reason, and writes nothing until you pass --apply.
 *
 * Usage (Node 22+, no build step — types are stripped at runtime):
 *
 *   node --experimental-strip-types --env-file=.env.local \
 *     scripts/backfill-meal-caffeine.ts
 *
 *   node --experimental-strip-types --env-file=.env.local \
 *     scripts/backfill-meal-caffeine.ts --apply
 *
 * Optional flags:
 *   --user=<uuid>   restrict to one user (default: every user)
 *   --since=<date>  only meals logged on/after an ISO date (default: all)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — it uses the
 * service role to read and write across users, so run it locally against the
 * project, never from user-facing code.
 */

import { createClient } from "@supabase/supabase-js"
import {
  planCaffeineBackfill,
  backfillRows,
  type BackfillMeal,
  type BackfillDose,
} from "../src/lib/caffeine-backfill.ts"

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit?.slice(name.length + 3)
}

function fail(message: string): never {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

const apply = process.argv.includes("--apply")
const onlyUser = arg("user")
const since = arg("since")

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "  Run with --env-file=.env.local, or export them first."
  )
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Every meal in scope, oldest first. */
async function loadMeals(): Promise<BackfillMeal[]> {
  let query = supabase
    .from("food_logs")
    .select("id, user_id, description, logged_at")
    .order("logged_at", { ascending: true })
  if (onlyUser) query = query.eq("user_id", onlyUser)
  if (since) query = query.gte("logged_at", since)

  const { data, error } = await query
  if (error) fail(`Could not read food_logs: ${error.message}`)
  return (data ?? []) as BackfillMeal[]
}

/** Every caffeine log in scope — both linked and hand-logged. */
async function loadCaffeine(): Promise<BackfillDose[]> {
  let query = supabase
    .from("caffeine_logs")
    .select("user_id, mg, logged_at, source_food_log_id")
  if (onlyUser) query = query.eq("user_id", onlyUser)

  const { data, error } = await query
  if (error) {
    // The most likely cause by far, and the fix is one migration away.
    if (/source_food_log_id/.test(error.message)) {
      fail(
        "caffeine_logs has no source_food_log_id column — apply migration\n" +
          "  00022_caffeine_from_food.sql before running this backfill."
      )
    }
    fail(`Could not read caffeine_logs: ${error.message}`)
  }
  return (data ?? []) as BackfillDose[]
}

async function main(): Promise<void> {
  const [meals, existing] = await Promise.all([loadMeals(), loadCaffeine()])
  const { planned, skipped } = planCaffeineBackfill(meals, existing)

  console.log(
    `\n  ${meals.length} meals scanned · ${planned.length} to backfill · ${skipped.length} skipped\n`
  )

  for (const p of planned) {
    const when = new Date(p.meal.logged_at).toLocaleString()
    console.log(
      `  + ${String(p.mg).padStart(4)}mg  ${when}  ${p.meal.description}  (${p.label})`
    )
  }

  if (skipped.length > 0) {
    console.log("")
    for (const s of skipped) {
      const when = new Date(s.meal.logged_at).toLocaleString()
      console.log(`  · skip     ${when}  ${s.meal.description} — ${s.reason}`)
    }
  }

  const total = planned.reduce((sum, p) => sum + p.mg, 0)
  console.log(`\n  ${total}mg across ${planned.length} rows.`)

  if (!apply) {
    console.log("\n  Dry run — nothing written. Re-run with --apply.\n")
    return
  }
  if (planned.length === 0) {
    console.log("\n  Nothing to write.\n")
    return
  }

  const rows = backfillRows(planned)
  const { error } = await supabase.from("caffeine_logs").insert(rows)
  if (error) fail(`Insert failed — nothing was written: ${error.message}`)

  console.log(`\n  Wrote ${rows.length} caffeine logs.\n`)
}

main().catch((err) => fail(String(err)))
