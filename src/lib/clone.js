import { supabase } from './supabase';

export const cloneWorkout = async (originalWorkoutId, destWeekId) => {
  // 1. Fetch full workout with exercises and sets
  const { data: cw } = await supabase
    .from('workouts')
    .select('*, workout_exercises(*, sets(*))')
    .eq('id', originalWorkoutId)
    .single();
    
  if (!cw) return null;

  // 2. Insert new workout
  const { data: nw } = await supabase
    .from('workouts')
    .insert([{ 
      week_id: destWeekId, 
      state_rating: cw.state_rating, 
      trainee_comments: cw.trainee_comments, 
      date: cw.date || new Date().toISOString().split('T')[0],
      completed: false // Copied workouts are incomplete by default
    }])
    .select()
    .single();

  if (!nw) return null;
  const newWorkoutId = nw.id;

  // 3. Clone exercises and sets
  if (cw.workout_exercises) {
    for (const ex of cw.workout_exercises) {
      const { data: nx } = await supabase
        .from('workout_exercises')
        .insert([{ 
          workout_id: newWorkoutId, 
          exercise_name: ex.exercise_name, 
          trainer_comments: ex.trainer_comments
        }])
        .select()
        .single();
        
      if (!nx) continue;
      const newExId = nx.id;
      
      if (ex.sets && ex.sets.length > 0) {
         const setsToInsert = ex.sets.map(s => ({
            workout_exercise_id: newExId,
            reps: s.reps, 
            weight: s.weight, 
            rpe: s.rpe, 
            completed: false, // Re-sets completed flag
            calculated_1rm: null 
         }));
         await supabase.from('sets').insert(setsToInsert);
      }
    }
  }

  return nw;
};

export const cloneWeek = async (originalWeekId, profileId) => {
  // 1. Fetch full week recursively
  const { data: w } = await supabase
    .from('weeks')
    .select('*, workouts(*, workout_exercises(*, sets(*)))')
    .eq('id', originalWeekId)
    .single();
    
  if (!w) return null;

  // 2. Insert new week
  const { data: nw } = await supabase
    .from('weeks')
    .insert([{ profile_id: profileId, name: `${w.name} (Copy)` }])
    .select()
    .single();
    
  if (!nw) return null;

  // 3. Recursively copy each workout
  if (w.workouts) {
    for (const workout of w.workouts) {
      // We process inline to avoid too many duplicate nested queries
      const { data: nwkt } = await supabase
        .from('workouts')
        .insert([{ 
          week_id: nw.id, 
          state_rating: workout.state_rating, 
          trainee_comments: workout.trainee_comments, 
          date: workout.date || new Date().toISOString().split('T')[0],
          completed: false
        }])
        .select()
        .single();

      if (!nwkt) continue;

      if (workout.workout_exercises) {
        for (const ex of workout.workout_exercises) {
          const { data: nx } = await supabase
            .from('workout_exercises')
            .insert([{ 
              workout_id: nwkt.id, 
              exercise_name: ex.exercise_name, 
              trainer_comments: ex.trainer_comments
            }])
            .select()
            .single();
            
          if (!nx) continue;
          
          if (ex.sets && ex.sets.length > 0) {
             const setsToInsert = ex.sets.map(s => ({
                workout_exercise_id: nx.id,
                reps: s.reps, 
                weight: s.weight, 
                rpe: s.rpe, 
                completed: false,
                calculated_1rm: null 
             }));
             await supabase.from('sets').insert(setsToInsert);
          }
        }
      }
    }
  }

  return nw;
};
