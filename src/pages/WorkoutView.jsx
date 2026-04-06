import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { calculateOneRepMax } from '../lib/1rm';
import { Save, Plus, ArrowLeft, Copy, Check } from 'lucide-react';
import SearchableDropdown from '../components/SearchableDropdown';

export default function WorkoutView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [isOwner, setIsOwner] = useState(true);
  
  // Master config exercise list
  const [globalExercises, setGlobalExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);

  const saveActionRef = useRef(null);
  const hasUnsavedRef = useRef(false);

  // We'll manage batch form open state with a simple object dictionary tracking by exIndex
  const [batchForms, setBatchForms] = useState({});

  useEffect(() => {
    fetchGlobalConfig();
    fetchWorkout();

    // 1. Intercept tab close or browser reload
    const handleBeforeUnload = (e) => {
      if (hasUnsavedRef.current) {
        e.preventDefault();
        e.returnValue = ''; // Modern browsers show a generic "Unsaved changes" warning
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // 2. Intercept native Browser Back (or Phone Swipe Back) gestures
    window.history.pushState({ locked: true }, '');
    const handlePopState = (e) => {
      if (hasUnsavedRef.current) {
        // Trigger our custom modal
        setShowExitModal(true);
        // Re-push a state to keep them trapped here until they use our modal buttons
        window.history.pushState({ locked: true }, '');
      } else {
        navigate('/dashboard', {replace: true});
      }
    };
    window.addEventListener('popstate', handlePopState);
    
    // 3. Intercept screen turning off / app backgrounding
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && saveActionRef.current) {
        saveActionRef.current(true); // pass silence flag
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [id]);

  const fetchGlobalConfig = async () => {
    const { data } = await supabase.from('config').select('value').eq('id', 'exercise_list').single();
    if (data) setGlobalExercises(data.value);
  };

  const fetchWorkout = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('workouts')
      .select('*, weeks(profile_id), workout_exercises(*, sets(*))')
      .eq('id', id)
      .single();

    if (data) {
      const sessionStr = localStorage.getItem('workout_profile');
      const sessionProfile = sessionStr ? JSON.parse(sessionStr) : null;
      if (sessionProfile && data.weeks?.profile_id) {
        setIsOwner(sessionProfile.id === data.weeks.profile_id);
      }
      
      setWorkout(data);
      // Sort sets by creation date or id locally to maintain order
      const sortedEx = data.workout_exercises.map(ex => {
        return {
          ...ex,
          sets: ex.sets.sort((a,b) => a.created_at?.localeCompare(b.created_at) || 0)
        }
      });
      setExercises(sortedEx);
    }
    setLoading(false);
  };

  const updateWorkoutField = async (field, value) => {
    hasUnsavedRef.current = true;
    setWorkout(prev => ({ ...prev, [field]: value }));
    
    // If completed is checked, auto-check all sets
    if (field === 'completed' && value === true) {
      const exList = [...exercises];
      let setsToUpdate = [];
      
      for (let exIndex = 0; exIndex < exList.length; exIndex++) {
        for (let setIndex = 0; setIndex < exList[exIndex].sets.length; setIndex++) {
          const setObj = exList[exIndex].sets[setIndex];
          if (!setObj.completed) {
            setObj.completed = true;
            
            const repNum = parseInt(setObj.reps) || 0;
            const weightNum = parseFloat(setObj.weight) || 0;
            const rpeStr = setObj.rpe || "0";
            setObj.calculated_1rm = calculateOneRepMax(weightNum, repNum, rpeStr);
            
            setsToUpdate.push(setObj);
          }
        }
      }
      
      setExercises(exList);
      
      // Batch update the db for all these sets
      for (const s of setsToUpdate) {
        await supabase.from('sets').update({ completed: true, calculated_1rm: s.calculated_1rm }).eq('id', s.id);
      }
    }
  };

  const addExerciseBlock = async () => {
    const name = globalExercises[0] || 'Unknown';
    const { data } = await supabase.from('workout_exercises').insert([{ workout_id: workout.id, exercise_name: name }]).select();
    if(data) {
      setExercises([...exercises, { ...data[0], sets: [] }]);
    }
  };

  const updateExerciseName = async (exIndex, name) => {
    const exList = [...exercises];
    exList[exIndex].exercise_name = name;
    setExercises(exList);
    // Silent update
    await supabase.from('workout_exercises').update({ exercise_name: name }).eq('id', exList[exIndex].id);
  };

  const addSet = async (exIndex) => {
    const exList = [...exercises];
    const exerciseId = exList[exIndex].id;
    const { data } = await supabase.from('sets').insert([{ 
      workout_exercise_id: exerciseId,
      reps: 0, weight: 0, rpe: '8'
    }]).select();
    
    if(data) {
      exList[exIndex].sets.push(data[0]);
      setExercises(exList);
    }
  };

  const duplicateSet = async (exIndex, setIndex) => {
    const exList = [...exercises];
    const setObj = exList[exIndex].sets[setIndex];
    
    const { data } = await supabase.from('sets').insert([{ 
      workout_exercise_id: setObj.workout_exercise_id,
      reps: setObj.reps, weight: setObj.weight, rpe: setObj.rpe,
      completed: setObj.completed,
      calculated_1rm: setObj.calculated_1rm
    }]).select();
    
    if(data) {
      exList[exIndex].sets.splice(setIndex + 1, 0, data[0]);
      setExercises(exList);
    }
  };

  const removeSet = async (exIndex, setIndex, setId) => {
    const exList = [...exercises];
    exList[exIndex].sets.splice(setIndex, 1);
    setExercises(exList);
    await supabase.from('sets').delete().eq('id', setId);
  };

  const updateSetField = async (exIndex, setIndex, field, value) => {
    const exList = [...exercises];
    const setObj = exList[exIndex].sets[setIndex];
    setObj[field] = value;
    
    let rm = setObj.calculated_1rm;
    if (field === 'completed') {
      if (value === true) {
        const repNum = parseInt(setObj.reps) || 0;
        const weightNum = parseFloat(setObj.weight) || 0;
        const rpeStr = setObj.rpe || "0";
        rm = calculateOneRepMax(weightNum, repNum, rpeStr);
        setObj.calculated_1rm = rm;
      } else {
        rm = null;
        setObj.calculated_1rm = null;
      }
    } else if (setObj.completed) {
      // live update if checked
      const repNum = parseInt(setObj.reps) || 0;
      const weightNum = parseFloat(setObj.weight) || 0;
      const rpeStr = setObj.rpe || "0";
      rm = calculateOneRepMax(weightNum, repNum, rpeStr);
      setObj.calculated_1rm = rm;
    }

    setExercises(exList);

    // Silent debounce update to Supabase.
    await supabase.from('sets').update({ 
      [field]: value, 
      calculated_1rm: rm 
    }).eq('id', setObj.id);
  };

  const toggleBatchForm = (exIndex) => {
    setBatchForms(prev => ({
      ...prev,
      [exIndex]: !prev[exIndex]
    }));
  };

  const executeBatchAdd = async (exIndex, e) => {
    e.preventDefault();
    const form = e.target;
    const numSets = parseInt(form.bSets.value) || 3;
    const weight = parseFloat(form.bWeight.value) || 0;
    const reps = parseInt(form.bReps.value) || 8;
    const rpe = form.bRpe.value || "8";

    const exList = [...exercises];
    const exerciseId = exList[exIndex].id;
    
    const setsToInsert = Array.from({ length: numSets }).map(() => ({
      workout_exercise_id: exerciseId,
      weight: weight,
      reps: reps, 
      rpe: rpe
    }));

    const { data } = await supabase.from('sets').insert(setsToInsert).select();
    if (data) {
      exList[exIndex].sets.push(...data);
      setExercises(exList);
      toggleBatchForm(exIndex); // close form
    }
  };

  const saveWorkoutDetails = async (silent = false) => {
    await supabase.from('workouts').update({
      date: workout.date,
      state_rating: workout.state_rating,
      trainee_comments: workout.trainee_comments,
      completed: workout.completed
    }).eq('id', workout.id);

    hasUnsavedRef.current = false;
    
    if (silent !== true) {
      alert('Workout properties saved!');
    }
  };

  saveActionRef.current = saveWorkoutDetails;

  const handleBack = () => {
    if (hasUnsavedRef.current) {
      setShowExitModal(true);
    } else {
      navigate(-1);
    }
  };

  if(loading) return <div>Loading...</div>;
  if(!workout) return <div>Workout not found.</div>;

  return (
    <div>
      <button onClick={handleBack} className="btn-secondary flex items-center gap-2 mb-4">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="glass-panel mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-neon-blue">Workout Details</h2>
          <button className="btn-primary" style={{width: 'auto'}} onClick={saveWorkoutDetails}>
            <Save size={16} style={{display:'inline', verticalAlign:'middle'}}/> Save Details
          </button>
        </div>
        
        <div className="flex flex-col gap-4">
          <label className="text-sm text-secondary flex items-center gap-2" style={{cursor: isOwner ? 'pointer' : 'not-allowed'}}>
            <input type="checkbox" disabled={!isOwner} checked={!!workout.completed} onChange={e => updateWorkoutField('completed', e.target.checked)} style={{width: 'auto'}} />
            Workout Completed
          </label>
          
          {workout.completed && (
            <label className="text-sm text-secondary">Date
              <input type="date" disabled={!isOwner} className="mt-1" value={workout.date} onChange={e => updateWorkoutField('date', e.target.value)} />
            </label>
          )}
          <div className="flex flex-col gap-2" style={{opacity: isOwner ? 1 : 0.5, pointerEvents: isOwner ? 'auto' : 'none'}}>
            <span className="text-sm text-secondary">State Rating (1-Terrible to 5-Excellent)</span>
            <div className="flex justify-between gap-2">
              {[1,2,3,4,5].map(v => (
                <button 
                  key={v}
                  type="button"
                  disabled={!isOwner}
                  className={`rpe-btn ${workout.state_rating === v ? 'active' : ''}`}
                  onClick={() => updateWorkoutField('state_rating', v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <label className="text-sm text-secondary">Trainee Comments
            <textarea disabled={!isOwner} className="mt-1" rows="2" value={workout.trainee_comments || ''} onChange={e => updateWorkoutField('trainee_comments', e.target.value)} />
          </label>
        </div>
      </div>

      <h3 className="mb-4">Exercises</h3>
      <div className="flex flex-col gap-6">
        {exercises.map((ex, exIndex) => (
          <div key={ex.id} className="glass-panel p-4" style={{borderColor: 'var(--neon-blue)'}}>
            <SearchableDropdown 
              value={ex.exercise_name} 
              onChange={newVal => updateExerciseName(exIndex, newVal)}
              className="mb-4 font-bold text-lg text-neon bg-transparent border-none"
              buttonStyle={{borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', borderRadius: 0}}
              placeholder="Select an exercise"
              options={[
                {value: ex.exercise_name, label: ex.exercise_name},
                ...globalExercises.filter(g => g !== ex.exercise_name).map(g => ({value: g, label: g}))
              ]}
            />

            <div className="hidden sm:grid set-row text-xs text-secondary px-2 mb-1">
              <span>Weight</span>
              <span>Reps</span>
              <span>RPE</span>
              <span title="Completed" style={{textAlign:'center'}}><Check size={14}/></span>
              <span>Est. 1RM</span>
              <span></span>
              <span></span>
            </div>

            {ex.sets.map((set, setIndex) => (
              <div key={set.id} className="set-row">
                <input 
                  type="number" step="0.5" placeholder="Weight" value={set.weight}
                  onChange={e => updateSetField(exIndex, setIndex, 'weight', e.target.value)}
                />
                <input 
                  type="number" placeholder="Reps" value={set.reps}
                  onChange={e => updateSetField(exIndex, setIndex, 'reps', e.target.value)}
                />
                <select 
                  value={set.rpe || "8"}
                  onChange={e => updateSetField(exIndex, setIndex, 'rpe', e.target.value)}
                >
                  <option value="10">10</option>
                  <option value="9.5">9.5</option>
                  <option value="9">9</option>
                  <option value="8.5">8.5</option>
                  <option value="8">8</option>
                  <option value="7.5">7.5</option>
                  <option value="7">7</option>
                  <option value="6.5">6.5</option>
                  <option value="6">6</option>
                </select>
                
                <input 
                  type="checkbox" 
                  disabled={!isOwner}
                  checked={!!set.completed} 
                  onChange={e => updateSetField(exIndex, setIndex, 'completed', e.target.checked)}
                  style={{width: '20px', height: '20px', cursor: isOwner ? 'pointer' : 'not-allowed', margin: '0 auto'}}
                />

                <div className="p-2 text-center bg-black rounded" style={{color: 'var(--neon-green)', fontWeight:'bold'}}>
                  {set.completed && set.calculated_1rm ? set.calculated_1rm : "-"}
                </div>
                
                <button className="btn-secondary" style={{padding: '0.4rem'}} onClick={() => duplicateSet(exIndex, setIndex)} title="Duplicate Set">
                  <Copy size={16} />
                </button>

                <button className="btn-secondary text-red-500" onClick={() => removeSet(exIndex, setIndex, set.id)} style={{color:'tomato', border: 'none', padding: '0.4rem'}} title="Delete Set">
                  X
                </button>
              </div>
            ))}
            
            {batchForms[exIndex] && (
              <form onSubmit={(e) => executeBatchAdd(exIndex, e)} className="flex flex-col gap-2 mt-4 p-3 bg-black rounded" style={{border: '1px solid var(--border-subtle)'}}>
                <h4 className="text-sm text-neon-blue mb-1">Batch Prescribe Sets</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <label>Sets <input required name="bSets" type="number" min="1" defaultValue="3" /></label>
                  <label>Target Wt <input required name="bWeight" type="number" step="0.5" defaultValue="0" /></label>
                  <label>Target Reps <input required name="bReps" type="number" min="1" defaultValue="8" /></label>
                  <label>Target RPE 
                    <select required name="bRpe" defaultValue="8">
                      <option value="10">10</option>
                      <option value="9.5">9.5</option>
                      <option value="9">9</option>
                      <option value="8.5">8.5</option>
                      <option value="8">8</option>
                      <option value="7.5">7.5</option>
                      <option value="7">7</option>
                      <option value="6.5">6.5</option>
                      <option value="6">6</option>
                    </select>
                  </label>
                </div>
                <div className="flex gap-2 justify-end mt-2">
                  <button type="button" className="btn-secondary text-xs" onClick={() => toggleBatchForm(exIndex)}>Cancel</button>
                  <button type="submit" className="btn-primary text-xs" style={{width: 'auto'}}>Add Batch</button>
                </div>
              </form>
            )}

            <div className="flex gap-2 mt-4">
              <button className="btn-secondary w-full text-sm" onClick={() => addSet(exIndex)}>
                + Add Set
              </button>
              <button className="btn-secondary w-full text-sm flex items-center justify-center border-dashed border-2 py-1" style={{borderStyle:'dashed'}} onClick={() => toggleBatchForm(exIndex)}>
                + Batch Prescribe
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-6 mb-12">
        <button className="btn-primary" style={{width: 'auto'}} onClick={addExerciseBlock}>
          <Plus size={18} style={{display:'inline', verticalAlign:'middle'}} /> Add Exercise
        </button>
        <button className="btn-primary" style={{width: 'auto', background: 'var(--neon-blue)'}} onClick={saveWorkoutDetails}>
          <Save size={18} style={{display:'inline', verticalAlign:'middle'}} /> Save Details
        </button>
      </div>

      {showExitModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 className="text-neon-blue mb-4 text-center">Unsaved Changes</h3>
            <p className="mb-6 text-sm text-secondary text-center">Would you like to save your workout details before leaving?</p>
            <div className="flex flex-col gap-3">
              <button className="btn-primary" onClick={async () => { await saveWorkoutDetails(); setShowExitModal(false); navigate('/dashboard', {replace: true}); }}>Save & Exit</button>
              <button className="btn-secondary" style={{borderColor: 'tomato', color: 'tomato'}} onClick={() => { setShowExitModal(false); navigate('/dashboard', {replace: true}); }}>Exit Without Saving</button>
              <button className="btn-secondary" onClick={() => setShowExitModal(false)}>Cancel & Stay</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
