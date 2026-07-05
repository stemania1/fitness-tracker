# 12-Week Plan: Raise VO2Max + Pull-Up Count

Personal training plan for Curtis. Built around a Mon–Fri 9:00–5:00 work
schedule (America/New_York), Planet Fitness equipment (see
`src/data/equipment.ts`), and Florida summer heat (indoor cardio by default).

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

All gym slots fit before the 9:00 work block (PF is 24 hr — in the door by
6:45, out by 7:45, at the desk by 9:00). Lunch-hour slots are marked as
fallbacks since midday calls sometimes land there.

| Day | Time | Session |
|---|---|---|
| **Mon** | 6:45–7:45 AM | **Pull A** (strength) |
| **Tue** | 6:45–7:30 AM | **VO2Max intervals — 4×4** (treadmill or StairMaster) |
| **Wed** | flexible (lunch walk or 5:30 PM) | **Zone 2, 30–40 min easy** (bike/elliptical) — skippable if life happens |
| **Thu** | 6:45–7:45 AM | **Pull B** (strength) |
| **Fri** | 6:45–7:30 AM | **Short intervals — 30/30s** (bike or treadmill) |
| **Sat** | morning, before the heat | **Long Zone 2, 45–60 min** + optional easy pull volume |
| **Sun** | — | Full rest |

If a morning gets blown up, the session moves to 5:15–6:15 PM the same day —
don't stack two missed sessions into one.

## VO2Max sessions

**Tue — Norwegian 4×4.** 10-min warm-up building to moderate. Then 4 min at
~90–95% max HR (breathing hard, can't speak sentences), 3 min easy recovery.
Weeks 1–2: 3 rounds. Weeks 3–6: 4 rounds. Weeks 8–12: 4–5 rounds, nudging pace
up. Treadmill (speed or incline) or StairMaster both work; rotate to keep it
fresh.

**Fri — 30/30s.** 10-min warm-up, then 30 sec hard / 30 sec easy. Weeks 1–2:
2 sets of 8 reps with 3 min between sets. Build to 3 sets of 10 by week 6.
Stationary bike is ideal (no ballistic pounding the day before a weekend long
session).

**Zone 2 (Wed + Sat).** Conversational pace — you can talk in full sentences.
This is the base that makes the interval days productive; don't turn it into a
tempo run.

**Oura check (already wired into the app):** on interval mornings, if
readiness is in the red, swap the interval session for Zone 2 and slide
intervals to the next day. Don't skip — downshift.

## Pull-up sessions

Uses only PF equipment: assisted pull-up/dip machine, lat pulldown, seated
row, cable crossover, dumbbells. Strict pull-ups are done on the assisted
machine's handles (kneel/stand past the pad) once assistance hits zero.

**Pull A (Mon)**

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
| Assisted pull-ups | 5 × 4–6 | 10–15 lb *less* assistance than Monday (heavier day) |
| Scapular pulls | 3 × 8 | Dead hang, shrug shoulder blades down — no arm bend |
| Single-arm dumbbell row | 3 × 8–10/side | |
| Cable face pull | 3 × 12–15 | Shoulder health insurance for all this pulling |
| Dumbbell farmer hold | 3 × 30 sec | Grip is a common pull-up bottleneck |

**Progression rule:** every week you hit all prescribed reps, reduce
assistance by 5–10 lbs the next week (the app's progressive-overload logic
applies in reverse here — log assistance as the weight and work it *down*).
When assistance reaches 0, switch to bodyweight sets of max-minus-one and
start adding a rep per week.

**Optional accelerator:** a $25 doorway bar at home turns work-from-home days
into "grease the groove" days — one easy set (about half your max, or one slow
negative) a few times a day, never to failure. This is the single fastest
known route from 0–3 pull-ups to 10+.

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

1. Create two workout templates (`Pull A`, `Pull B`) from the exercises above.
2. Log interval days as cardio activity with duration + effort so the calorie
   and volume-trend math stays honest.
3. Set two goals in the goals page: target pull-up reps by week 12, and target
   Cooper-test distance by week 12.
4. Retest weeks: 6 and 12 (replace that week's Friday session with the tests).
