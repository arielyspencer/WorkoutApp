import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { KeyRound, Palette, UserCog, User, LogOut } from 'lucide-react';

export default function Profile({ profile, setProfile, handleLogout }) {

  const handleChangePin = async () => {
    const newPin = prompt("Enter a new 4-digit PIN for your account:");
    if(!newPin) return;
    if(newPin.length < 4 || isNaN(newPin)) {
      alert("PIN must be at least 4 numerical digits.");
      return;
    }
    const { error } = await supabase.from('profiles').update({ pin: newPin }).eq('id', profile.id);
    if(!error) {
      alert("PIN successfully changed!");
    } else {
      alert("Error saving new PIN");
    }
  };

  const handleThemeColorChange = async (e) => {
    const newColor = e.target.value;
    if(!profile) return;
    const updatedProfile = { ...profile, theme_color: newColor };
    if (setProfile) setProfile(updatedProfile);
    document.documentElement.style.setProperty('--theme-color', newColor);
    
    // Save to DB on change
    await supabase.from('profiles').update({ theme_color: newColor }).eq('id', profile.id);
    localStorage.setItem('workout_profile', JSON.stringify(updatedProfile));
  };

  const handleToggleTrainer = async () => {
    if(!profile) return;
    const newStatus = !profile.is_trainer;
    if (confirm(`Are you sure you want to ${newStatus ? 'enable' : 'disable'} Coach Mode?`)) {
      const { error } = await supabase.from('profiles').update({ is_trainer: newStatus }).eq('id', profile.id);
      if (!error) {
        const updatedProfile = { ...profile, is_trainer: newStatus };
        localStorage.setItem('workout_profile', JSON.stringify(updatedProfile));
        if (setProfile) setProfile(updatedProfile);
        alert(`Coach Mode ${newStatus ? 'Enabled!' : 'Disabled.'}`);
      } else {
        alert("Error updating status.");
      }
    }
  };

  if(!profile) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <User size={24} className="text-neon" />
        <h1 style={{borderBottom: 'none'}}>Your Profile</h1>
      </div>

      <div className="glass-panel" style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <div>
          <h3 className="text-sm text-secondary mb-2">Account Security</h3>
          <div className="flex flex-col gap-2">
            <button onClick={handleChangePin} className="btn-secondary" style={{width: '100%', justifyContent: 'flex-start'}}>
              <KeyRound size={16} /> Change PIN
            </button>
            <button onClick={handleLogout} className="btn-secondary" style={{width: '100%', justifyContent: 'flex-start', color: 'tomato', borderColor: 'tomato'}}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm text-secondary mb-2">Appearance</h3>
          <div className="flex gap-4 items-center">
            <span className="text-secondary text-sm flex-1">Select Theme Accent Color</span>
            <label 
              style={{
                width: '48px', height: '48px', borderRadius: '50%', 
                background: profile.theme_color || '#39ff14', 
                cursor: 'pointer', position: 'relative', 
                border: '2px solid #fff', boxShadow: `0 0 10px ${profile.theme_color || '#39ff14'}`,
                display: 'block'
              }}
            >
              <input 
                type="color" 
                value={profile.theme_color || '#39ff14'} 
                onChange={handleThemeColorChange} 
                style={{opacity: 0, position: 'absolute', width: '100%', height: '100%', left: 0, top: 0, cursor: 'pointer'}} 
              />
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-sm text-secondary mb-2">Coach Status</h3>
          <button 
            onClick={handleToggleTrainer} 
            className={profile.is_trainer ? "btn-secondary" : "btn-primary"} 
            style={
              profile.is_trainer 
              ? { width: '100%', justifyContent: 'flex-start', borderColor: 'tomato', color: 'tomato' }
              : { width: '100%', justifyContent: 'flex-start' }
            }
          >
            <UserCog size={16} />
            {profile.is_trainer ? "Disable Coach Mode" : "Enable Coach Mode"}
          </button>
        </div>
      </div>
    </div>
  );
}
