-- Add unassisted Pull-Up exercise (bodyweight, no equipment required).
-- Quick Log can now record strength work, and a plain Pull-Up is distinct
-- from the existing Assisted Pull-Up machine entry.
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
select 'Pull-Up', null, '{"back","biceps"}', 'strength', 'advanced', 'Hang from a bar with an overhand grip and pull your chin above the bar, then lower under control.', 3, '5-8', true
where not exists (select 1 from exercises where name = 'Pull-Up');
