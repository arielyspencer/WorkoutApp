-- Row-Level Security (RLS) Policies for WorkoutApp

-- Enable RLS on the desired tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts_history ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see their own data
CREATE POLICY user_see_own_data ON users
    FOR SELECT USING (id = current_user_id());

CREATE POLICY user_see_own_workouts ON workouts
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY user_see_own_workouts_history ON workouts_history
    FOR SELECT USING (user_id = current_user_id());

-- Policy to allow users to insert their own data
CREATE POLICY user_insert_own_data ON users
    FOR INSERT WITH CHECK (id = current_user_id());

CREATE POLICY user_insert_own_workouts ON workouts
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY user_insert_own_workouts_history ON workouts_history
    FOR INSERT WITH CHECK (user_id = current_user_id());

-- Allow admin users to complete actions on all rows
CREATE POLICY admin_access ON users
    FOR ALL TO admin_role;  

CREATE POLICY admin_workouts_access ON workouts
    FOR ALL TO admin_role;  

CREATE POLICY admin_workouts_history_access ON workouts_history
    FOR ALL TO admin_role;  

-- Ensure policies are applied
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE workouts FORCE ROW LEVEL SECURITY;
ALTER TABLE workouts_history FORCE ROW LEVEL SECURITY;