import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Dashboard from './Dashboard';
import { ArrowLeft } from 'lucide-react';

export default function ClientDashboard({ trainerProfile }) {
  const { id } = useParams();
  const [clientProfile, setClientProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorDesc, setErrorDesc] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchClient();
  }, [id]);

  const fetchClient = async () => {
    setLoading(true);
    const { data: client, error } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (error || !client) {
      setErrorDesc("Client not found.");
      setLoading(false);
      return;
    }

    // Safety check - is this user actually authorized to view this profile?
    if (trainerProfile?.username?.toLowerCase() !== 'admin' && client.trainer_id !== trainerProfile?.id) {
      setErrorDesc("You do not have permission to view this client's log.");
      setLoading(false);
      return;
    }

    setClientProfile(client);
    setLoading(false);
  };

  if (loading) return <div>Loading Client Data...</div>;
  if (errorDesc) return <div className="text-red-500">{errorDesc}</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate('/clients')} className="btn-secondary" style={{ padding: '0.4rem', border: 'none' }}>
           <ArrowLeft size={18} />
        </button>
        <h2 className="m-0 text-neon-blue">Viewing Client: {clientProfile.username}</h2>
      </div>
      <div className="opacity-90">
        <Dashboard profile={clientProfile} isTrainerMode={true} />
      </div>
    </div>
  );
}
