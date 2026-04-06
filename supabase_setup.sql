-- Profiles (Users dropdown)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  pin TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_trainer BOOLEAN DEFAULT false,
  trainer_id UUID REFERENCES profiles(id),
  trainer_status TEXT DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Weeks
CREATE TABLE IF NOT EXISTS weeks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Workouts
CREATE TABLE IF NOT EXISTS workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id UUID REFERENCES weeks(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  state_rating INTEGER CHECK (state_rating >= 1 AND state_rating <= 5),
  trainee_comments TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Workout Exercises
CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  trainer_comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Sets
CREATE TABLE IF NOT EXISTS sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_exercise_id UUID REFERENCES workout_exercises(id) ON DELETE CASCADE,
  reps INTEGER NOT NULL,
  weight NUMERIC NOT NULL,
  rpe TEXT,
  completed BOOLEAN DEFAULT false,
  calculated_1rm NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Config (Global array of strings)
CREATE TABLE IF NOT EXISTS config (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Insert starting exercises
INSERT INTO config (id, value) 
VALUES ('exercise_list', '["Squat", "Bench Press", "Deadlift", "Overhead Press"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
