import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';
import { Home, LineChart, Users, ShieldAlert, LogOut } from 'lucide-react';
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

  // Basic auth check and theme setup
  useEffect(() => {
    const savedProfile = localStorage.getItem('workout_profile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setProfile(parsed);
      // Apply theme custom color or fallback to neon green
      document.documentElement.style.setProperty('--theme-color', parsed.theme_color || '#39ff14');
      if (location.pathname === '/') {
        navigate('/dashboard');
      }
    } else {
      if (location.pathname !== '/') {
        navigate('/');
      }
    }
  }, [navigate, location.pathname]);

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
    <>
      <div className="container">
      {profile && location.pathname !== '/' && (
        <header className="flex justify-between items-center mb-4 glass-panel desktop-nav">
          <h2 className="text-neon m-0">WorkoutTracker</h2>
          <div className="flex gap-4 items-center">
            <Link to="/dashboard" className="text-neon-blue">Log</Link>
            <Link to="/charts" className="text-neon-blue">Charts</Link>
            {(profile.is_trainer || profile.username?.toLowerCase() === 'admin') && (
              <Link to="/clients" className="text-neon-blue flex items-center gap-1">
                Clients
                {pendingCount > 0 && (
                  <span style={{
                    background: 'var(--theme-color)', 
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

      {/* Persistent Bottom Nav Mobile only */}
      {profile && location.pathname !== '/' && (
        <nav className="bottom-nav" style={{position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999}}>
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
            <Home size={24} />
            <span>Log</span>
          </Link>
          <Link to="/charts" className={location.pathname === '/charts' ? 'active' : ''}>
            <LineChart size={24} />
            <span>Charts</span>
          </Link>
          {(profile.is_trainer || profile.username?.toLowerCase() === 'admin') && (
            <Link to="/clients" className={location.pathname === '/clients' ? 'active' : ''} style={{position: 'relative'}}>
              <Users size={24} />
              <span>Clients</span>
              {pendingCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: 0,
                  background: 'var(--theme-color)', color: '#000', 
                  fontSize: '0.6rem', fontWeight: 'bold', 
                  borderRadius: '10px', padding: '0.1rem 0.3rem'
                }}>
                  {pendingCount}
                </span>
              )}
            </Link>
          )}
          {(profile.is_admin || profile.username?.toLowerCase() === 'admin') && (
            <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>
              <ShieldAlert size={24} />
              <span>Admin</span>
            </Link>
          )}
          <button onClick={handleLogout} style={{background:'none', border:'none', padding:0}} className="flex flex-col items-center gap-1 text-secondary cursor-pointer">
            <LogOut size={24} />
            <span style={{fontSize: '0.75rem'}}>Logout</span>
          </button>
        </nav>
      )}
    </>
  );
}

export default App;
