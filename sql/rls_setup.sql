-- Helper function to store current user session
CREATE OR REPLACE FUNCTION set_current_user_session() RETURNS void AS $$
BEGIN
    -- Assuming you're storing the user's PIN in a session variable
    -- Replace 'your_table' with the actual table to store sessions, if needed
    PERFORM set_config('app.current_user_pin', current_setting('app.current_user_pin'), false);
END;
$$ LANGUAGE plpgsql;

-- RLS policy setup for profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_access_policy" ON profiles
    FOR SELECT, INSERT, UPDATE, DELETE
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- RLS policy setup for weeks table
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weeks_access_policy" ON weeks
    FOR SELECT, INSERT, UPDATE, DELETE
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- RLS policy setup for workouts table
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workouts_access_policy" ON workouts
    FOR SELECT, INSERT, UPDATE, DELETE
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- RLS policy setup for workout_exercises table
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workout_exercises_access_policy" ON workout_exercises
    FOR SELECT, INSERT, UPDATE, DELETE
    USING (workout_id IN (SELECT id FROM workouts WHERE user_id = current_setting('app.current_user_id')::uuid));

-- RLS policy setup for sets table
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sets_access_policy" ON sets
    FOR SELECT, INSERT, UPDATE, DELETE
    USING (workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = current_setting('app.current_user_id')::uuid)));

-- Public access for config table
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_public_access_policy" ON config
    FOR SELECT
    USING (true);
