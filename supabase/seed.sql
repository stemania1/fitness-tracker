-- Seed data for fitness tracker app
-- This file populates the equipment and exercises tables with
-- Planet Fitness-friendly gym equipment and exercises.

-- ============================================================
-- EQUIPMENT
-- ============================================================

insert into equipment (id, name, category, muscle_groups, available_at_pf, max_weight, notes) values
  ('a0000000-0000-0000-0000-000000000001', 'Treadmill', 'cardio', '{"quadriceps","hamstrings","calves","glutes"}', true, null, 'Walking, jogging, running, incline walking'),
  ('a0000000-0000-0000-0000-000000000002', 'Elliptical', 'cardio', '{"quadriceps","hamstrings","glutes","chest","back"}', true, null, 'Low-impact full body cardio'),
  ('a0000000-0000-0000-0000-000000000003', 'Stationary Bike', 'cardio', '{"quadriceps","hamstrings","calves","glutes"}', true, null, 'Upright or recumbent'),
  ('a0000000-0000-0000-0000-000000000004', 'Stair Climber', 'cardio', '{"quadriceps","hamstrings","calves","glutes"}', true, null, 'StairMaster style'),
  ('a0000000-0000-0000-0000-000000000005', 'Smith Machine', 'strength_machine', '{"chest","shoulders","quadriceps","hamstrings","glutes"}', true, null, 'Guided barbell on rails'),
  ('a0000000-0000-0000-0000-000000000006', 'Leg Press Machine', 'strength_machine', '{"quadriceps","hamstrings","glutes","calves"}', true, 400.0, null),
  ('a0000000-0000-0000-0000-000000000007', 'Chest Press Machine', 'strength_machine', '{"chest","triceps","shoulders"}', true, 200.0, null),
  ('a0000000-0000-0000-0000-000000000008', 'Shoulder Press Machine', 'strength_machine', '{"shoulders","triceps"}', true, 150.0, null),
  ('a0000000-0000-0000-0000-000000000009', 'Lat Pulldown Machine', 'strength_machine', '{"back","biceps"}', true, 200.0, null),
  ('a0000000-0000-0000-0000-000000000010', 'Seated Row Machine', 'strength_machine', '{"back","biceps","rear_delts"}', true, 200.0, null),
  ('a0000000-0000-0000-0000-000000000011', 'Leg Curl Machine', 'strength_machine', '{"hamstrings"}', true, 150.0, 'Seated or lying'),
  ('a0000000-0000-0000-0000-000000000012', 'Leg Extension Machine', 'strength_machine', '{"quadriceps"}', true, 150.0, null),
  ('a0000000-0000-0000-0000-000000000013', 'Cable Machine', 'cable', '{"chest","back","shoulders","biceps","triceps","core"}', true, 200.0, 'Adjustable pulley system'),
  ('a0000000-0000-0000-0000-000000000014', 'Dumbbells', 'free_weight', '{"chest","back","shoulders","biceps","triceps","core"}', true, 75.0, 'Planet Fitness typically goes up to 75 lbs'),
  ('a0000000-0000-0000-0000-000000000015', 'Ab Crunch Machine', 'strength_machine', '{"core"}', true, 150.0, null),
  ('a0000000-0000-0000-0000-000000000016', 'Pec Fly Machine', 'strength_machine', '{"chest"}', true, 200.0, null),
  ('a0000000-0000-0000-0000-000000000017', 'Hip Abductor Machine', 'strength_machine', '{"glutes","hip_abductors"}', true, 200.0, null),
  ('a0000000-0000-0000-0000-000000000018', 'Hip Adductor Machine', 'strength_machine', '{"hip_adductors"}', true, 200.0, null),
  ('a0000000-0000-0000-0000-000000000019', 'Assisted Pull-Up Machine', 'strength_machine', '{"back","biceps"}', true, null, 'Counterweight assists the movement'),
  ('a0000000-0000-0000-0000-000000000020', 'Rowing Machine', 'cardio', '{"back","shoulders","biceps","quadriceps","core"}', true, null, 'Full body cardio'),
  ('a0000000-0000-0000-0000-000000000021', 'Preacher Curl Machine', 'strength_machine', '{"biceps"}', true, 100.0, null),
  ('a0000000-0000-0000-0000-000000000022', 'Tricep Extension Machine', 'strength_machine', '{"triceps"}', true, 100.0, null),
  ('a0000000-0000-0000-0000-000000000023', 'Calf Raise Machine', 'strength_machine', '{"calves"}', true, 200.0, null),
  ('a0000000-0000-0000-0000-000000000024', 'Bodyweight', 'other', '{"chest","back","core","quadriceps","glutes"}', true, null, 'No equipment needed');

-- ============================================================
-- EXERCISES
-- ============================================================

-- Cardio exercises
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly) values
  ('Treadmill Walk', 'a0000000-0000-0000-0000-000000000001', '{"quadriceps","hamstrings","calves","glutes"}', 'cardio', 'beginner', 'Walk at a moderate pace (3.0-3.5 mph). Use incline for added intensity.', 1, '20 min', true),
  ('Treadmill Jog', 'a0000000-0000-0000-0000-000000000001', '{"quadriceps","hamstrings","calves","glutes"}', 'cardio', 'intermediate', 'Jog at 5.0-6.5 mph. Maintain steady breathing.', 1, '20 min', true),
  ('Treadmill Run', 'a0000000-0000-0000-0000-000000000001', '{"quadriceps","hamstrings","calves","glutes"}', 'cardio', 'advanced', 'Run at 7.0+ mph. Good for interval training.', 1, '20 min', true),
  ('Incline Treadmill Walk', 'a0000000-0000-0000-0000-000000000001', '{"quadriceps","hamstrings","calves","glutes"}', 'cardio', 'beginner', 'Set incline to 10-15%. Walk at 2.5-3.5 mph. Great for glute activation.', 1, '20 min', true),
  ('Elliptical', 'a0000000-0000-0000-0000-000000000002', '{"quadriceps","hamstrings","glutes","chest","back"}', 'cardio', 'beginner', 'Maintain a moderate pace with resistance level 5-8. Use handles for upper body.', 1, '20 min', true),
  ('Stationary Bike', 'a0000000-0000-0000-0000-000000000003', '{"quadriceps","hamstrings","calves","glutes"}', 'cardio', 'beginner', 'Pedal at moderate intensity. Adjust resistance as needed.', 1, '20 min', true),
  ('Stair Climber', 'a0000000-0000-0000-0000-000000000004', '{"quadriceps","hamstrings","calves","glutes"}', 'cardio', 'intermediate', 'Step at a steady pace. Keep posture upright, avoid leaning on rails.', 1, '15 min', true),
  ('Rowing Machine', 'a0000000-0000-0000-0000-000000000020', '{"back","shoulders","biceps","quadriceps","core"}', 'cardio', 'intermediate', 'Drive through legs first, then lean back slightly, then pull arms. Reverse to return.', 1, '15 min', true),
  ('Outdoor Run', null, '{"quadriceps","hamstrings","calves","glutes"}', 'cardio', 'beginner', 'Run outdoors at a comfortable pace. Great for building endurance.', 1, '20 min', true);

-- Chest exercises
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly) values
  ('Chest Press Machine', 'a0000000-0000-0000-0000-000000000007', '{"chest","triceps","shoulders"}', 'strength', 'beginner', 'Sit with back flat against pad. Press handles forward until arms are extended. Slowly return.', 3, '10-12', true),
  ('Pec Fly Machine', 'a0000000-0000-0000-0000-000000000016', '{"chest"}', 'strength', 'beginner', 'Sit with arms out to sides. Bring handles together in front of chest. Slowly return.', 3, '10-12', true),
  ('Dumbbell Bench Press', 'a0000000-0000-0000-0000-000000000014', '{"chest","triceps","shoulders"}', 'strength', 'intermediate', 'Lie on flat bench. Press dumbbells up from chest level. Lower with control.', 3, '8-12', true),
  ('Dumbbell Incline Press', 'a0000000-0000-0000-0000-000000000014', '{"chest","triceps","shoulders"}', 'strength', 'intermediate', 'Set bench to 30-45 degree incline. Press dumbbells up. Lower slowly.', 3, '8-12', true),
  ('Dumbbell Fly', 'a0000000-0000-0000-0000-000000000014', '{"chest"}', 'strength', 'intermediate', 'Lie on bench. Extend arms wide with slight elbow bend. Bring dumbbells together above chest.', 3, '10-12', true),
  ('Smith Machine Bench Press', 'a0000000-0000-0000-0000-000000000005', '{"chest","triceps","shoulders"}', 'strength', 'intermediate', 'Lie on bench under Smith machine. Unrack and lower bar to chest. Press up.', 3, '8-12', true),
  ('Cable Crossover', 'a0000000-0000-0000-0000-000000000013', '{"chest"}', 'strength', 'intermediate', 'Set cables high. Step forward and bring handles together in front of body with slight elbow bend.', 3, '10-12', true),
  ('Push-Ups', 'a0000000-0000-0000-0000-000000000024', '{"chest","triceps","shoulders","core"}', 'strength', 'beginner', 'Hands shoulder-width apart. Lower chest to floor. Push back up. Keep body straight.', 3, '10-15', true);

-- Back exercises
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly) values
  ('Lat Pulldown', 'a0000000-0000-0000-0000-000000000009', '{"back","biceps"}', 'strength', 'beginner', 'Grip bar wide. Pull down to upper chest. Squeeze shoulder blades. Slowly return.', 3, '10-12', true),
  ('Seated Row Machine', 'a0000000-0000-0000-0000-000000000010', '{"back","biceps","rear_delts"}', 'strength', 'beginner', 'Sit upright. Pull handles toward torso. Squeeze shoulder blades together. Slowly return.', 3, '10-12', true),
  ('Assisted Pull-Up', 'a0000000-0000-0000-0000-000000000019', '{"back","biceps"}', 'strength', 'beginner', 'Select counterweight. Grip bar wide. Pull chin above bar. Lower with control.', 3, '8-10', true),
  ('Cable Row', 'a0000000-0000-0000-0000-000000000013', '{"back","biceps","rear_delts"}', 'strength', 'intermediate', 'Sit at cable station. Pull handle to torso. Keep back straight. Squeeze and return.', 3, '10-12', true),
  ('Dumbbell Row', 'a0000000-0000-0000-0000-000000000014', '{"back","biceps"}', 'strength', 'intermediate', 'One knee and hand on bench. Row dumbbell to hip. Keep elbow close. Lower slowly.', 3, '10-12', true),
  ('Cable Face Pull', 'a0000000-0000-0000-0000-000000000013', '{"rear_delts","upper_back","rotator_cuff"}', 'strength', 'intermediate', 'Set cable at face height. Pull rope toward face, separating ends. Squeeze rear delts.', 3, '12-15', true),
  ('Straight Arm Pulldown', 'a0000000-0000-0000-0000-000000000013', '{"back","core"}', 'strength', 'intermediate', 'Stand facing cable set high. Keep arms straight, pull bar down to thighs. Return slowly.', 3, '10-12', true);

-- Shoulder exercises
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly) values
  ('Shoulder Press Machine', 'a0000000-0000-0000-0000-000000000008', '{"shoulders","triceps"}', 'strength', 'beginner', 'Sit with back supported. Press handles overhead. Lower to ear level.', 3, '10-12', true),
  ('Dumbbell Shoulder Press', 'a0000000-0000-0000-0000-000000000014', '{"shoulders","triceps"}', 'strength', 'intermediate', 'Sit or stand. Press dumbbells overhead from shoulder level. Lower with control.', 3, '8-12', true),
  ('Dumbbell Lateral Raise', 'a0000000-0000-0000-0000-000000000014', '{"shoulders"}', 'strength', 'beginner', 'Stand with dumbbells at sides. Raise arms out to sides until parallel with floor. Lower slowly.', 3, '12-15', true),
  ('Dumbbell Front Raise', 'a0000000-0000-0000-0000-000000000014', '{"shoulders"}', 'strength', 'beginner', 'Stand with dumbbells in front of thighs. Raise one or both arms to shoulder height. Lower slowly.', 3, '10-12', true),
  ('Cable Lateral Raise', 'a0000000-0000-0000-0000-000000000013', '{"shoulders"}', 'strength', 'intermediate', 'Stand sideways to cable set low. Raise arm out to side until parallel with floor.', 3, '12-15', true),
  ('Smith Machine Overhead Press', 'a0000000-0000-0000-0000-000000000005', '{"shoulders","triceps"}', 'strength', 'intermediate', 'Sit under Smith machine. Unrack bar from shoulder level. Press overhead. Lower to chin level.', 3, '8-12', true),
  ('Dumbbell Rear Delt Fly', 'a0000000-0000-0000-0000-000000000014', '{"rear_delts","upper_back"}', 'strength', 'intermediate', 'Bend forward at hips. Raise dumbbells out to sides. Squeeze shoulder blades.', 3, '12-15', true);

-- Bicep exercises
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly) values
  ('Preacher Curl Machine', 'a0000000-0000-0000-0000-000000000021', '{"biceps"}', 'strength', 'beginner', 'Sit with arms on pad. Curl weight up. Squeeze at top. Lower slowly.', 3, '10-12', true),
  ('Dumbbell Bicep Curl', 'a0000000-0000-0000-0000-000000000014', '{"biceps"}', 'strength', 'beginner', 'Stand with dumbbells at sides. Curl weights up, rotating palms up. Lower with control.', 3, '10-12', true),
  ('Dumbbell Hammer Curl', 'a0000000-0000-0000-0000-000000000014', '{"biceps","forearms"}', 'strength', 'beginner', 'Stand with palms facing in. Curl weights up maintaining neutral grip. Lower slowly.', 3, '10-12', true),
  ('Cable Bicep Curl', 'a0000000-0000-0000-0000-000000000013', '{"biceps"}', 'strength', 'beginner', 'Stand facing cable set low. Curl bar or rope up. Squeeze at top. Lower slowly.', 3, '10-12', true),
  ('Concentration Curl', 'a0000000-0000-0000-0000-000000000014', '{"biceps"}', 'strength', 'intermediate', 'Sit with elbow braced on inner thigh. Curl dumbbell up. Squeeze. Lower slowly.', 3, '10-12', true);

-- Tricep exercises
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly) values
  ('Tricep Extension Machine', 'a0000000-0000-0000-0000-000000000022', '{"triceps"}', 'strength', 'beginner', 'Sit with arms on pad. Extend arms fully. Squeeze triceps. Return slowly.', 3, '10-12', true),
  ('Cable Tricep Pushdown', 'a0000000-0000-0000-0000-000000000013', '{"triceps"}', 'strength', 'beginner', 'Stand facing cable set high. Push rope or bar down until arms are extended. Return slowly.', 3, '10-12', true),
  ('Dumbbell Overhead Tricep Extension', 'a0000000-0000-0000-0000-000000000014', '{"triceps"}', 'strength', 'intermediate', 'Hold one dumbbell overhead with both hands. Lower behind head. Extend back up.', 3, '10-12', true),
  ('Dumbbell Kickback', 'a0000000-0000-0000-0000-000000000014', '{"triceps"}', 'strength', 'intermediate', 'Bend forward. Keep upper arm parallel to floor. Extend forearm back. Squeeze. Return.', 3, '10-12', true),
  ('Cable Overhead Tricep Extension', 'a0000000-0000-0000-0000-000000000013', '{"triceps"}', 'strength', 'intermediate', 'Face away from cable set low. Extend arms overhead. Keep elbows close to head.', 3, '10-12', true);

-- Leg exercises
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly) values
  ('Leg Press', 'a0000000-0000-0000-0000-000000000006', '{"quadriceps","hamstrings","glutes"}', 'strength', 'beginner', 'Sit in machine with feet shoulder-width on platform. Press up. Lower until knees at 90 degrees.', 3, '10-12', true),
  ('Leg Extension', 'a0000000-0000-0000-0000-000000000012', '{"quadriceps"}', 'strength', 'beginner', 'Sit with shins behind pad. Extend legs until straight. Lower slowly.', 3, '10-12', true),
  ('Leg Curl', 'a0000000-0000-0000-0000-000000000011', '{"hamstrings"}', 'strength', 'beginner', 'Sit or lie with ankles on top of pad. Curl toward glutes. Lower slowly.', 3, '10-12', true),
  ('Smith Machine Squat', 'a0000000-0000-0000-0000-000000000005', '{"quadriceps","hamstrings","glutes","core"}', 'strength', 'intermediate', 'Stand under bar on shoulders. Feet shoulder-width. Squat until thighs parallel. Stand up.', 3, '8-12', true),
  ('Hip Abduction', 'a0000000-0000-0000-0000-000000000017', '{"glutes","hip_abductors"}', 'strength', 'beginner', 'Sit with pads on outer thighs. Push legs apart. Squeeze glutes. Return slowly.', 3, '12-15', true),
  ('Hip Adduction', 'a0000000-0000-0000-0000-000000000018', '{"hip_adductors"}', 'strength', 'beginner', 'Sit with pads on inner thighs. Squeeze legs together. Return slowly.', 3, '12-15', true),
  ('Calf Raise', 'a0000000-0000-0000-0000-000000000023', '{"calves"}', 'strength', 'beginner', 'Stand on platform. Rise onto toes. Squeeze calves at top. Lower slowly.', 3, '15-20', true),
  ('Dumbbell Goblet Squat', 'a0000000-0000-0000-0000-000000000014', '{"quadriceps","hamstrings","glutes","core"}', 'strength', 'beginner', 'Hold dumbbell at chest. Feet shoulder-width. Squat down. Keep chest up. Stand up.', 3, '10-12', true),
  ('Dumbbell Lunges', 'a0000000-0000-0000-0000-000000000014', '{"quadriceps","hamstrings","glutes"}', 'strength', 'intermediate', 'Hold dumbbells at sides. Step forward into lunge. Lower back knee toward floor. Push back up.', 3, '10 each', true),
  ('Dumbbell Romanian Deadlift', 'a0000000-0000-0000-0000-000000000014', '{"hamstrings","glutes","lower_back"}', 'strength', 'intermediate', 'Hold dumbbells in front. Hinge at hips, pushing hips back. Lower until stretch in hamstrings. Stand up.', 3, '10-12', true),
  ('Smith Machine Lunge', 'a0000000-0000-0000-0000-000000000005', '{"quadriceps","hamstrings","glutes"}', 'strength', 'intermediate', 'Bar on shoulders. Step one foot forward. Lower until back knee nearly touches floor. Push up.', 3, '10 each', true);

-- Core exercises
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly) values
  ('Ab Crunch Machine', 'a0000000-0000-0000-0000-000000000015', '{"core"}', 'strength', 'beginner', 'Sit in machine. Crunch forward against resistance. Squeeze abs. Return slowly.', 3, '12-15', true),
  ('Cable Woodchop', 'a0000000-0000-0000-0000-000000000013', '{"core","obliques"}', 'strength', 'intermediate', 'Set cable high. Pull diagonally across body from high to low. Rotate torso. Control the return.', 3, '10-12 each', true),
  ('Cable Crunch', 'a0000000-0000-0000-0000-000000000013', '{"core"}', 'strength', 'intermediate', 'Kneel facing cable set high. Hold rope behind head. Crunch down. Squeeze abs.', 3, '12-15', true),
  ('Plank', 'a0000000-0000-0000-0000-000000000024', '{"core","shoulders"}', 'strength', 'beginner', 'Hold push-up position on forearms. Keep body straight. Engage core. Hold for time.', 3, '30-60 sec', true),
  ('Mountain Climbers', 'a0000000-0000-0000-0000-000000000024', '{"core","shoulders","quadriceps"}', 'cardio', 'intermediate', 'Start in push-up position. Alternate driving knees toward chest rapidly.', 3, '20 each', true),
  ('Bicycle Crunches', 'a0000000-0000-0000-0000-000000000024', '{"core","obliques"}', 'strength', 'beginner', 'Lie on back. Alternate bringing elbow to opposite knee while extending other leg.', 3, '15 each', true),
  ('Dead Bug', 'a0000000-0000-0000-0000-000000000024', '{"core"}', 'strength', 'beginner', 'Lie on back with arms up and knees at 90 degrees. Extend opposite arm and leg. Return. Alternate.', 3, '10 each', true);

-- Flexibility exercises
insert into exercises (name, equipment_id, muscle_groups, exercise_type, difficulty, instructions, default_sets, default_reps, pf_friendly) values
  ('Standing Hamstring Stretch', 'a0000000-0000-0000-0000-000000000024', '{"hamstrings"}', 'flexibility', 'beginner', 'Stand and place one heel on a low surface. Keep leg straight and lean forward until you feel a stretch.', 1, '30 sec each', true),
  ('Quad Stretch', 'a0000000-0000-0000-0000-000000000024', '{"quadriceps"}', 'flexibility', 'beginner', 'Stand on one leg. Pull other foot toward glutes. Hold for stretch. Use wall for balance if needed.', 1, '30 sec each', true),
  ('Hip Flexor Stretch', 'a0000000-0000-0000-0000-000000000024', '{"hip_flexors"}', 'flexibility', 'beginner', 'Kneel on one knee. Push hips forward until stretch is felt in front of hip. Hold.', 1, '30 sec each', true),
  ('Chest Doorway Stretch', 'a0000000-0000-0000-0000-000000000024', '{"chest","shoulders"}', 'flexibility', 'beginner', 'Place forearm on doorframe at 90 degrees. Lean forward until chest stretch is felt. Hold.', 1, '30 sec each', true),
  ('Cat-Cow Stretch', 'a0000000-0000-0000-0000-000000000024', '{"back","core"}', 'flexibility', 'beginner', 'On hands and knees. Alternate between arching back up (cat) and dropping belly down (cow).', 1, '10 reps', true);
