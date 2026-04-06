import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Trash2, KeyRound, UserCog } from 'lucide-react';

export default function Admin({ profile }) {
  const [exercises, setExercises] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [newExercise, setNewExercise] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
    fetchProfiles();
  }, []);

  const fetchConfig = async () => {
    const { data, error } = await supabase.from('config').select('value').eq('id', 'exercise_list').single();
    if (!error && data) {
      setExercises(data.value || []);
    } else if (error && error.code !== 'PGRST116') {
      console.error(error);
    }
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('username');
    if (data) {
      setProfiles(data);
    }
    setLoading(false);
  };

  const syncToDB = async (list) => {
    setLoading(true);
    await supabase.from('config').upsert({ id: 'exercise_list', value: list });
    setExercises(list);
    setLoading(false);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newExercise.trim()) return;
    if (exercises.includes(newExercise.trim())) {
      alert("Exercise already exists!");
      return;
    }
    syncToDB([...exercises, newExercise.trim()]);
    setNewExercise('');
  };

  const handleRemove = (ex) => {
    if(confirm(`Remove ${ex} from global list?`)){
       syncToDB(exercises.filter(item => item !== ex));
    }
  };

  const handleResetPin = async (profileId, username) => {
    if(confirm(`Are you sure you want to reset the PIN for ${username}? They will be prompted to create a new one on their next login.`)) {
      const { error } = await supabase.from('profiles').update({ pin: null }).eq('id', profileId);
      if(!error) {
        alert(`PIN reset successful for ${username}.`);
        fetchProfiles();
      } else {
        alert("Failed to reset PIN.");
      }
    }
  };

  const handleToggleAdmin = async (profileId, username, currentState) => {
    if(confirm(`${currentState ? 'Remove' : 'Grant'} admin privileges for ${username}?`)) {
      const { error } = await supabase.from('profiles').update({ is_admin: !currentState }).eq('id', profileId);
      if(!error) {
        fetchProfiles();
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      
      <div className="glass-panel">
        <h2 className="flex items-center gap-2 mb-4 text-neon-blue"><UserCog /> Manage Users & PINs</h2>
        <p className="text-secondary mb-4 text-sm">As an admin, you can clear a user's PIN if they forgot it.</p>
        
        {loading ? <p>Loading profiles...</p> : (
          <div className="flex flex-col gap-2">
            {profiles.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-black border border-gray-800 p-3 rounded" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex flex-col">
                  <span>{p.username} <span className="text-sm text-secondary ml-2">({p.pin ? 'PIN Set' : 'No PIN'})</span></span>
                  {profile?.username?.toLowerCase() === 'admin' && p.username.toLowerCase() !== 'admin' && p.id !== profile?.id && (
                    <label className="text-xs text-neon-blue flex items-center gap-2 mt-1">
                      <input type="checkbox" checked={!!p.is_admin} onChange={() => handleToggleAdmin(p.id, p.username, p.is_admin)} style={{width: 'auto'}} />
                      Admin Privileges
                    </label>
                  )}
                </div>
                <button 
                  onClick={() => handleResetPin(p.id, p.username)} 
                  className="btn-secondary flex items-center gap-2 text-sm" 
                  disabled={!p.pin}
                  style={{ opacity: p.pin ? 1 : 0.5, padding: '0.4rem 0.8rem' }}
                >
                  <KeyRound size={14} /> Reset PIN
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel">
        <h2 className="flex items-center gap-2 mb-4"><Activity className="text-neon" /> Manage Exercises</h2>
        <p className="text-secondary mb-4 text-sm">This list populates the dropdown when adding an exercise to a workout.</p>
        
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input 
            type="text" 
            placeholder="New Exercise Name (e.g. Squat)" 
            value={newExercise} 
            onChange={e => setNewExercise(e.target.value)} 
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={loading}>
            Add
          </button>
        </form>

        {loading && exercises.length === 0 ? <p>Loading...</p> : (
          <ul style={{ listStyle: 'none' }}>
            {exercises.map(ex => (
              <li key={ex} className="flex justify-between items-center bg-black border p-3 rounded mb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <span>{ex}</span>
                <button onClick={() => handleRemove(ex)} className="btn-secondary" style={{ padding: '0.4rem', color: 'tomato' }} title="Delete">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
