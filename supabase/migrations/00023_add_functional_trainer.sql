-- The Functional Trainer (dual independent cable columns) has existed in the
-- static equipment catalog with no DB row and no exercises referencing it.
-- Add the equipment row and four dual-column staples the single-pulley Cable
-- Machine doesn't cover. Idempotent, matching migration 00004's pattern.

-- ============================================================
-- NEW EQUIPMENT
-- ============================================================

insert into equipment (id, name, category, muscle_groups, available_at_pf, max_weight, notes)
select 'a0000000-0000-0000-0000-000000000027', 'Functional Trainer', 'cable', '{"chest","back","shoulders","biceps","triceps","core","glutes"}', true, 180.0, 'Dual independent cable columns with full range of motion'
where not exists (select 1 from equipment where name = 'Functional Trainer');

-- ============================================================
-- NEW EXERCISES (idempotent: skip if already present by name)
-- ============================================================

insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Cable Chest Press', 'a0000000-0000-0000-0000-000000000027', '{"chest","triceps","core"}', 'strength', 'intermediate', 'Stand between the columns with a handle in each hand at chest height. Press both forward to full extension, bracing your core, then return under control.', 3, '10-12', true
where not exists (select 1 from exercises where name = 'Cable Chest Press');

insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Single-Arm Cable Row', 'a0000000-0000-0000-0000-000000000027', '{"back","biceps","core"}', 'strength', 'beginner', 'Stand facing a mid-height cable. Row one handle to your hip, keeping shoulders square against the twist. Extend under control. Repeat per side.', 3, '10 each', true
where not exists (select 1 from exercises where name = 'Single-Arm Cable Row');

insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Cable Glute Kickback', 'a0000000-0000-0000-0000-000000000027', '{"glutes","hamstrings"}', 'strength', 'beginner', 'Ankle strap on a low cable. Hinge slightly, drive the strapped leg straight back, squeeze the glute at the top, and return under control. Repeat per side.', 3, '12 each', true
where not exists (select 1 from exercises where name = 'Cable Glute Kickback');

insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Cable Pallof Press', 'a0000000-0000-0000-0000-000000000027', '{"core"}', 'strength', 'beginner', 'Stand side-on to a mid-height cable, handle at your chest. Press straight out and hold, resisting the pull to rotate, then bring it back. Repeat per side.', 3, '10 each', true
where not exists (select 1 from exercises where name = 'Cable Pallof Press');
