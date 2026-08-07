/**
 * Plain-language "what is this exercise" blurbs, keyed by exercise id. Shown
 * in the logger's "About this exercise" panel so a name like "Seated Row
 * Machine" isn't a mystery. Kept separate from the catalog to avoid bloating
 * every definition; `exerciseDescription()` looks one up.
 */

const DESCRIPTIONS: Record<string, string> = {
  // Chest
  "chest-press-machine-flat":
    "Seated machine press: push the handles straight out from your chest and control them back. Works chest, front shoulders, and triceps.",
  "dumbbell-bench-press":
    "Lie on a flat bench and press two dumbbells from chest height up to straight arms, then lower under control.",
  "dumbbell-incline-press":
    "The same press on a bench set to about 30°, shifting the emphasis to the upper chest and shoulders.",
  "dumbbell-flyes":
    "Lie flat and open your arms wide with a slight elbow bend, then hug the dumbbells back together over your chest.",
  "dumbbell-pullover":
    "Lie on a bench and lower one dumbbell back behind your head with straight-ish arms, then pull it back over your chest.",
  "pec-fly-machine-exercise":
    "Seated machine: bring the padded arms together in front of your chest in a hugging motion, then open slowly.",
  "cable-crossover-exercise":
    "Stand between two high cables and sweep the handles down and together in front of you, squeezing the chest.",
  "cable-chest-press":
    "Stand between the functional trainer's columns and press both handles forward from chest height — like a bench press on your feet, with your core bracing the load.",
  "smith-machine-bench-press":
    "Bench press on the Smith machine's fixed vertical bar — press from chest to lockout on a guided path.",
  // Back
  "lat-pulldown-exercise":
    "Seated, pull a wide overhead bar down to your upper chest, driving your elbows down — builds the lats and biceps.",
  "seated-row-exercise":
    "Sit with your chest against the pad and pull the handles back to your torso, squeezing your shoulder blades together — a horizontal back row.",
  "dumbbell-row":
    "Hinge at the hips with one hand braced, and row a dumbbell up to your hip keeping the elbow close.",
  "cable-row":
    "Seated at a low cable, pull the handle to your stomach and squeeze your back, then extend under control.",
  "single-arm-cable-row":
    "Standing at a mid-height cable, row one handle to your hip while the other side resists the twist — back and biceps, with a core bonus.",
  "cable-glute-kickback":
    "Ankle strapped to a low cable, drive one leg straight back and squeeze the glute at the top, then return under control.",
  "cable-pallof-press":
    "Stand side-on to a mid-height cable and press the handle straight out from your chest, resisting the pull to rotate — an anti-rotation core hold.",
  "straight-arm-pulldown":
    "Standing at a high cable with straight arms, push the bar down to your thighs in an arc — isolates the lats.",
  "dumbbell-shrug":
    "Hold dumbbells at your sides and shrug your shoulders straight up toward your ears, then lower — traps.",
  "assisted-pull-up":
    "A pull-up on a counterweight machine that helps lift you (more weight = more help). Pull your chin over the bar.",
  "pull-up":
    "Hang from a bar and pull your chin over it using your back and arms. Bodyweight — no load to add.",
  "cable-face-pull":
    "Pull a rope from a high cable toward your face with elbows high and wide — rear shoulders and upper back.",
  "reverse-pec-fly":
    "Bent over (or on the reverse machine), raise the dumbbells out to your sides to hit the rear shoulders.",
  // Shoulders
  "shoulder-press-machine-exercise":
    "Seated machine: press the handles overhead from shoulder height, then lower under control.",
  "dumbbell-shoulder-press":
    "Seated or standing, press two dumbbells from shoulder height to overhead.",
  "dumbbell-arnold-press":
    "A shoulder press that starts with palms facing you and rotates to palms-forward as you press overhead.",
  "smith-machine-overhead-press":
    "Overhead press on the Smith machine's guided bar, from shoulders to lockout.",
  "dumbbell-lateral-raise":
    "Raise dumbbells out to your sides up to shoulder height with a slight elbow bend — side delts.",
  "dumbbell-front-raise":
    "Raise dumbbells straight out in front of you to shoulder height — front delts.",
  "cable-lateral-raise":
    "A side raise using a low cable, for constant tension on the side shoulder.",
  // Biceps
  "dumbbell-bicep-curl":
    "Curl dumbbells from your sides up to your shoulders, keeping your elbows pinned.",
  "preacher-curl-machine":
    "Arms braced on the angled pad, curl the handle up — isolates the biceps.",
  "barbell-bicep-curl": "Standing, curl a barbell from your thighs up to your shoulders.",
  "ez-bar-standing-curl":
    "A bicep curl with the angled EZ bar, which is easier on the wrists.",
  "hammer-curl":
    "Curl dumbbells with palms facing each other (neutral grip) — biceps and forearms.",
  "concentration-curl":
    "Seated with your elbow braced on your thigh, curl one dumbbell for a focused bicep squeeze.",
  "dumbbell-reverse-curl":
    "Curl with your palms facing down, targeting the forearms and outer biceps.",
  "cable-bicep-curl": "A bicep curl at a low cable for steady tension throughout.",
  // Triceps
  "cable-tricep-pushdown":
    "Push a high-cable bar or rope down to your thighs, straightening your elbows — triceps.",
  "dumbbell-tricep-overhead":
    "Hold a dumbbell overhead with both hands and lower it behind your head, then extend back up.",
  "dumbbell-skull-crusher":
    "Lying down, lower dumbbells toward your forehead by bending the elbows, then extend — triceps.",
  "assisted-dip":
    "Kickback: hinge forward and extend the dumbbell straight back behind you to work the triceps.",
  "cable-overhead-tricep":
    "Facing away from a cable, extend the rope overhead until your arms are straight — triceps.",
  // Legs
  "leg-press-exercise":
    "Seated, push the sled away with your feet, then bend your knees back to about 90° — quads, hamstrings, glutes.",
  "leg-extension-exercise":
    "Seated, straighten your knees against the pad to isolate the quads.",
  "leg-curl-exercise":
    "Curl the pad toward your glutes by bending your knees — hamstrings.",
  "smith-machine-squat":
    "Squat with the guided Smith bar across your shoulders — sit down to depth and stand back up.",
  "dumbbell-goblet-squat":
    "Hold one dumbbell at your chest and squat down between your legs, chest tall.",
  "dumbbell-lunge":
    "Step forward and lower until both knees are about 90°, then push back up — one leg at a time.",
  "smith-machine-lunge":
    "A lunge with the guided Smith bar on your shoulders for balance support.",
  "bulgarian-split-squat":
    "Rear foot elevated on a bench, lower straight down on the front leg — quads and glutes.",
  "dumbbell-step-up":
    "Step up onto a box with a dumbbell in each hand, driving through the top leg.",
  "dumbbell-romanian-deadlift":
    "Holding dumbbells with soft knees, hinge at the hips and lower to mid-shin — hamstrings and glutes.",
  "hip-abductor-exercise":
    "Seated machine: push your knees outward against the pads — outer glutes.",
  "hip-adductor-exercise":
    "Seated machine: squeeze your knees inward against the pads — inner thighs.",
  "dumbbell-calf-raise":
    "Rise onto the balls of your feet holding dumbbells, then lower your heels — calves.",
  // Core / bodyweight
  "push-ups":
    "Bodyweight: lower your chest to the floor and press back up, keeping your body in a straight line.",
  plank:
    "Bodyweight hold: forearms and toes down, body straight and braced. Time the hold rather than counting reps.",
  "mountain-climbers":
    "From a plank, drive your knees toward your chest one at a time, quickly — core and cardio.",
  "bicycle-crunches":
    "Lying down, bring the opposite elbow to knee in a pedaling motion — obliques and abs.",
  "dead-bug":
    "On your back, extend the opposite arm and leg while keeping your lower back flat — deep core control.",
  "ab-crunch-machine-exercise":
    "Seated machine crunch: curl your torso down against the pad to contract the abs.",
  "cable-woodchop":
    "Pull a cable diagonally across your body (high-to-low or low-to-high) — rotational core.",
  "cable-crunch":
    "Kneel at a high-cable rope and crunch your torso down, rounding toward the floor — abs.",
  // Cardio
  "treadmill-walk": "Steady-paced walking on the treadmill — easy Zone 2 cardio.",
  "treadmill-jog": "An easy jogging pace on the treadmill.",
  "incline-treadmill-walk":
    "Brisk walking on an inclined treadmill to raise the effort without running.",
  "treadmill-run": "Running on the treadmill at a challenging pace.",
  "elliptical-exercise":
    "Low-impact full-body cardio on the elliptical, pushing and pulling the handles.",
  "stairmaster-exercise": "Continuous stair climbing for the legs and cardio.",
  "stationary-bike-exercise": "Seated cycling cardio — easy on the joints.",
  "rowing-exercise":
    "Drive with your legs, then pull the handle to your ribs — full-body cardio.",
  "outdoor-run": "Running outdoors; log your time and distance for pace.",
  // Flexibility
  "standing-calf-stretch":
    "Hands on a wall, back leg straight with the heel down, lean in to stretch the upper calf.",
  "bent-knee-calf-stretch":
    "The same wall stretch but with the back knee bent, targeting the lower calf (soleus).",
  "heel-drop-stretch":
    "Stand on a step and drop one heel below the edge to stretch the calf.",
  "foam-roll-calves": "Roll your calf over a foam roller to loosen the muscle.",
}

/** Look up an exercise's description, or null if we don't have one. */
export function exerciseDescription(id: string): string | null {
  return DESCRIPTIONS[id] ?? null
}
