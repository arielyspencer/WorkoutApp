import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { User, Eye, EyeOff } from 'lucide-react';

export default function Login({ setProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [newIsTrainer, setNewIsTrainer] = useState(false);
  
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [pinEntry, setPinEntry] = useState('');
  const [pinError, setPinError] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('username');
    if (!error && data) {
      setProfiles(data);
    }
    setLoading(false);
  };

  const executeLogin = (p) => {
    localStorage.setItem('workout_profile', JSON.stringify(p));
    document.documentElement.style.setProperty('--theme-color', p.theme_color || '#39ff14');
    setProfile(p);
    navigate('/dashboard');
  };

  const handleSelect = (p) => {
    setPinError('');
    setPinEntry('');
    setSelectedProfile(p);
  };

  const verifyPin = async (e) => {
    e.preventDefault();
    if (!selectedProfile) return;

    if (!selectedProfile.pin) {
      // Create PIN for existing user
      if (pinEntry.length < 4) {
        setPinError('PIN must be at least 4 characters');
        return;
      }
      const { error } = await supabase.from('profiles').update({ pin: pinEntry }).eq('id', selectedProfile.id);
      if (!error) {
        selectedProfile.pin = pinEntry;
        executeLogin(selectedProfile);
      } else {
        setPinError('Error saving PIN');
      }
    } else {
      // Verify existing PIN
      if (selectedProfile.pin === pinEntry) {
        executeLogin(selectedProfile);
      } else {
        setPinError('Incorrect PIN');
      }
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPin.trim()) {
      alert("Please enter both a Username and a PIN.");
      return;
    }
    
    // Quick check if exists locally
    const existing = profiles.find(p => p.username.toLowerCase() === newUsername.toLowerCase());
    if (existing) {
      alert("Username already exists!");
      return;
    }

    const { data, error } = await supabase.from('profiles').insert([{ username: newUsername, pin: newPin, is_trainer: newIsTrainer }]).select();
    if (!error && data && data.length > 0) {
      executeLogin(data[0]);
    } else {
      alert("Error creating user");
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '400px', margin: '10vh auto', textAlign: 'center' }}>
      <User size={48} className="text-neon mb-4" />
      
      {loading ? (
        <p className="mt-4">Loading profiles...</p>
      ) : selectedProfile ? (
        <div className="flex flex-col gap-4 mt-4 text-left">
          <h2 className="text-center">{selectedProfile.pin ? 'Enter PIN' : 'Create a PIN'}</h2>
          <p className="text-center text-sm text-secondary">
            {selectedProfile.pin ? `Logging in as ${selectedProfile.username}` : `It looks like you haven't set a PIN yet, ${selectedProfile.username}. Let's set one up!`}
          </p>
          
          <form onSubmit={verifyPin} className="flex flex-col gap-4 mt-4">
            <div className="relative">
              <input 
                type={showPin ? "text" : "password"} 
                pattern="[0-9]*"
                inputMode="numeric"
                required
                placeholder="4-Digit PIN" 
                value={pinEntry} 
                onChange={e => { setPinEntry(e.target.value); setPinError(''); }}
                maxLength={4}
                style={{ paddingRight: '2.5rem', letterSpacing: showPin ? 'normal' : '0.2rem', textAlign: 'center', fontSize: '1.2rem' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPin(!showPin)} 
                style={{ position: 'absolute', right: '10px', top: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
            <button type="submit" className="btn-primary w-full">{selectedProfile.pin ? 'Log In' : 'Set PIN & Log In'}</button>
            <button type="button" className="btn-secondary w-full" onClick={() => setSelectedProfile(null)}>Back to User List</button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-4">
          <h2>Who are you?</h2>
          {profiles.map(p => (
            <button key={p.id} onClick={() => handleSelect(p)} className="btn-secondary">
              {p.username}
            </button>
          ))}
          
          <hr style={{ borderColor: 'var(--border-subtle)', margin: '1rem 0' }} />
          
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <h3 className="text-sm text-secondary text-left mb-1">Create New Profile</h3>
            <input 
              type="text" 
              placeholder="Username" 
              required
              value={newUsername} 
              onChange={e => setNewUsername(e.target.value)} 
            />
            <div className="relative">
              <input 
                type={showPin ? "text" : "password"} 
                placeholder="4-Digit PIN" 
                required
                maxLength={4}
                pattern="[0-9]*"
                inputMode="numeric"
                value={newPin} 
                onChange={e => setNewPin(e.target.value)} 
                style={{ paddingRight: '2.5rem' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPin(!showPin)} 
                style={{ position: 'absolute', right: '10px', top: '12px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            
            <label className="flex items-center gap-2 mt-1 mb-2 text-sm text-neon-blue">
              <input type="checkbox" checked={newIsTrainer} onChange={e => setNewIsTrainer(e.target.checked)} style={{width: 'auto'}} />
              I am a Coach / Trainer
            </label>
            
            <button type="submit" className="btn-primary w-full">Create Account</button>
          </form>
        </div>
      )}
    </div>
  );
}
