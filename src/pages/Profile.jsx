import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { KeyRound, Palette, UserCog, User, LogOut, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile({ profile, setProfile, handleLogout }) {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleChangePin = async () => {
    const newPin = prompt('Enter a new 4-digit PIN for your account:');
    if (!newPin) return;
    if (newPin.length < 4 || isNaN(newPin)) {
      alert('PIN must be at least 4 numerical digits.');
      return;
    }
    const { error } = await supabase.from('profiles').update({ pin: newPin }).eq('id', profile.id);
    if (!error) {
      alert('PIN successfully changed!');
    } else {
      alert('Error saving new PIN');
    }
  };

  const handleThemeColorChange = async (e) => {
    const newColor = e.target.value;
    if (!profile) return;
    const updatedProfile = { ...profile, theme_color: newColor };
    if (setProfile) setProfile(updatedProfile);
    document.documentElement.style.setProperty('--theme-color', newColor);
    await supabase.from('profiles').update({ theme_color: newColor }).eq('id', profile.id);
    localStorage.setItem('workout_profile', JSON.stringify(updatedProfile));
  };

  const handleToggleTrainer = async () => {
    if (!profile) return;
    const newStatus = !profile.is_trainer;
    if (confirm(`Are you sure you want to ${newStatus ? 'enable' : 'disable'} Coach Mode?`)) {
      const { error } = await supabase.from('profiles').update({ is_trainer: newStatus }).eq('id', profile.id);
      if (!error) {
        const updatedProfile = { ...profile, is_trainer: newStatus };
        localStorage.setItem('workout_profile', JSON.stringify(updatedProfile));
        if (setProfile) setProfile(updatedProfile);
        alert(`Coach Mode ${newStatus ? 'Enabled!' : 'Disabled.'}`);
      } else {
        alert('Error updating status.');
      }
    }
  };

  const handleDeleteProfile = async () => {
    setDeleteLoading(true);
    try {
      // Cascade delete: supabase RLS should cascade; we delete the profile row
      // which cascades to weeks → workouts → workout_exercises → sets
      const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
      if (error) throw error;

      // Clear local session
      localStorage.removeItem('workout_profile');
      document.documentElement.style.removeProperty('--theme-color');
      if (setProfile) setProfile(null);
      navigate('/');
    } catch (err) {
      console.error('Delete profile error:', err);
      alert('Error deleting profile. Please try again.');
    }
    setDeleteLoading(false);
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <User size={24} className="text-neon" />
        <h1 style={{ borderBottom: 'none' }}>Your Profile</h1>
      </div>

      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Account Security */}
        <div>
          <h3 className="text-sm text-secondary mb-2">Account Security</h3>
          <div className="flex flex-col gap-2">
            <button onClick={handleChangePin} className="btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }}>
              <KeyRound size={16} /> Change PIN
            </button>
            <button onClick={handleLogout} className="btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', color: 'tomato', borderColor: 'tomato' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

        {/* Appearance */}
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
                style={{ opacity: 0, position: 'absolute', width: '100%', height: '100%', left: 0, top: 0, cursor: 'pointer' }}
              />
            </label>
          </div>
        </div>

        {/* Coach Status */}
        <div>
          <h3 className="text-sm text-secondary mb-2">Coach Status</h3>
          <button
            onClick={handleToggleTrainer}
            className={profile.is_trainer ? 'btn-secondary' : 'btn-primary'}
            style={
              profile.is_trainer
                ? { width: '100%', justifyContent: 'flex-start', borderColor: 'tomato', color: 'tomato' }
                : { width: '100%', justifyContent: 'flex-start' }
            }
          >
            <UserCog size={16} />
            {profile.is_trainer ? 'Disable Coach Mode' : 'Enable Coach Mode'}
          </button>
        </div>

        {/* Danger Zone */}
        <div>
          <h3 className="text-sm mb-2" style={{ color: '#ff4444' }}>Danger Zone</h3>
          <p className="text-secondary text-sm mb-3">
            Permanently deletes your profile and all associated training data. This cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', color: '#ff4444', borderColor: 'rgba(255,68,68,0.4)' }}
            >
              <Trash2 size={16} /> Delete Profile
            </button>
          ) : (
            <div
              style={{
                border: '1px solid rgba(255,68,68,0.5)',
                borderRadius: '8px',
                padding: '1rem',
                background: 'rgba(255,68,68,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <p style={{ color: '#ff4444', fontWeight: 700, fontSize: '0.9rem', margin: 0 }}>
                ⚠ Are you absolutely sure? This will permanently delete your profile and ALL your training data.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-secondary flex-1"
                  style={{ minHeight: '40px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProfile}
                  disabled={deleteLoading}
                  className="btn-primary flex-1"
                  style={{ background: '#ff4444', minHeight: '40px' }}
                >
                  {deleteLoading ? 'Deleting...' : 'Yes, Delete Everything'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
