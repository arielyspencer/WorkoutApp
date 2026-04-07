import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { calculateOneRepMax } from '../lib/1rm';
import { Save, Plus, ArrowLeft, Copy, Check, X, Eye, EyeOff } from 'lucide-react';
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

  const [batchForms, setBatchForms] = useState({});
  // Coach notes collapsed/expanded state per exercise
  const [notesOpen, setNotesOpen] = useState({});
  // Custom delete modal state: null | { type: 'set', exIndex, setIndex, setId }
  const [pendingDelete, setPendingDelete] = useState(null);

  // Read the logged-in profile to determine coach vs athlete
  const sessionProfile = JSON.parse(localStorage.getItem('workout_profile') || 'null');
  const isCoach = sessionProfile?.is_trainer || sessionProfile?.username?.toLowerCase() === 'admin';

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
    hasUnsavedRef.current = true;
    const name = globalExercises[0] || 'Unknown';
    const { data } = await supabase.from('workout_exercises').insert([{ workout_id: workout.id, exercise_name: name }]).select();
    if(data) {
      setExercises([...exercises, { ...data[0], sets: [] }]);
    }
  };

  const updateExerciseName = async (exIndex, name) => {
    hasUnsavedRef.current = true;
    const exList = [...exercises];
    exList[exIndex].exercise_name = name;
    setExercises(exList);
    // Silent update
    await supabase.from('workout_exercises').update({ exercise_name: name }).eq('id', exList[exIndex].id);
  };

  const addSet = async (exIndex) => {
    hasUnsavedRef.current = true;
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
    hasUnsavedRef.current = true;
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

  const removeSet = (exIndex, setIndex, setId) => {
    // Open the custom delete modal instead of window.confirm
    setPendingDelete({ exIndex, setIndex, setId });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { exIndex, setIndex, setId } = pendingDelete;
    hasUnsavedRef.current = true;
    const exList = [...exercises];
    exList[exIndex].sets.splice(setIndex, 1);
    setExercises(exList);
    await supabase.from('sets').delete().eq('id', setId);
    setPendingDelete(null);
  };

  const updateCoachNote = async (exIndex, note) => {
    hasUnsavedRef.current = true;
    const exList = [...exercises];
    exList[exIndex] = { ...exList[exIndex], coach_notes: note };
    setExercises(exList);
    // Persist immediately to workout_exercises table
    await supabase.from('workout_exercises')
      .update({ coach_notes: note })
      .eq('id', exList[exIndex].id);
  };

  const updateSetField = async (exIndex, setIndex, field, value) => {
    hasUnsavedRef.current = true;
    const exList = [...exercises];
    // Shallow-clone the set so React always sees a new reference → instant re-render
    const setObj = { ...exList[exIndex].sets[setIndex] };
    setObj[field] = value;
    exList[exIndex] = { ...exList[exIndex], sets: [...exList[exIndex].sets] };
    exList[exIndex].sets[setIndex] = setObj;
    
    let rm = setObj.calculated_1rm;
    if (field === 'completed') {
      if (value === true) {
        const repNum = parseInt(setObj.reps) || 0;
        const weightNum = parseFloat(setObj.weight) || 0;
        const rpeStr = setObj.rpe || "0";
        rm = calculateOneRepMax(weightNum, repNum, rpeStr);
        exList[exIndex].sets[setIndex].calculated_1rm = rm;
      } else {
        rm = null;
        exList[exIndex].sets[setIndex].calculated_1rm = null;
      }
    } else if (setObj.completed) {
      const repNum = parseInt(setObj.reps) || 0;
      const weightNum = parseFloat(setObj.weight) || 0;
      const rpeStr = setObj.rpe || "0";
      rm = calculateOneRepMax(weightNum, repNum, rpeStr);
      exList[exIndex].sets[setIndex].calculated_1rm = rm;
    }

    setExercises(exList);

    // Silent update to Supabase.
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <h3 className="mb-4">Exercises</h3>
      <div className="flex flex-col gap-6" style={{ flex: 1 }}>
        {exercises.map((ex, exIndex) => (
          <div key={ex.id} className="glass-panel p-4" style={{borderColor: 'var(--neon-blue)'}}>
            <select 
              value={ex.exercise_name} 
              onChange={e => updateExerciseName(exIndex, e.target.value)}
              className="mb-4 font-bold text-lg text-neon bg-transparent w-full"
              style={{ border: 'none', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', borderRadius: 0, outline: 'none' }}
            >
              {[
                {value: ex.exercise_name, label: ex.exercise_name},
                ...globalExercises.filter(g => g !== ex.exercise_name).map(g => ({value: g, label: g}))
              ].map(opt => (
                <option key={opt.value} value={opt.value} style={{background: '#0a0a0a', color: 'var(--neon-blue)'}}>{opt.label}</option>
              ))}
            </select>

            {/* Coach's Note */}
            <div className="coach-note-section">
              <button
                type="button"
                className="coach-note-toggle"
                onClick={() => setNotesOpen(prev => ({ ...prev, [exIndex]: !prev[exIndex] }))}
              >
                {notesOpen[exIndex] ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>Coach's Note</span>
                {ex.coach_notes && !notesOpen[exIndex] && (
                  <span className="coach-note-dot" />
                )}
              </button>
              {notesOpen[exIndex] && (
                isCoach ? (
                  <textarea
                    className="coach-note-textarea"
                    rows={3}
                    placeholder="Add a coaching note for this exercise…"
                    value={ex.coach_notes || ''}
                    onChange={e => updateCoachNote(exIndex, e.target.value)}
                  />
                ) : (
                  ex.coach_notes ? (
                    <div className="coach-note-readonly">{ex.coach_notes}</div>
                  ) : (
                    <div className="coach-note-readonly" style={{opacity: 0.4, fontStyle: 'italic'}}>No coach note for this exercise.</div>
                  )
                )
              )}
            </div>

            {/* Set Cards */}
            <div className="set-cards-container">
              {ex.sets.map((set, setIndex) => (
                <div key={set.id} className="set-card">

                  {/* Card Header */}
                  <div className="set-card-header">
                    <span className="set-card-label">Set {setIndex + 1}</span>
                  </div>

                  {/* Row 1: Weight | Reps | RPE */}
                  <div className="set-card-row1">
                    <div className="set-field">
                      <span className="set-field-label">Weight</span>
                      <input
                        type="number" step="0.5"
                        className="set-input"
                        value={set.weight}
                        placeholder="0"
                        onFocus={e => { if (parseFloat(e.target.value) === 0) e.target.value = ''; }}
                        onBlur={e => { if (e.target.value === '') updateSetField(exIndex, setIndex, 'weight', 0); }}
                        onChange={e => updateSetField(exIndex, setIndex, 'weight', e.target.value)}
                      />
                    </div>
                    <div className="set-field">
                      <span className="set-field-label">Reps</span>
                      <input
                        type="number"
                        className="set-input"
                        value={set.reps}
                        placeholder="0"
                        onFocus={e => { if (parseInt(e.target.value) === 0) e.target.value = ''; }}
                        onBlur={e => { if (e.target.value === '') updateSetField(exIndex, setIndex, 'reps', 0); }}
                        onChange={e => updateSetField(exIndex, setIndex, 'reps', e.target.value)}
                      />
                    </div>
                    <div className="set-field">
                      <span className="set-field-label">RPE</span>
                      <select
                        className="set-input rpe-select"
                        value={set.rpe || '8'}
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
                    </div>
                  </div>

                  {/* Row 2: Est. 1RM | Done */}
                  <div className="set-card-row2">
                    <div className="set-field">
                      <span className="set-field-label">Est. 1RM</span>
                      <div className="set-1rm-display">
                        {set.completed && set.calculated_1rm ? set.calculated_1rm : '—'}
                      </div>
                    </div>
                    <div className="set-field set-field-check">
                      <span className="set-field-label">Done</span>
                      <button
                        type="button"
                        disabled={!isOwner}
                        className={`set-check-btn${set.completed ? ' set-check-btn--active' : ''}`}
                        onClick={() => updateSetField(exIndex, setIndex, 'completed', !set.completed)}
                        title={set.completed ? 'Mark incomplete' : 'Mark complete'}
                      >
                        <Check size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Footer: Delete + Copy */}
                  <div className="set-card-footer">
                    <button
                      type="button"
                      className="set-footer-btn set-footer-btn--delete"
                      onClick={() => removeSet(exIndex, setIndex, set.id)}
                      title="Delete Set"
                    >
                      <X size={15} />
                    </button>
                    <button
                      type="button"
                      className="set-footer-btn"
                      onClick={() => duplicateSet(exIndex, setIndex)}
                      title="Duplicate Set"
                    >
                      <Copy size={15} />
                    </button>
                  </div>

                </div>
              ))}
            </div>

            {batchForms[exIndex] && (
              <form onSubmit={(e) => executeBatchAdd(exIndex, e)} className="flex flex-col gap-2 mt-4 p-3 bg-black rounded" style={{border: '1px solid var(--border-subtle)'}}>
                <h4 className="text-sm text-neon-blue mb-1">Prescribe Sets</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
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
              <button className="btn-secondary w-full text-sm" onClick={() => addSet(exIndex)}>+ Add Set</button>
              <button className="btn-secondary w-full text-sm" style={{borderStyle:'dashed', borderWidth:'2px'}} onClick={() => toggleBatchForm(exIndex)}>+ Prescribe Set</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-6" style={{ paddingBottom: '5rem' }}>
        <button className="btn-primary" style={{width: 'auto'}} onClick={addExerciseBlock}>
          <Plus size={18} style={{display:'inline', verticalAlign:'middle'}} /> Add Exercise
        </button>
        <button className="btn-primary" style={{width: 'auto', background: 'var(--neon-blue)'}} onClick={saveWorkoutDetails}>
          <Save size={18} style={{display:'inline', verticalAlign:'middle'}} /> Save Details
        </button>
      </div>
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

      {/* ── Custom Delete Confirmation Modal ── */}
      {pendingDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '340px', borderColor: 'rgba(255,68,68,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <X size={20} style={{ color: '#ff4444', flexShrink: 0 }} />
              <h3 style={{ color: '#ff4444', margin: 0 }}>Delete Set</h3>
            </div>
            <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Are you sure you want to delete this set? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ flex: 1, background: '#ff4444' }}
                onClick={confirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
