# 12-Week Plan: Raise VO2Max + Pull-Up Count

Personal training plan for Curtis. Built around the real workday — out the
door at 7:30 AM, home at 7:00 PM (America/New_York) — Planet Fitness
equipment (see `src/data/equipment.ts`), and Florida summer heat (indoor
cardio by default). Weekdays carry only two short sessions; the two longer
sessions live on weekend mornings.

Log everything in the tracker — both goals map cleanly onto features that
already exist: progressive-overload suggestions for the assisted pull-up
machine, PR detection for rep maxes, and Oura readiness insights for deciding
when to push vs. back off interval days.

---

## The two goals, and why they don't conflict

- **VO2Max** responds best to 2 quality cardio sessions/week (one long-interval
  day, one short-interval day) on top of an easy aerobic base. More hard days
  than that mostly adds fatigue, not fitness.
- **Pull-ups** respond best to frequent, non-failure pulling volume — 2–3
  sessions/week of assisted pull-ups, negatives, lat pulldowns, and rows,
  reducing assistance a little each week.
- Interference between the two is minimal as long as hard intervals and heavy
  pulling aren't stacked back-to-back in the same session. The schedule below
  alternates them.

## Week 1 first: baseline tests

Do these before starting the program, log them in the app, and repeat at the
end of weeks 6 and 12.

| Test | Protocol | Log as |
|---|---|---|
| **Cooper 12-min test** | Treadmill, 1% incline, 10-min easy warm-up, then max distance in 12 minutes | Distance → VO2Max estimate: `(meters − 504.9) ÷ 44.73` |
| **Pull-up max** | Dead hang, full range, max strict reps. If 0 reps: max-duration slow negative (jump up, lower for time) | Reps (or negative seconds) |
| **Assisted pull-up 8RM** | Find the assistance weight where 8 clean reps is hard but doable | Assistance weight — this seeds week 1 |

## Weekly template

The workday runs 7:30 AM to 7:00 PM door-to-door, so weekdays get exactly
**two** gym sessions, each ≤45 min, and each has an AM and a PM option (PF is
24 hr). Pick one lane and keep it for at least two weeks:

- **AM lane: 5:45–6:30.** Home by ~6:45, out the door at 7:30. Best for
  consistency — nothing at 6 AM ever gets cancelled by work running late.
- **PM lane: 7:30–8:15** (drop bag, straight to the gym, dinner after).
  Best for performance — you're warmer and fed — but first thing to die when
  you get home wiped.

**Chosen: AM lane.** Tue/Thu 5:45–6:30 AM. A ready-to-import calendar file
with all sessions, baseline/retest weekends, and the deload week lives at
`docs/training-plan-calendar.ics` (Google Calendar → Settings → Import &
export → Import).

| Day | Session | Duration |
|---|---|---|
| **Mon** | Rest (optional: grease-the-groove sets at home) | — |
| **Tue** | **VO2Max intervals — 4×4** (treadmill or StairMaster) | 40 min |
| **Wed** | Rest / optional 20–30 min walk after dinner | — |
| **Thu** | **Pull B** (strength) | 45 min |
| **Fri** | Rest | — |
| **Sat** | 8:00–9:15 AM — **Pull A** + 15–20 min Zone 2 finisher (bike/elliptical) | 75 min |
| **Sun** | 8:00–9:15 AM — **30/30 intervals** + 30 min Zone 2 cool-down | 75 min |

Weekend sessions go early morning — beats the Florida heat and the
post-church/brunch PF rush. If a weekday session dies, move it to the next
rest day; never stack two sessions into one evening.

## VO2Max sessions

**Tue — Norwegian 4×4.** 10-min warm-up building to moderate. Then 4 min at
~90–95% max HR (breathing hard, can't speak sentences), 3 min easy recovery.
Weeks 1–2: 3 rounds. Weeks 3–6: 4 rounds. Weeks 8–12: 4–5 rounds, nudging pace
up. Treadmill (speed or incline) or StairMaster both work; rotate to keep it
fresh.

**Sun — 30/30s.** 10-min warm-up, then 30 sec hard / 30 sec easy. Weeks 1–2:
2 sets of 8 reps with 3 min between sets. Build to 3 sets of 10 by week 6.
Stationary bike is ideal the day after a pull session — no impact, no grip
demand.

**Zone 2 (weekend finishers + optional Wed walk).** Conversational pace — you
can talk in full sentences. This is the base that makes the interval days
productive; don't turn it into a tempo run. It's deliberately attached to the
weekend sessions so it doesn't cost a separate weekday trip.

**Oura check (already wired into the app):** on interval mornings, if
readiness is in the red, swap the interval session for Zone 2 and slide
intervals to the next day. Don't skip — downshift.

## Pull-up sessions

Uses only PF equipment: assisted pull-up/dip machine, lat pulldown, seated
row, cable crossover, dumbbells. Strict pull-ups are done on the assisted
machine's handles (kneel/stand past the pad) once assistance hits zero.

**Pull A (Sat)**

| Exercise | Sets × Reps | Notes |
|---|---|---|
| Assisted pull-ups | 4 × 6–8 | Start at your 8RM assistance; leave 1–2 reps in the tank |
| Slow negatives | 3 × 3–5 | 5-second lowering, full hang at the bottom |
| Lat pulldown | 3 × 8–12 | Progressive overload per the app's +5 lb suggestions |
| Seated row | 3 × 10–12 | |
| Hollow hold | 3 × 20–30 sec | Pull-ups are half core |

**Pull B (Thu)**

| Exercise | Sets × Reps | Notes |
|---|---|---|
| Assisted pull-ups | 5 × 4–6 | 10–15 lb *less* assistance than Saturday (heavier day) |
| Scapular pulls | 3 × 8 | Dead hang, shrug shoulder blades down — no arm bend |
| Single-arm dumbbell row | 3 × 8–10/side | |
| Cable face pull | 3 × 12–15 | Shoulder health insurance for all this pulling |
| Dumbbell farmer hold | 3 × 30 sec | Grip is a common pull-up bottleneck |

**Progression rule:** every week you hit all prescribed reps, reduce
assistance by 5–10 lbs the next week (the app's progressive-overload logic
applies in reverse here — log assistance as the weight and work it *down*).
When assistance reaches 0, switch to bodyweight sets of max-minus-one and
start adding a rep per week.

**Optional accelerator:** a $25 doorway bar at home is the highest-leverage
purchase in this plan given the 11.5-hour workday — "grease the groove": one
easy set (about half your max, or one slow negative) before leaving at 7:30
and one or two after getting home at 7:00, never to failure. It converts the
three weekday rest days into free pull-up volume without a single gym trip,
and it's the fastest known route from 0–3 pull-ups to 10+.

## Deload + milestones

- **Week 7 is a deload:** halve interval rounds, drop one set from every
  pull exercise, keep Zone 2 as-is. Retest nothing; just recover.
- **Realistic 12-week outcomes:** VO2Max +5–10% (more if starting from a low
  base); pull-ups from 0→3–5, from 5→10–12.
- **Body weight is a pull-up multiplier:** every pound lost is a pound less to
  pull. The app's weight projection + calorie logging cover this if a cut is
  on the table — but don't cut hard while chasing VO2Max intervals; a small
  deficit or maintenance is the sweet spot.

## Fitting it into the app

1. Open the **Plan** tab — this whole document lives there as an in-app page,
   with today's session highlighted and a one-tap button that creates the
   `Pull A` / `Pull B` templates. The dashboard also shows a "Today's Plan"
   card with the current week, phase-adjusted prescription, and test-week
   reminders.
2. Log interval days as cardio activity with duration + effort so the calorie
   and volume-trend math stays honest.
3. Set two goals in the goals page: target pull-up reps by week 12, and target
   Cooper-test distance by week 12.
4. Retest weeks: 6 and 12 — pull-up max replaces Saturday's first exercise,
   Cooper test replaces Sunday's intervals.
5. Log every test via **Log test** on the dashboard's VO2 Max Trend card
   (Cooper distance in meters, or strict pull-up reps). The card converts
   Cooper distances to VO2 Max, plots them against Oura's daily estimates,
   and shows your latest pull-up max.
