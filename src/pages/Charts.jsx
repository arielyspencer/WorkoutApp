import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { calculateOneRepMax } from '../lib/1rm';
import { useNavigate } from 'react-router-dom';

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

/** Darken a hex colour by factor (0–1, 1 = fully black). */
function darkenHex(hex, factor = 0.5) {
  const clean = (hex || '#39ff14').replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `#${Math.round(r * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(g * (1 - factor)).toString(16).padStart(2, '0')}${Math.round(b * (1 - factor)).toString(16).padStart(2, '0')}`;
}

/** Hex with alpha channel appended (e.g. "#39ff1422") */
function hexAlpha(hex, alpha = 0.13) {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${(hex || '#39ff14')}${a}`;
}

/**
 * Returns ISO week number and year key: "2026-W14"
 */
function isoWeekKey(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (isNaN(d)) return 'Unknown';
  // ISO week: Monday=1 ... Sunday=7
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diffMs = d - startOfWeek1;
  const weekNum = Math.floor(diffMs / (7 * 24 * 3600 * 1000)) + 1;
  const year = d.getFullYear();
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/** Format week key for display: "2026-W14" → "Wk 14 '26" */
function formatWeekLabel(key) {
  if (!key || key === 'Unknown') return key;
  const [year, wPart] = key.split('-');
  const wNum = wPart.replace('W', '');
  return `Wk ${wNum} '${year.slice(2)}`;
}

export default function Charts({ profile, viewingClient, setViewingClient }) {
  const navigate = useNavigate();

  const isCoach = profile?.is_trainer || profile?.username?.toLowerCase() === 'admin';

  // The athlete whose data we chart = viewingClient (if set) or self
  const targetProfileId = (isCoach && viewingClient) ? viewingClient.id : profile?.id;
  const themeColor = profile?.theme_color || '#39ff14';

  const [clients, setClients] = useState([]);
  const [exerciseList, setExerciseList] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cache workouts so switching exercises doesn't re-fetch
  const workoutsCache = useRef(null);
  const lastProfileId = useRef(null);

  // Fetch coach's accepted clients
  useEffect(() => {
    if (isCoach && profile?.id) {
      (async () => {
        const { data } = await supabase
          .from('profiles')
          .select('id, username, theme_color')
          .eq('trainer_id', profile.id)
          .eq('trainer_status', 'accepted');
        if (data) setClients(data);
      })();
    }
  }, [isCoach, profile?.id]);

  // Re-fetch when the targeted athlete changes (viewingClient or self)
  useEffect(() => {
    if (targetProfileId && targetProfileId !== lastProfileId.current) {
      lastProfileId.current = targetProfileId;
      workoutsCache.current = null;
      setSelectedExercise('');
      setChartData(null);
      fetchData(targetProfileId, null);
    }
  }, [targetProfileId]);

  const fetchData = async (profileId, targetExercise) => {
    setLoading(true);

    // Use cache if we already have data for this profile
    if (!workoutsCache.current) {
      const { data: userWeeks } = await supabase
        .from('weeks')
        .select('id')
        .eq('profile_id', profileId);

      if (!userWeeks || userWeeks.length === 0) {
        setExerciseList([]);
        setChartData(null);
        setLoading(false);
        return;
      }

      const weekIds = userWeeks.map(w => w.id);
      const { data: workouts } = await supabase
        .from('workouts')
        .select('id, date, completed, workout_exercises(exercise_name, sets(completed, calculated_1rm, weight, reps, rpe))')
        .in('week_id', weekIds)
        .order('date', { ascending: true });

      workoutsCache.current = workouts || [];
    }

    const workouts = workoutsCache.current;
    if (!workouts.length) {
      setExerciseList([]);
      setChartData(null);
      setLoading(false);
      return;
    }

    // Build sorted exercise list
    const names = new Set();
    workouts.forEach(w => w.workout_exercises.forEach(we => names.add(we.exercise_name)));
    const sorted = Array.from(names).sort((a, b) => a.localeCompare(b));
    setExerciseList(sorted);

    const exercise = targetExercise || sorted[0] || null;
    if (!exercise) { setChartData(null); setLoading(false); return; }
    if (!targetExercise) setSelectedExercise(exercise);

    buildChart(workouts, exercise);
    setLoading(false);
  };

  /**
   * Aggregate by ISO week.
   * Each week bucket: { actual: number[], planned: number[], hasActual: bool }
   * "actual" = completed sets with calculated_1rm
   * "planned" = incomplete sets with enough data to compute potential 1RM
   *
   * A week is "actual" if ANY set in it was done.
   * A week is "planned" if ALL sets with data are not-done.
   * If mixed, we treat the week as "actual" (progress happened).
   */
  const buildChart = (workouts, targetExercise) => {
    // Map: weekKey → { sums: number[], count: number, hasActual: boolean }
    const byWeek = {};

    workouts.forEach(w => {
      const weekKey = isoWeekKey(w.date);
      w.workout_exercises
        .filter(we => we.exercise_name === targetExercise)
        .forEach(ex => {
          ex.sets.forEach(s => {
            if (!byWeek[weekKey]) byWeek[weekKey] = { values: [], isActual: false };

            if (s.completed && s.calculated_1rm) {
              byWeek[weekKey].values.push(Number(s.calculated_1rm));
              byWeek[weekKey].isActual = true;
            } else {
              // Potential 1RM from planned data
              const wt = parseFloat(s.weight) || 0;
              const rp = parseInt(s.reps) || 0;
              const rpe = s.rpe || '8';
              if (wt > 0 && rp > 0) {
                const potential = calculateOneRepMax(wt, rp, rpe);
                if (potential) byWeek[weekKey].values.push(Number(potential));
              }
            }
          });
        });
    });

    const weekKeys = Object.keys(byWeek).sort();
    if (weekKeys.length === 0) { setChartData(null); return; }

    const labels = weekKeys.map(formatWeekLabel);

    // Per-point values and metadata
    const avgValues = []; // one average 1RM per week
    const isActualArr = []; // true = done, false = projected

    weekKeys.forEach(key => {
      const { values, isActual } = byWeek[key];
      const avg = values.length
        ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
        : null;
      avgValues.push(avg);
      isActualArr.push(isActual);
    });

    const mutedColor = darkenHex(themeColor, 0.5);

    /**
     * SEGMENT DIMMING STRATEGY
     * Chart.js Line doesn't natively dim segments. We implement this by:
     * 1. Building TWO datasets that share the same label space.
     * 2. Dataset A (actual solid line): only keeps values where the segment IS "actual".
     *    A segment is "actual" if BOTH its endpoints are actual.
     *    Gaps (null) cause Chart.js to skip, so we null out planned-only points.
     * 3. Dataset B (projected dashed line): only keeps values where the segment leads into a projected point.
     *    Includes the last actual anchor point before a projected stretch so the line connects.
     */

    // Actual dataset: show point+line only for actual weeks
    // If a week is planned, set null (gap)
    const actualData = avgValues.map((v, i) => isActualArr[i] ? v : null);

    // Projected dataset: show point+line for planned weeks, PLUS the last actual point before each planned stretch
    const projectedData = avgValues.map((v, i) => {
      if (!isActualArr[i]) return v; // projected point: always include
      // Is the NEXT point projected? If so include this actual point as an anchor
      if (i < avgValues.length - 1 && !isActualArr[i + 1]) return v;
      return null; // actual-to-actual transition: handled by dataset A
    });

    const hasActual = actualData.some(v => v !== null);
    const hasProjected = projectedData.some(v => v !== null);

    const datasets = [];

    if (hasActual) {
      datasets.push({
        label: `Avg 1RM – ${targetExercise}`,
        data: actualData,
        borderColor: themeColor,
        backgroundColor: hexAlpha(themeColor, 0.12),
        borderWidth: 2.5,
        tension: 0.3,
        pointBackgroundColor: actualData.map(v => v !== null ? themeColor : 'transparent'),
        pointRadius: actualData.map(v => v !== null ? 5 : 0),
        spanGaps: false,
      });
    }

    if (hasProjected) {
      datasets.push({
        label: `Projected 1RM – ${targetExercise}`,
        data: projectedData,
        borderColor: mutedColor,
        backgroundColor: hexAlpha(mutedColor, 0.08),
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.3,
        // Anchor points (actual week bridging into a projected week) are transparent;
        // only genuine projected-week points get the muted dot.
        pointBackgroundColor: projectedData.map((v, i) =>
          v !== null && !isActualArr[i] ? mutedColor : 'transparent'
        ),
        pointRadius: projectedData.map((v, i) => v !== null && !isActualArr[i] ? 4 : 0),
        spanGaps: false,
      });
    }

    setChartData({ labels, datasets });
  };

  const handleExerciseChange = (newExercise) => {
    setSelectedExercise(newExercise);
    buildChart(workoutsCache.current || [], newExercise);
  };

  const handleClientSelectorChange = (newId) => {
    if (newId === profile.id) {
      setViewingClient(null);
    } else {
      const found = clients.find(c => c.id === newId);
      if (found) setViewingClient({ id: found.id, username: found.username, theme_color: found.theme_color });
    }
    workoutsCache.current = null;
    lastProfileId.current = null;
  };

  return (
    <div className="glass-panel">
      <h2 style={{ margin: '0 0 1.25rem' }}>Trend Charts</h2>

      {/* Coach: athlete selector (supplements global banner) */}
      {isCoach && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="text-sm text-secondary" style={{ display: 'block', marginBottom: '0.4rem' }}>
            Viewing data for:
          </label>
          <select
            value={targetProfileId}
            onChange={e => handleClientSelectorChange(e.target.value)}
            style={{ maxWidth: '280px' }}
          >
            <option value={profile.id}>{profile.username} (You)</option>
            {[...clients].sort((a, b) => a.username.localeCompare(b.username)).map(c => (
              <option key={c.id} value={c.id}>{c.username}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-secondary" style={{ textAlign: 'center' }}>Loading data...</p>
      ) : (
        <>
          {exerciseList.length === 0 ? (
            <p className="text-secondary" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
              No workout data logged yet for this athlete.
            </p>
          ) : (
            <>
              <select
                value={selectedExercise}
                onChange={e => handleExerciseChange(e.target.value)}
                style={{ marginBottom: '1.5rem', maxWidth: '340px', display: 'block' }}
              >
                {exerciseList.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              {chartData && chartData.datasets.length > 0 ? (
                <div style={{ position: 'relative', height: '400px', width: '100%' }}>
                  <Line
                    data={chartData}
                    options={{
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: false,
                          grid: { color: '#2a2a2a' },
                          ticks: { color: '#f0f0f0' },
                          title: { display: true, text: 'Avg Est. 1RM (kg)', color: '#9ca3af' }
                        },
                        x: {
                          grid: { color: '#2a2a2a' },
                          ticks: { color: '#f0f0f0' }
                        }
                      },
                      plugins: {
                        legend: { labels: { color: '#f0f0f0' } },
                        tooltip: {
                          callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y + ' kg' : '—'}`
                          }
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <p className="text-secondary" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                  Not enough data to render a chart yet.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
