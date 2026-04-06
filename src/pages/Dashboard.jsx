import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, Trash2, Copy, ClipboardPaste, Edit3, MoreVertical, X } from 'lucide-react';
import { cloneWorkout, cloneWeek } from '../lib/clone';
import SearchableDropdown from '../components/SearchableDropdown';

export default function Dashboard({ profile, isTrainerMode = false, setProfile }) {
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Trainer variables
  const [trainers, setTrainers] = useState([]);
  const [trainerStatus, setTrainerStatus] = useState(profile?.trainer_status || 'none');
  const [myTrainerId, setMyTrainerId] = useState(profile?.trainer_id || null);
  
  // Custom modals
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuOpenFor, setMenuOpenFor] = useState(null); // Track which workout has the 3-dots menu active
  
  // Clipboard state holds: { type: 'week' | 'workout', id: string, name?: string }
  const [clipboard, setClipboard] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      fetchWeeks();
      if (!isTrainerMode) fetchTrainers();
      setTrainerStatus(profile.trainer_status || 'none');
      setMyTrainerId(profile.trainer_id || null);
    }
  }, [profile]);

  const fetchTrainers = async () => {
    const { data } = await supabase.from('profiles').select('id, username').eq('is_trainer', true);
    if(data) setTrainers(data);
  };

  const handleSetTrainer = async (newId) => {
    if(newId === 'none') {
        await supabase.from('profiles').update({ trainer_id: null, trainer_status: 'none' }).eq('id', profile.id);
        setMyTrainerId(null);
        setTrainerStatus('none');
    } else {
        await supabase.from('profiles').update({ trainer_id: newId, trainer_status: 'pending' }).eq('id', profile.id);
        setMyTrainerId(newId);
        setTrainerStatus('pending');
    }
  };

  const fetchWeeks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('weeks')
      .select('*, workouts(*)')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setWeeks(data);
    }
    setLoading(false);
  };

  const createWeek = async () => {
    const weekName = prompt("Enter Week Name (e.g. Week 4 - Volume Phase)");
    if (!weekName) return;
    
    const { data, error } = await supabase
      .from('weeks')
      .insert([{ profile_id: profile.id, name: weekName }])
      .select();
      
    if (!error && data) {
      setWeeks([ { ...data[0], workouts: [] }, ...weeks]);
    }
  };

  const createWorkout = async (weekId) => {
    const { data, error } = await supabase
      .from('workouts')
      .insert([{ week_id: weekId, state_rating: 3, date: new Date().toISOString().split('T')[0], completed: false }])
      .select();
      
    if (!error && data) {
      navigate(`/workout/${data[0].id}`);
    }
  };

  const deleteWeek = (weekId) => {
    setDeleteTarget({ type: 'week', id: weekId });
  };

  const deleteWorkout = (workoutId) => {
    setDeleteTarget({ type: 'workout', id: workoutId });
  };
  
  const executeDelete = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    if (deleteTarget.type === 'week') {
      await supabase.from('weeks').delete().eq('id', deleteTarget.id);
    } else if (deleteTarget.type === 'workout') {
      await supabase.from('workouts').delete().eq('id', deleteTarget.id);
    }
    await fetchWeeks();
    setDeleteTarget(null);
  };
  
  const updateWeekName = async (weekId, currentName) => {
    const newName = prompt(`Rename week:`, currentName);
    if(newName && newName.trim() !== currentName) {
      setLoading(true);
      await supabase.from('weeks').update({ name: newName.trim() }).eq('id', weekId);
      await fetchWeeks();
    }
  };

  const handleCopyWeek = (week) => {
    setClipboard({ type: 'week', id: week.id, name: week.name });
  };
  
  const handleCopyWorkout = (workout) => {
    setClipboard({ type: 'workout', id: workout.id, name: `Workout from ${workout.date || 'Planned Workout'}` });
  };
  
  const handlePasteWeek = async () => {
    if (!clipboard || clipboard.type !== 'week') return;
    setLoading(true);
    const cloned = await cloneWeek(clipboard.id, profile.id);
    if(cloned) {
      setClipboard(null);
      await fetchWeeks();
    }
    setLoading(false);
  };

  const handlePasteWorkout = async (targetWeekId) => {
    if (!clipboard || clipboard.type !== 'workout') return;
    setLoading(true);
    const cloned = await cloneWorkout(clipboard.id, targetWeekId);
    if(cloned) {
      setClipboard(null); // Clear after 1 paste
      await fetchWeeks();
    }
    setLoading(false);
  };

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div>
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', background: '#111', borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-neon-blue mb-4 text-center">Confirm Deletion</h3>
            <p className="mb-6 text-sm text-secondary text-center">
              Are you sure you want to delete this {deleteTarget.type}?
              {deleteTarget.type === 'week' && " All of its associated workouts will also be permanently wiped."}
            </p>
            <div className="flex flex-col gap-3">
              <button className="btn-secondary" style={{borderColor: 'tomato', color: 'tomato'}} onClick={executeDelete}>
                Yes, Delete {deleteTarget.type === 'week' ? 'Week' : 'Workout'}
              </button>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {!isTrainerMode && (
         <div className="glass-panel mb-6" style={{padding: '1rem', background: 'rgba(0,0,0,0.4)', borderColor: 'var(--border-subtle)'}}>
             <h3 className="text-sm text-secondary m-0 mb-3">Your Coach / Trainer</h3>
             {myTrainerId && trainerStatus === 'accepted' ? (
                <div className="flex justify-between items-center text-sm">
                   <p className="m-0 text-secondary">Linked with: <span className="text-neon">{trainers.find(t => t.id === myTrainerId)?.username || 'Your Coach'}</span></p>
                   <button onClick={() => handleSetTrainer('none')} className="btn-secondary" style={{padding: '0.3rem 0.6rem', borderColor: 'tomato', color: 'tomato'}}>Disconnect</button>
                </div>
             ) : myTrainerId && trainerStatus === 'pending' ? (
                <div className="flex justify-between items-center text-sm">
                   <p className="m-0 text-secondary">Request pending with <span className="text-yellow-500">{trainers.find(t => t.id === myTrainerId)?.username || 'Coach'}</span>...</p>
                   <button onClick={() => handleSetTrainer('none')} className="btn-secondary" style={{padding: '0.3rem 0.6rem', borderColor: 'tomato', color: 'tomato'}}>Cancel</button>
                </div>
             ) : (
                <SearchableDropdown 
                  options={[{value: 'none', label: 'No Trainer'}, ...trainers.map(t => ({value: t.id, label: t.username}))]} 
                  value={myTrainerId || 'none'}
                  onChange={handleSetTrainer}
                  placeholder="Select a coach..."
                />
             )}
         </div>
      )}

      <div className="flex flex-col gap-4 mb-6 mt-6">
        <div>
          <h1 style={{ borderBottom: 'none', textDecoration: 'none', margin: 0 }}>Your Training Log</h1>
        </div>
        
        <div className="flex gap-2 text-sm justify-start">
          {clipboard?.type === 'week' && (
             <div className="flex gap-1 items-center">
               <button className="btn-secondary" style={{color: 'var(--neon-blue)', borderColor: 'var(--neon-blue)', padding: '0.4rem'}} onClick={handlePasteWeek}>
                 <ClipboardPaste size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Paste Week
               </button>
               <button className="btn-secondary" style={{padding: '0.4rem', border: '1px solid tomato', color: 'tomato'}} onClick={() => setClipboard(null)}>
                 <X size={18} />
               </button>
             </div>
          )}
          <button className="btn-primary" style={{ width: 'auto', padding: '0.4rem 0.8rem' }} onClick={createWeek}>
            <Plus size={18} style={{ verticalAlign: 'middle', display: 'inline' }} /> New Week
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {weeks.length === 0 ? (
          <div className="glass-panel text-center">No weeks found. Create one to begin.</div>
        ) : (
          weeks.map(week => (
            <div key={week.id} className="glass-panel relative">
              <div className="flex justify-between items-center mb-4 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <h3 className="text-neon m-0">{week.name}</h3>
                  <button onClick={() => updateWeekName(week.id, week.name)} className="btn-secondary" style={{ padding: '0.2rem', border: 'none' }} title="Rename Week">
                    <Edit3 size={14} className="text-secondary" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleCopyWeek(week)} className="btn-secondary" style={{ padding: '0.4rem', border: 'none' }} title="Copy Week"><Copy size={16}/></button>
                  <button onClick={() => deleteWeek(week.id)} className="btn-secondary" style={{ border: 'none', color: 'tomato', padding: '0.4rem' }} title="Delete Week"><Trash2 size={16}/></button>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                {week.workouts && week.workouts.sort((a,b)=> new Date(a.date) - new Date(b.date)).map(w => (
                  <div key={w.id} className="relative flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors" style={{ paddingLeft: '1.5rem', paddingRight: '0.5rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', background: '#000', border: '1px solid var(--border-subtle)', borderRadius: '12px' }} onClick={() => navigate(`/workout/${w.id}`)}>
                    <div className="flex flex-1 items-center gap-6 pointer-events-none">
                      <div className="flex items-center gap-2" style={{minWidth: '120px'}}>
                        {w.completed ? (
                          <>
                            <Calendar size={16} className="text-neon" />
                            <span className="text-neon whitespace-nowrap">{w.date}</span>
                          </>
                        ) : (
                          <span className="text-secondary italic whitespace-nowrap" style={{fontSize: '0.9rem'}}>Planned Workout</span>
                        )}
                      </div>
                      <span className="text-secondary text-sm">State: {w.state_rating}/5</span>
                    </div>
                    
                    <div className="flex items-center" style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                      <button className="btn-secondary flex items-center justify-center p-2" onClick={() => setMenuOpenFor(menuOpenFor === w.id ? null : w.id)} style={{border:'none'}}>
                        <MoreVertical size={18} className="text-secondary" />
                      </button>
                      
                      {menuOpenFor === w.id && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={(e) => { e.stopPropagation(); setMenuOpenFor(null); }} />
                          <div className="p-2 flex flex-col gap-2" style={{position: 'absolute', right: '36px', top: 0, background: '#0a0a0a', border: '1px solid var(--theme-color)', borderRadius: '8px', minWidth: '120px', boxShadow: '0 8px 24px rgba(0,0,0,0.8)', zIndex: 50}}>
                            <button className="text-sm flex items-center justify-start gap-2" onClick={() => { handleCopyWorkout(w); setMenuOpenFor(null); }} style={{color: 'var(--text-primary)', padding: '0.4rem 0.8rem', background: 'transparent', border: 'none'}}><Copy size={14}/> Copy</button>
                            <button className="text-sm flex items-center justify-start gap-2" onClick={() => { deleteWorkout(w.id); setMenuOpenFor(null); }} style={{color: 'tomato', padding: '0.4rem 0.8rem', background: 'transparent', border: 'none'}}><Trash2 size={14}/> Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                
                <div className="flex gap-2 mt-2">
                  <button className="btn-secondary w-full text-sm" onClick={() => createWorkout(week.id)}>
                    + Add Workout
                  </button>
                  {clipboard?.type === 'workout' && (
                    <div className="flex gap-2 w-full">
                      <button className="btn-secondary w-full text-sm text-neon-blue border-dashed" onClick={() => handlePasteWorkout(week.id)} style={{borderColor: 'var(--neon-blue)'}}>
                        <ClipboardPaste size={14} style={{display:'inline', marginRight: '4px'}}/> Paste {clipboard.name}
                      </button>
                      <button className="btn-secondary" style={{padding: '0.4rem', border: '1px solid tomato', color: 'tomato'}} onClick={() => setClipboard(null)}>
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
