import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calculateOneRepMax } from '../lib/1rm';

// Components required: react-chartjs-2, chart.js
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function Charts({ profile }) {
  const [exerciseList, setExerciseList] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch user's exercises they've actually performed
    const fetchPerformedExercises = async () => {
      // For simplicity out of the box in Supabase, we fetch workouts -> exercises
      // and aggregate locally.
      if (!profile) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          date,
          workout_exercises!inner (
            exercise_name,
            sets (
              calculated_1rm
            )
          )
        `)
        // we can filter through a view normally, but we fetch all user workouts for charts
        .eq('week_id.profile_id', profile.id) // note: requires fkey relation, we'll fetch all workouts and filter JS
      
      // Since inner join on foreign keys can be tricky:
      const { data: userWeeks } = await supabase.from('weeks').select('id').eq('profile_id', profile.id);
      if(userWeeks) {
        const weekIds = userWeeks.map(w => w.id);
        const { data: workouts } = await supabase
          .from('workouts')
          .select('date, workout_exercises(exercise_name, sets(calculated_1rm))')
          .in('week_id', weekIds)
          .order('date', { ascending: true });
          
        if(workouts) {
          const names = new Set();
          workouts.forEach(w => {
            w.workout_exercises.forEach(we => names.add(we.exercise_name));
          });
          setExerciseList(Array.from(names));
          
          if(selectedExercise) {
            // Build chart
            buildChart(workouts, selectedExercise);
          } else if(names.size > 0) {
            setSelectedExercise(Array.from(names)[0]);
            buildChart(workouts, Array.from(names)[0]);
          } else {
             setChartData(null);
          }
        }
      }
      setLoading(false);
    };

    fetchPerformedExercises();
  }, [profile, selectedExercise]);

  const buildChart = (workouts, targetExercise) => {
    const dates = [];
    const max1RMs = [];

    workouts.forEach(w => {
      const targetExercisesForWorkout = w.workout_exercises.filter(we => we.exercise_name === targetExercise);
      if(targetExercisesForWorkout.length > 0) {
        let max1rmForDay = 0;
        targetExercisesForWorkout.forEach(ex => {
          ex.sets.forEach(s => {
            if(s.calculated_1rm > max1rmForDay) {
              max1rmForDay = s.calculated_1rm;
            }
          });
        });
        
        if (max1rmForDay > 0) {
          // If multiple workouts on same date, we just push it as is or aggregate.
          dates.push(w.date);
          max1RMs.push(max1rmForDay);
        }
      }
    });

    setChartData({
      labels: dates,
      datasets: [
        {
          label: `Top 1RM: ${targetExercise}`,
          data: max1RMs,
          borderColor: profile.theme_color || '#39ff14',
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          pointBackgroundColor: '#00f3ff', // neon blue
        }
      ]
    });
  };

  return (
    <div className="glass-panel text-center">
      <h2 className="mb-4">Trend Charts</h2>
      {loading ? <p>Loading data...</p> : (
        <>
          {exerciseList.length === 0 ? (
            <p>No workout data logged yet.</p>
          ) : (
            <>
              <select 
                value={selectedExercise} 
                onChange={e => setSelectedExercise(e.target.value)}
                className="mb-6 w-full max-w-sm mx-auto block"
              >
                {exerciseList.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              {chartData && chartData.labels.length > 0 ? (
                <div style={{ position: 'relative', height: '400px', width: '100%' }}>
                  <Line 
                    data={chartData} 
                    options={{ 
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: false,
                          grid: { color: '#2a2a2a' },
                          ticks: { color: '#f0f0f0' }
                        },
                        x: {
                          grid: { color: '#2a2a2a' },
                          ticks: { color: '#f0f0f0' }
                        }
                      },
                      plugins: {
                        legend: { labels: { color: '#f0f0f0' } }
                      }
                    }} 
                  />
                </div>
              ) : (
                <p>Not enough set data to chart.</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
