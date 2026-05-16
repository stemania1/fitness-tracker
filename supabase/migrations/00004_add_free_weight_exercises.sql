-- Add additional free weight equipment and exercises.
-- Expands variety beyond machine-only options so users can log common
-- dumbbell, EZ bar, and fixed-barbell exercises like bicep curls,
-- skull crushers, Bulgarian split squats, etc.

-- ============================================================
-- NEW EQUIPMENT
-- ============================================================

insert into equipment (id, name, category, muscle_groups, available_at_pf, max_weight, notes)
select 'a0000000-0000-0000-0000-000000000025', 'EZ Curl Bar', 'free_weight', '{"biceps","triceps"}', true, 60.0, 'Fixed weight EZ bars in multiple weights'
where not exists (select 1 from equipment where id = 'a0000000-0000-0000-0000-000000000025');

insert into equipment (id, name, category, muscle_groups, available_at_pf, max_weight, notes)
select 'a0000000-0000-0000-0000-000000000026', 'Fixed Barbells', 'free_weight', '{"chest","back","shoulders","biceps","triceps"}', true, 60.0, 'Pre-loaded straight bars, typically 20-60 lbs'
where not exists (select 1 from equipment where id = 'a0000000-0000-0000-0000-000000000026');

-- ============================================================
-- NEW EXERCISES (idempotent: skip if already present by name)
-- ============================================================

-- Chest
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Dumbbell Pullover', 'a0000000-0000-0000-0000-000000000014', '{"chest","back"}', 'strength', 'intermediate', 'Lie across bench with dumbbell held over chest. Lower behind head with slight elbow bend. Pull back over chest.', 3, '10-12', true
where not exists (select 1 from exercises where name = 'Dumbbell Pullover');

-- Back / Shoulders
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Dumbbell Shrug', 'a0000000-0000-0000-0000-000000000014', '{"upper_back","shoulders"}', 'strength', 'beginner', 'Stand with dumbbells at sides. Shrug shoulders straight up toward ears. Hold briefly. Lower slowly.', 3, '12-15', true
where not exists (select 1 from exercises where name = 'Dumbbell Shrug');

-- Shoulders
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Dumbbell Arnold Press', 'a0000000-0000-0000-0000-000000000014', '{"shoulders","triceps"}', 'strength', 'intermediate', 'Start with dumbbells in front of shoulders, palms facing you. Press overhead while rotating palms forward.', 3, '10-12', true
where not exists (select 1 from exercises where name = 'Dumbbell Arnold Press');

-- Biceps
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Barbell Bicep Curl', 'a0000000-0000-0000-0000-000000000026', '{"biceps"}', 'strength', 'beginner', 'Stand holding barbell at thighs with underhand grip. Curl bar to shoulders. Lower with control.', 3, '8-12', true
where not exists (select 1 from exercises where name = 'Barbell Bicep Curl');

insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'EZ Bar Curl', 'a0000000-0000-0000-0000-000000000025', '{"biceps"}', 'strength', 'beginner', 'Stand with EZ bar at thighs, hands on angled grips. Curl bar to shoulders. Lower with control.', 3, '8-12', true
where not exists (select 1 from exercises where name = 'EZ Bar Curl');

insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Dumbbell Reverse Curl', 'a0000000-0000-0000-0000-000000000014', '{"biceps","forearms"}', 'strength', 'intermediate', 'Stand with dumbbells, palms facing down. Curl up keeping wrists straight. Lower slowly.', 3, '10-12', true
where not exists (select 1 from exercises where name = 'Dumbbell Reverse Curl');

-- Triceps
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Dumbbell Skull Crusher', 'a0000000-0000-0000-0000-000000000014', '{"triceps"}', 'strength', 'intermediate', 'Lie on bench holding dumbbells overhead. Bend elbows to lower weights toward head. Extend back up.', 3, '10-12', true
where not exists (select 1 from exercises where name = 'Dumbbell Skull Crusher');

-- Legs
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Bulgarian Split Squat', 'a0000000-0000-0000-0000-000000000014', '{"quadriceps","glutes","hamstrings"}', 'strength', 'intermediate', 'Place rear foot on bench behind you. Hold dumbbells at sides. Lower into lunge. Drive through front heel to stand.', 3, '10 each', true
where not exists (select 1 from exercises where name = 'Bulgarian Split Squat');

insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Dumbbell Step-Up', 'a0000000-0000-0000-0000-000000000014', '{"quadriceps","glutes"}', 'strength', 'intermediate', 'Hold dumbbells at sides. Step one foot onto bench or platform. Drive up through heel. Step down with control.', 3, '10 each', true
where not exists (select 1 from exercises where name = 'Dumbbell Step-Up');
