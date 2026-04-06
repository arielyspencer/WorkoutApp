import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkoutView from './pages/WorkoutView';
import Admin from './pages/Admin';
import Charts from './pages/Charts';
import Clients from './pages/Clients';
import ClientDashboard from './pages/ClientDashboard';
import { supabase } from './lib/supabase';

function App() {
  const [profile, setProfile] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Basic auth check
  useEffect(() => {
    const savedProfile = localStorage.getItem('workout_profile');
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    } else {
      navigate('/');
    }
  }, [navigate]);

  // Fetch pending requests count for trainers
  useEffect(() => {
    if (profile?.is_trainer || profile?.username?.toLowerCase() === 'admin') {
      const fetchPending = async () => {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
          .eq('trainer_id', profile.id)
          .eq('trainer_status', 'pending');
        setPendingCount(count || 0);
      };
      fetchPending();
    }
  }, [location.pathname, profile]);

  const handleLogout = () => {
    localStorage.removeItem('workout_profile');
    setProfile(null);
    navigate('/');
  };

  return (
    <div className="container">
      {profile && (
        <header className="flex justify-between items-center mb-4 glass-panel">
          <h2 className="text-neon m-0">WorkoutTracker</h2>
          <div className="flex gap-4 items-center">
            <Link to="/dashboard" className="text-neon-blue">Log</Link>
            <Link to="/charts" className="text-neon-blue">Charts</Link>
            {(profile.is_trainer || profile.username?.toLowerCase() === 'admin') && (
              <Link to="/clients" className="text-neon-blue flex items-center gap-1">
                Clients
                {pendingCount > 0 && (
                  <span style={{
                    background: 'var(--neon-green)', 
                    color: '#000', 
                    fontSize: '0.65rem', 
                    fontWeight: 'bold', 
                    borderRadius: '10px', 
                    padding: '0.1rem 0.4rem'
                  }}>
                    {pendingCount}
                  </span>
                )}
              </Link>
            )}
            {(profile.is_admin || profile.username?.toLowerCase() === 'admin') && (
              <Link to="/admin" className="text-neon-blue">Admin</Link>
            )}
            <button onClick={handleLogout} className="btn-secondary">Log Out ({profile.username})</button>
          </div>
        </header>
      )}
      
      <Routes>
        <Route path="/" element={<Login setProfile={setProfile} />} />
        <Route path="/dashboard" element={<Dashboard profile={profile} setProfile={setProfile} />} />
        <Route path="/workout/:id" element={<WorkoutView />} />
        <Route path="/admin" element={<Admin profile={profile} />} />
        <Route path="/charts" element={<Charts profile={profile} />} />
        <Route path="/clients" element={<Clients profile={profile} />} />
        <Route path="/client/:id" element={<ClientDashboard trainerProfile={profile} />} />
      </Routes>
    </div>
  );
}

export default App;
