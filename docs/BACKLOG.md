# Product Backlog — PF Fitness Tracker

Shipped features are documented in the PRD. This backlog tracks what's
still open.

## Motivation layer (in progress)
- [x] Personal-record detection during active workout (heaviest weight)
- [x] Epley 1RM estimate on workout detail
- [x] Progressive overload nudge ("Try +5 lbs") when last session cleared
      the top of the rep range on all sets at the same weight
- [x] Dashboard "Recent PRs" card showing the last 5 weight PRs (30-day window)
- [x] Rep PR detection (most reps ever at a given weight, dashboard card)
- [x] Workouts-per-week streak tracker
- [x] Volume trend chart (weekly total lifted, last 8 weeks)
- [x] Deload week suggestion when 4 consecutive weeks of 5%+ volume climb

## Goal tracking
- [x] Weight goal: target + projected timeline based on actual rate
- [ ] Strength goals: target 1RM per exercise, progress chart
- [ ] Endurance goals: cardio duration / distance targets
- [ ] Milestone celebrations (first workout, 10 workouts, first PR)

## Logging UX
- [x] Quick Log Strength (set-by-set entry of a session you just finished)
- [x] Backdating chips (Today / Yesterday / Earlier…) on both Quick Logs
- [x] Treadmill: time + distance → computed Avg mph + optional incline
- [x] Outdoor Run: time + distance → computed pace (min/mi)
- [x] Incline contributes to calorie estimate at walking speeds
- [x] Edit a saved workout log (sets and notes — not exercise selection)
- [x] Pre-fill new set weights from previous performance
- [x] Rest-timer auto-advances to the next exercise when sets are complete

## Workout builder
- [x] Add Exercise button in template edit mode
- [x] Reorder template exercises (up / down)
- [ ] Drag-and-drop reorder (replace up/down chevrons)
- [x] Swap one exercise for another within a template

## Equipment & exercises
- [x] Free-weight exercise catalog expanded (16 added Apr–May 2026)
- [ ] Reconcile remaining static-vs-DB muscle-group naming
      ("quads" vs "quadriceps", "obliques", etc.)
- [ ] BACKLOG: catalog new equipment we haven't modeled (functional
      trainer was added but unreferenced by any exercise yet)

## Polish & quality
- [ ] Drag-and-drop reorder (replace up/down chevrons in template editor)
- [ ] Accessibility audit (keyboard nav, screen reader, focus states)
- [ ] Performance audit (Core Web Vitals)
- [ ] Component tests for active-workout flow and Quick Log dialogs
- [ ] Offline-capable logging with sync when reconnected (stretch)

## Out of scope (v1, per PRD)
- Social features (sharing, leaderboards)
- Nutrition / diet tracking
- Wearable integration beyond the existing Oura dashboard
- Trainer marketplace
- In-app payments
