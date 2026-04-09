-- Row-Level Security Policies for PIN-based Authentication

-- Enabling RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;  
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;  
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;  
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;  
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;  
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Default Deny Policy
CREATE POLICY default_deny_policy ON profiles USING (false);
CREATE POLICY default_deny_policy ON weeks USING (false);
CREATE POLICY default_deny_policy ON workouts USING (false);
CREATE POLICY default_deny_policy ON workout_exercises USING (false);
CREATE POLICY default_deny_policy ON sets USING (false);
CREATE POLICY default_deny_policy ON config USING (false);

-- Allow trainers access to their trainees' profiles
CREATE POLICY trainer_access ON profiles  
  FOR SELECT  
  USING (EXISTS (SELECT 1 FROM trainer_trainee tt WHERE tt.trainee_id = id AND tt.trainer_id = current_setting('app.current_user_id')::int));

-- Allow trainees access to their profile
CREATE POLICY trainee_access ON profiles  
  FOR SELECT  
  USING (id = current_setting('app.current_user_id')::int);

-- Allow trainers access to weeks, workouts, workout_exercises, and sets related to their trainees
CREATE POLICY trainer_access_weeks ON weeks  
  FOR SELECT  
  USING (EXISTS (SELECT 1 FROM trainer_trainee tt WHERE tt.trainee_id = weeks.trainee_id AND tt.trainer_id = current_setting('app.current_user_id')::int));

CREATE POLICY trainer_access_workouts ON workouts  
  FOR SELECT  
  USING (EXISTS (SELECT 1 FROM trainer_trainee tt WHERE tt.trainee_id = workouts.trainee_id AND tt.trainer_id = current_setting('app.current_user_id')::int));

CREATE POLICY trainer_access_workout_exercises ON workout_exercises  
  FOR SELECT  
  USING (EXISTS (SELECT 1 FROM trainer_trainee tt WHERE tt.trainee_id = workout_exercises.trainee_id AND tt.trainer_id = current_setting('app.current_user_id')::int));

CREATE POLICY trainer_access_sets ON sets  
  FOR SELECT  
  USING (EXISTS (SELECT 1 FROM trainer_trainee tt WHERE tt.trainee_id = sets.trainee_id AND tt.trainer_id = current_setting('app.current_user_id')::int));

-- Allow trainees access to their related data
CREATE POLICY trainee_access_weeks ON weeks  
  FOR SELECT  
  USING (trainee_id = current_setting('app.current_user_id')::int);

CREATE POLICY trainee_access_workouts ON workouts  
  FOR SELECT  
  USING (trainee_id = current_setting('app.current_user_id')::int);

CREATE POLICY trainee_access_workout_exercises ON workout_exercises  
  FOR SELECT  
  USING (trainee_id = current_setting('app.current_user_id')::int);

CREATE POLICY trainee_access_sets ON sets  
  FOR SELECT  
  USING (trainee_id = current_setting('app.current_user_id')::int);

-- Allow config table access for trainers only
CREATE POLICY trainer_access_config ON config  
  FOR SELECT  
  USING (current_setting('app.current_user_role') = 'trainer');

-- Applying policies
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;  
ALTER TABLE weeks FORCE ROW LEVEL SECURITY;  
ALTER TABLE workouts FORCE ROW LEVEL SECURITY;  
ALTER TABLE workout_exercises FORCE ROW LEVEL SECURITY;  
ALTER TABLE sets FORCE ROW LEVEL SECURITY;  
ALTER TABLE config FORCE ROW LEVEL SECURITY;