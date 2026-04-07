import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Link, useLocation } from 'react-router-dom';
import { Home, LineChart, Users, ShieldAlert, User, Eye } from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkoutView from './pages/WorkoutView';
import Admin from './pages/Admin';
import Charts from './pages/Charts';
import Clients from './pages/Clients';
import ClientDashboard from './pages/ClientDashboard';
import Profile from './pages/Profile';
import { supabase } from './lib/supabase';

function App() {
  const [profile, setProfile] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Global coach-viewing-client context: null means viewing own data
  const [viewingClient, setViewingClient] = useState(null); // { id, username }

  const navigate = useNavigate();
  const location = useLocation();

  const isCoach = profile?.is_trainer || profile?.username?.toLowerCase() === 'admin';

  // Basic auth check and theme setup
  useEffect(() => {
    const savedProfile = localStorage.getItem('workout_profile');
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setProfile(parsed);
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

  // When navigating away from a client sub-page to an unrelated page, clear context
  useEffect(() => {
    // If we navigate to /clients explicitly (tab press), clearContext is handled by the nav click
    // But if the coach navigates to their own profile, clear context too
    if (location.pathname === '/profile' || location.pathname === '/admin' || location.pathname === '/dashboard') {
      // Only clear if not coming from a client sub-page navigation we intentionally set up
      // Keep viewingClient when going /dashboard (coach may want to see client's log tab)
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('workout_profile');
    setProfile(null);
    setViewingClient(null);
    navigate('/');
  };

  const firstName = profile?.username ? profile.username.split(' ')[0] : 'Profile';

  // The effective profile for content pages when a coach is viewing a client
  const contentProfile = (isCoach && viewingClient) ? viewingClient : profile;

  return (
    <>
      <div className="container">
        {profile && location.pathname !== '/' && (
          <header className="flex justify-between items-center mb-4 glass-panel desktop-nav">
            <h2 className="text-neon m-0">WorkoutTracker</h2>
            <div className="flex gap-4 items-center">
              <span className="text-neon" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{profile.username}</span>
              <Link to="/dashboard" className="text-neon-blue">Log</Link>
              <Link to="/charts" className="text-neon-blue">Charts</Link>
              <Link to="/profile" className="text-neon-blue inline-flex items-center gap-1"><User size={16} /> Profile</Link>
              {(profile.is_trainer || profile.username?.toLowerCase() === 'admin') && (
                <Link
                  to="/clients"
                  className="text-neon-blue flex items-center gap-1"
                  onClick={() => setViewingClient(null)}
                >
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
            </div>
          </header>
        )}

        {/* Global Coach-Viewing-Client Banner */}
        {isCoach && viewingClient && location.pathname !== '/' && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(0,243,255,0.15) 0%, rgba(0,243,255,0.06) 100%)',
            borderBottom: '2px solid var(--neon-blue)',
            borderTop: '1px solid rgba(0,243,255,0.2)',
            backdropFilter: 'blur(10px)',
            padding: '0.5rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            borderRadius: '10px',
            border: '1px solid rgba(0,243,255,0.3)',
          }}>
            <Eye size={16} style={{ color: 'var(--neon-blue)', flexShrink: 0 }} />
            <span style={{ color: 'var(--neon-blue)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.02em', flex: 1 }}>
              Currently viewing logs for: <span style={{ color: '#fff' }}>{viewingClient.username}</span>
            </span>
            <button
              onClick={() => setViewingClient(null)}
              style={{
                background: 'transparent', border: '1px solid rgba(0,243,255,0.3)',
                borderRadius: '6px', color: 'var(--neon-blue)', fontSize: '0.7rem',
                fontWeight: 700, padding: '0.2rem 0.5rem', cursor: 'pointer',
                letterSpacing: '0.04em'
              }}
            >
              EXIT VIEW
            </button>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Login setProfile={setProfile} />} />
          <Route
            path="/dashboard"
            element={
              <Dashboard
                profile={isCoach && viewingClient ? viewingClient : profile}
                setProfile={isCoach && viewingClient ? () => {} : setProfile}
                isTrainerMode={!!(isCoach && viewingClient)}
              />
            }
          />
          <Route path="/workout/:id" element={<WorkoutView />} />
          <Route path="/admin" element={<Admin profile={profile} />} />
          <Route
            path="/charts"
            element={
              <Charts
                profile={profile}
                viewingClient={viewingClient}
                setViewingClient={setViewingClient}
              />
            }
          />
          <Route
            path="/clients"
            element={<Clients profile={profile} setViewingClient={setViewingClient} />}
          />
          <Route
            path="/client/:id"
            element={
              <ClientDashboard
                trainerProfile={profile}
                setViewingClient={setViewingClient}
              />
            }
          />
          <Route
            path="/profile"
            element={<Profile profile={profile} setProfile={setProfile} handleLogout={handleLogout} />}
          />
        </Routes>
      </div>

      {/* Persistent Bottom Nav (Mobile only) */}
      {profile && location.pathname !== '/' && (
        <nav className="bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999 }}>
          <Link
            to="/dashboard"
            className={location.pathname === '/dashboard' ? 'active' : ''}
          >
            <Home size={24} />
            <span>Log</span>
          </Link>
          <Link
            to="/charts"
            className={location.pathname === '/charts' ? 'active' : ''}
          >
            <LineChart size={24} />
            <span>Charts</span>
          </Link>
          {(profile.is_trainer || profile.username?.toLowerCase() === 'admin') && (
            <Link
              to="/clients"
              className={location.pathname === '/clients' || location.pathname.startsWith('/client/') ? 'active' : ''}
              style={{ position: 'relative' }}
              onClick={() => setViewingClient(null)}
            >
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
          <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>
            <User size={24} />
            <span>{firstName}</span>
          </Link>
        </nav>
      )}
    </>
  );
}

export default App;
