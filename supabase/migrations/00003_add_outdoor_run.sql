-- Add Outdoor Run exercise (no equipment required)
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly)
values ('Outdoor Run', null, '{"quadriceps","hamstrings","calves","glutes"}', 'cardio', 'beginner', 'Run outdoors at a comfortable pace. Great for building endurance.', 1, '20 min', true)
on conflict do nothing;
