import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserCheck, UserX, UserMinus } from 'lucide-react';

export default function Clients({ profile, setViewingClient }) {
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) fetchClients();
  }, [profile]);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('trainer_id', profile.id);
      
    if (!error && data) {
      setPending(data.filter(c => c.trainer_status === 'pending'));
      setActive(data.filter(c => c.trainer_status === 'accepted'));
    }
    setLoading(false);
  };

  const handleAction = async (clientId, statusAction) => {
    // statusAction is 'accepted', 'none', etc.
    const updates = statusAction === 'none' 
        ? { trainer_id: null, trainer_status: 'none' } 
        : { trainer_status: statusAction };

    const { error } = await supabase.from('profiles').update(updates).eq('id', clientId);
    if (!error) {
      fetchClients();
    } else {
      alert("Error updating client status.");
    }
  };

  if(!profile?.is_trainer && profile?.username?.toLowerCase() !== 'admin') {
     return <div>You are not registered as a Coach/Trainer.</div>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="glass-panel">
        <h2 className="text-neon-blue mb-4">Pending Requests</h2>
        {pending.length === 0 ? <p className="text-secondary text-sm">No pending client requests.</p> : (
          <div className="flex flex-col gap-2">
            {pending.map(c => (
              <div key={c.id} className="flex justify-between items-center bg-black border border-gray-800 p-3 rounded" style={{ borderColor: 'var(--border-subtle)' }}>
                <span>{c.username}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(c.id, 'accepted')} className="btn-secondary text-neon-green" style={{ borderColor: 'var(--neon-green)', padding: '0.4rem 0.8rem' }}>
                    <UserCheck size={16} className="inline mr-1" /> Accept
                  </button>
                  <button onClick={() => handleAction(c.id, 'none')} className="btn-secondary" style={{ color: 'tomato', padding: '0.4rem 0.8rem' }}>
                    <UserX size={16} className="inline mr-1" /> Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel">
        <h2 className="text-neon mb-4">Active Clients</h2>
        {active.length === 0 ? <p className="text-secondary text-sm">No active clients yet.</p> : (
          <div className="flex flex-col gap-2">
            {active.map(c => (
              <div key={c.id} className="flex justify-between items-center bg-black border border-gray-800 p-3 rounded" style={{ borderColor: 'var(--border-subtle)' }}>
                <span>{c.username}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (setViewingClient) {
                        setViewingClient({ id: c.id, username: c.username, theme_color: c.theme_color });
                      }
                      navigate(`/client/${c.id}`);
                    }}
                    className="btn-primary"
                    style={{ padding: '0.4rem 0.8rem', width: 'auto' }}
                  >
                    View Log
                  </button>
                  <button onClick={() => { if(confirm(`Remove ${c.username} from your clients?`)) handleAction(c.id, 'none'); }} className="btn-secondary" style={{ color: 'tomato', padding: '0.4rem 0.8rem' }}>
                    <UserMinus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
