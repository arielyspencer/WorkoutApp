import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { calculateOneRepMax } from '../lib/1rm';
import { Save, Plus, ArrowLeft, Copy, Check, X, Eye, EyeOff, Trash2 } from 'lucide-react';
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
  // Custom delete modal state: null | { type: 'set', exIndex, setIndex, setId } | { type: 'exercise', exIndex, exId }
  const [pendingDelete, setPendingDelete] = useState(null);

  // Per-set validation errors: { [setId]: { weight?: true, reps?: true } }
  const [setErrors, setSetErrors] = useState({});

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
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 2. Intercept native Browser Back gestures
    window.history.pushState({ locked: true }, '');
    const handlePopState = () => {
      if (hasUnsavedRef.current) {
        setShowExitModal(true);
        window.history.pushState({ locked: true }, '');
      } else {
        navigate(-1);
      }
    };
    window.addEventListener('popstate', handlePopState);

    // 3. Intercept screen turning off / app backgrounding
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && saveActionRef.current) {
        saveActionRef.current(true);
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
    if (data) {
      // Store alphabetically sorted
      setGlobalExercises([...(data.value || [])].sort((a, b) => a.localeCompare(b)));
    }
  };

  const fetchWorkout = async () => {
    setLoading(true);
    const { data } = await supabase
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
      const sortedEx = data.workout_exercises.map(ex => ({
        ...ex,
        sets: ex.sets.sort((a, b) => a.created_at?.localeCompare(b.created_at) || 0)
      }));
      setExercises(sortedEx);
    }
    setLoading(false);
  };

  const updateWorkoutField = async (field, value) => {
    hasUnsavedRef.current = true;
    setWorkout(prev => ({ ...prev, [field]: value }));

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
            const rpeStr = setObj.rpe || '0';
            setObj.calculated_1rm = calculateOneRepMax(weightNum, repNum, rpeStr);
            setsToUpdate.push(setObj);
          }
        }
      }

      setExercises(exList);
      for (const s of setsToUpdate) {
        await supabase.from('sets').update({ completed: true, calculated_1rm: s.calculated_1rm }).eq('id', s.id);
      }
    }
  };

  const addExerciseBlock = async () => {
    hasUnsavedRef.current = true;
    const name = globalExercises[0] || 'Unknown';
    const { data } = await supabase.from('workout_exercises').insert([{ workout_id: workout.id, exercise_name: name }]).select();
    if (data) {
      setExercises([...exercises, { ...data[0], sets: [] }]);
    }
  };

  const removeExerciseBlock = (exIndex, exId) => {
    setPendingDelete({ type: 'exercise', exIndex, exId });
  };

  const updateExerciseName = async (exIndex, name) => {
    hasUnsavedRef.current = true;
    const exList = [...exercises];
    exList[exIndex].exercise_name = name;
    setExercises(exList);
    await supabase.from('workout_exercises').update({ exercise_name: name }).eq('id', exList[exIndex].id);
  };

  const addSet = async (exIndex) => {
    hasUnsavedRef.current = true;
    const exList = [...exercises];
    const exerciseId = exList[exIndex].id;
    const { data } = await supabase.from('sets').insert([{
      workout_exercise_id: exerciseId,
      reps: null, weight: null, rpe: null
    }]).select();

    if (data) {
      exList[exIndex].sets.push(data[0]);
      setExercises([...exList]);
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

    if (data) {
      exList[exIndex].sets.splice(setIndex + 1, 0, data[0]);
      setExercises([...exList]);
    }
  };

  const removeSet = (exIndex, setIndex, setId) => {
    setPendingDelete({ type: 'set', exIndex, setIndex, setId });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    if (pendingDelete.type === 'set') {
      const { exIndex, setIndex, setId } = pendingDelete;
      hasUnsavedRef.current = true;
      const exList = [...exercises];
      exList[exIndex].sets.splice(setIndex, 1);
      setExercises([...exList]);
      await supabase.from('sets').delete().eq('id', setId);
    } else if (pendingDelete.type === 'exercise') {
      const { exIndex, exId } = pendingDelete;
      hasUnsavedRef.current = true;
      const exList = [...exercises];
      exList.splice(exIndex, 1);
      setExercises([...exList]);
      await supabase.from('workout_exercises').delete().eq('id', exId);
    }

    setPendingDelete(null);
  };

  const updateCoachNote = (exIndex, note) => {
    hasUnsavedRef.current = true;
    const exList = [...exercises];
    exList[exIndex] = { ...exList[exIndex], coach_notes: note };
    setExercises([...exList]);
  };

  const saveCoachNote = async (exIndex) => {
    const exList = exercises;
    await supabase.from('workout_exercises')
      .update({ coach_notes: exList[exIndex].coach_notes || '' })
      .eq('id', exList[exIndex].id);
  };

  const updateSetField = async (exIndex, setIndex, field, value) => {
    hasUnsavedRef.current = true;
    const exList = [...exercises];
    const setObj = { ...exList[exIndex].sets[setIndex] };

    // If attempting to toggle 'completed' to true, validate first
    if (field === 'completed' && value === true) {
      const weight = setObj.weight;
      const reps = setObj.reps;
      const rpe = setObj.rpe;

      const errors = {};
      if (weight === null || weight === '' || weight === undefined) errors.weight = true;
      if (reps === null || reps === '' || reps === undefined) errors.reps = true;
      if (rpe === null || rpe === '' || rpe === undefined) errors.rpe = true;

      if (Object.keys(errors).length > 0) {
        setSetErrors(prev => ({ ...prev, [setObj.id]: errors }));
        return; // Block the toggle
      } else {
        // Clear any lingering errors
        setSetErrors(prev => {
          const next = { ...prev };
          delete next[setObj.id];
          return next;
        });
      }
    }

    setObj[field] = value;
    exList[exIndex] = { ...exList[exIndex], sets: [...exList[exIndex].sets] };
    exList[exIndex].sets[setIndex] = setObj;

    let rm = setObj.calculated_1rm;
    if (field === 'completed') {
      if (value === true) {
        const repNum = parseInt(setObj.reps) || 0;
        const weightNum = parseFloat(setObj.weight) || 0;
        const rpeStr = setObj.rpe || '0';
        rm = calculateOneRepMax(weightNum, repNum, rpeStr);
        exList[exIndex].sets[setIndex].calculated_1rm = rm;
      } else {
        rm = null;
        exList[exIndex].sets[setIndex].calculated_1rm = null;
      }
    } else if (setObj.completed) {
      const repNum = parseInt(setObj.reps) || 0;
      const weightNum = parseFloat(setObj.weight) || 0;
      const rpeStr = setObj.rpe || '0';
      rm = calculateOneRepMax(weightNum, repNum, rpeStr);
      exList[exIndex].sets[setIndex].calculated_1rm = rm;
    }

    // When user fills in a field, instantly clear that specific error
    if (field !== 'completed' && setErrors[setObj.id]) {
      setSetErrors(prev => {
        const fieldErrors = { ...prev[setObj.id] };
        delete fieldErrors[field];
        if (Object.keys(fieldErrors).length === 0) {
          const next = { ...prev };
          delete next[setObj.id];
          return next;
        }
        return { ...prev, [setObj.id]: fieldErrors };
      });
    }

    setExercises(exList);

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
    const weight = parseFloat(form.bWeight.value) !== undefined ? parseFloat(form.bWeight.value) : null;
    const reps = parseInt(form.bReps.value) !== undefined ? parseInt(form.bReps.value) : null;
    const rpe = form.bRpe.value || null;

    const exList = [...exercises];
    const exerciseId = exList[exIndex].id;

    const setsToInsert = Array.from({ length: numSets }).map(() => ({
      workout_exercise_id: exerciseId,
      weight, reps, rpe
    }));

    const { data } = await supabase.from('sets').insert(setsToInsert).select();
    if (data) {
      exList[exIndex].sets.push(...data);
      setExercises([...exList]);
      toggleBatchForm(exIndex);
    }
  };

  const saveWorkoutDetails = async (silent = false) => {
    // If the workout is marked completed but no date was entered, assign today
    let dateToSave = workout.date;
    if (workout.completed && (!dateToSave || dateToSave === '')) {
      dateToSave = new Date().toISOString().split('T')[0];
      setWorkout(prev => ({ ...prev, date: dateToSave }));
    }

    await supabase.from('workouts').update({
      date: dateToSave,
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

  // Build sorted exercise dropdown options
  const buildExerciseOptions = (currentName) => {
    const sorted = [...globalExercises].sort((a, b) => a.localeCompare(b));
    // Ensure current is always present even if not in globalExercises
    if (currentName && !sorted.includes(currentName)) {
      sorted.unshift(currentName);
    }
    return sorted.map(g => ({ value: g, label: g }));
  };

  if (loading) return <div>Loading...</div>;
  if (!workout) return <div>Workout not found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <button onClick={handleBack} className="btn-secondary flex items-center gap-2 mb-4">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="glass-panel mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-neon-blue">Workout Details</h2>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={saveWorkoutDetails}>
            <Save size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> Save Details
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="text-sm text-secondary flex items-center gap-2" style={{ cursor: isOwner ? 'pointer' : 'not-allowed' }}>
            <input type="checkbox" disabled={!isOwner} checked={!!workout.completed} onChange={e => updateWorkoutField('completed', e.target.checked)} style={{ width: 'auto' }} />
            Workout Completed
          </label>

          {workout.completed && (
            <label className="text-sm text-secondary">Date
              <input
                type="date"
                disabled={!isOwner}
                className="mt-1"
                value={workout.date || ''}
                onChange={e => updateWorkoutField('date', e.target.value || null)}
              />
            </label>
          )}
          <div className="flex flex-col gap-2" style={{ opacity: isOwner ? 1 : 0.5, pointerEvents: isOwner ? 'auto' : 'none' }}>
            <span className="text-sm text-secondary">State Rating (1-Terrible to 5-Excellent)</span>
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4, 5].map(v => (
                <button
                  key={v} type="button" disabled={!isOwner}
                  className={`rpe-btn ${workout.state_rating === v ? 'active' : ''}`}
                  onClick={() => updateWorkoutField('state_rating', v)}
                >{v}</button>
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
            <div key={ex.id} className="glass-panel p-4" style={{ borderColor: 'var(--neon-blue)' }}>

              {/* Exercise header: name + delete icon */}
              <div className="flex items-center gap-2 mb-4">
                <select
                  value={ex.exercise_name}
                  onChange={e => updateExerciseName(exIndex, e.target.value)}
                  className="font-bold text-lg text-neon bg-transparent flex-1"
                  style={{ border: 'none', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', borderRadius: 0, outline: 'none' }}
                >
                  {buildExerciseOptions(ex.exercise_name).map(opt => (
                    <option key={opt.value} value={opt.value} style={{ background: '#0a0a0a', color: 'var(--neon-blue)' }}>{opt.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  title="Delete Exercise"
                  onClick={() => removeExerciseBlock(exIndex, ex.id)}
                  style={{
                    background: 'transparent', border: '1px solid rgba(255,68,68,0.3)',
                    borderRadius: '6px', padding: '0.3rem', cursor: 'pointer',
                    color: '#ff4444', display: 'flex', alignItems: 'center', flexShrink: 0,
                    transition: 'background 0.2s, border-color 0.2s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,68,68,0.12)'; e.currentTarget.style.borderColor = '#ff4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,68,68,0.3)'; }}
                >
                  <Trash2 size={15} />
                </button>
              </div>

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
                      onBlur={() => saveCoachNote(exIndex)}
                    />
                  ) : (
                    ex.coach_notes ? (
                      <div className="coach-note-readonly">{ex.coach_notes}</div>
                    ) : (
                      <div className="coach-note-readonly" style={{ opacity: 0.4, fontStyle: 'italic' }}>No coach note for this exercise.</div>
                    )
                  )
                )}
              </div>

              {/* Set Cards */}
              <div className="set-cards-container">
                {ex.sets.map((set, setIndex) => {
                  const errs = setErrors[set.id] || {};
                  const hasErr = Object.keys(errs).length > 0;

                  return (
                    <div key={set.id} className={`set-card${hasErr ? ' set-card--error' : ''}`}>

                      {/* Card Header */}
                      <div className="set-card-header">
                        <span className="set-card-label">Set {setIndex + 1}</span>
                        {hasErr && (
                          <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#ff4444', fontWeight: 700, letterSpacing: '0.04em' }}>
                            ⚠ Incomplete data entry
                          </span>
                        )}
                      </div>

                      {/* Row 1: Weight | Reps | RPE */}
                      <div className="set-card-row1">
                        <div className="set-field">
                          <span className="set-field-label">Weight</span>
                          <input
                            type="number" step="0.5"
                            className={`set-input${errs.weight ? ' set-input--error' : ''}`}
                            value={set.weight ?? ''}
                            placeholder="—"
                            onChange={e => {
                              const v = e.target.value === '' ? null : parseFloat(e.target.value);
                              updateSetField(exIndex, setIndex, 'weight', v);
                            }}
                          />
                        </div>
                        <div className="set-field">
                          <span className="set-field-label">Reps</span>
                          <input
                            type="number"
                            className={`set-input${errs.reps ? ' set-input--error' : ''}`}
                            value={set.reps ?? ''}
                            placeholder="—"
                            onChange={e => {
                              const v = e.target.value === '' ? null : parseInt(e.target.value);
                              updateSetField(exIndex, setIndex, 'reps', v);
                            }}
                          />
                        </div>
                        <div className="set-field">
                          <span className="set-field-label">RPE</span>
                          <select
                            className={`set-input rpe-select${errs.rpe ? ' set-input--error' : ''}`}
                            value={set.rpe ?? ''}
                            onChange={e => {
                              const v = e.target.value === '' ? null : e.target.value;
                              updateSetField(exIndex, setIndex, 'rpe', v);
                            }}
                          >
                            <option value="">—</option>
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
                  );
                })}
              </div>

              {batchForms[exIndex] && (
                <form onSubmit={(e) => executeBatchAdd(exIndex, e)} className="flex flex-col gap-2 mt-4 p-3 bg-black rounded" style={{ border: '1px solid var(--border-subtle)' }}>
                  <h4 className="text-sm text-neon-blue mb-1">Prescribe Sets</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label>Sets <input required name="bSets" type="number" min="1" defaultValue="3" /></label>
                    <label>Target Wt <input name="bWeight" type="number" step="0.5" placeholder="—" /></label>
                    <label>Target Reps <input name="bReps" type="number" min="1" placeholder="—" /></label>
                    <label>Target RPE
                      <select name="bRpe" defaultValue="">
                        <option value="">—</option>
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
                    <button type="submit" className="btn-primary text-xs" style={{ width: 'auto' }}>Add Batch</button>
                  </div>
                </form>
              )}

              <div className="flex gap-2 mt-4">
                <button className="btn-secondary w-full text-sm" onClick={() => addSet(exIndex)}>+ Add Set</button>
                <button className="btn-secondary w-full text-sm" style={{ borderStyle: 'dashed', borderWidth: '2px' }} onClick={() => toggleBatchForm(exIndex)}>+ Prescribe Set</button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center" style={{ marginTop: '2.5rem', paddingBottom: '5rem' }}>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={addExerciseBlock}>
            <Plus size={18} style={{ display: 'inline', verticalAlign: 'middle' }} /> Add Exercise
          </button>
          <button className="btn-primary" style={{ width: 'auto', background: 'var(--neon-blue)' }} onClick={saveWorkoutDetails}>
            <Save size={18} style={{ display: 'inline', verticalAlign: 'middle' }} /> Save Details
          </button>
        </div>
      </div>

      {showExitModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 className="text-neon-blue mb-4 text-center">Unsaved Changes</h3>
            <p className="mb-6 text-sm text-secondary text-center">Would you like to save your workout details before leaving?</p>
            <div className="flex flex-col gap-3">
              <button className="btn-primary" onClick={async () => { await saveWorkoutDetails(); setShowExitModal(false); navigate(-1); }}>Save & Exit</button>
              <button className="btn-secondary" style={{ borderColor: 'tomato', color: 'tomato' }} onClick={() => { setShowExitModal(false); navigate(-1); }}>Exit Without Saving</button>
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
              <Trash2 size={20} style={{ color: '#ff4444', flexShrink: 0 }} />
              <h3 style={{ color: '#ff4444', margin: 0 }}>
                {pendingDelete.type === 'exercise' ? 'Delete Exercise' : 'Delete Set'}
              </h3>
            </div>
            <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              {pendingDelete.type === 'exercise'
                ? 'Are you sure you want to delete this entire exercise and all its sets? This action cannot be undone.'
                : 'Are you sure you want to delete this set? This action cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1, background: '#ff4444' }} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
