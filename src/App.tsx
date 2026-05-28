import React, { useEffect, useState } from 'react';

export type DayTask = {
  id: string;
  label: string;
  done: boolean;
};

export type DayRecord = {
  date: string; // 'YYYY-MM-DD'
  tasks: { label: string; done: boolean }[];
};

const STORAGE_KEY = 'freigeist-planner-v1';
const HISTORY_KEY = 'freigeist-history-v1';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function loadState(): DayTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveState(tasks: DayTask[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
}

function loadHistory(): DayRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveHistory(history: DayRecord[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
}

function recordDay(tasks: DayTask[], history: DayRecord[]): DayRecord[] {
  const today = todayStr();
  const entry: DayRecord = { date: today, tasks: tasks.map(t => ({ label: t.label, done: t.done })) };
  const filtered = history.filter(r => r.date !== today);
  return [...filtered, entry];
}

function calcStreak(history: DayRecord[]): number {
  const withDone = history.filter(r => r.tasks.some(t => t.done));
  const dates = withDone.map(r => r.date).sort().reverse();
  if (!dates.length) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i]);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff === i || (i === 0 && diff <= 1)) streak++;
    else break;
  }
  return streak;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number) {
  let d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0
}

type View = 'planner' | 'tracker';

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<DayTask[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<DayRecord[]>([]);
  const [view, setView] = useState<View>('planner');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    setTasks(loadState());
    setHistory(loadHistory());
  }, []);

  useEffect(() => { saveState(tasks); }, [tasks]);
  useEffect(() => { saveHistory(history); }, [history]);

  const addTask = () => {
    const label = input.trim();
    if (!label) return;
    if (tasks.length >= 3) {
      alert('Maximal 3 Tagesprioritäten.');
      return;
    }
    setTasks([...tasks, { id: Date.now().toString(), label, done: false }]);
    setInput('');
  };

  const toggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(updated);
    const newHistory = recordDay(updated, history);
    setHistory(newHistory);
  };

  const clearTasks = () => {
    if (!window.confirm('Tagesliste wirklich zurücksetzen?')) return;
    setTasks([]);
  };

  const doneCount = tasks.filter(t => t.done).length;
  const streak = calcStreak(history);

  // Calendar helpers
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstWeekday = getFirstWeekday(calYear, calMonth);
  const historyMap = Object.fromEntries(history.map(r => [r.date, r]));

  function dayKey(day: number) {
    return `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  function dayStatus(day: number): 'full' | 'partial' | 'none' | 'empty' {
    const key = dayKey(day);
    const rec = historyMap[key];
    if (!rec || !rec.tasks.length) return 'empty';
    const done = rec.tasks.filter(t => t.done).length;
    if (done === rec.tasks.length) return 'full';
    if (done > 0) return 'partial';
    return 'none';
  }

  const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const selectedRecord = selectedDay ? historyMap[selectedDay] : null;
  const today = todayStr();

  return (
    <div className="app-root">
      <aside className="sidebar">
        <h1>Freigeist Planner</h1>
        <div className="tagline">ADHS-taugliches Minimal-Board für deinen Tag.</div>

        <div className="nav-section-title">Heute</div>
        <div className={`nav-item${view==='planner'?' active':''}`} onClick={() => setView('planner')}>
          <span className="nav-dot" />
          <span>Daily Big 3</span>
        </div>

        <div className="nav-section-title">Verlauf</div>
        <div className={`nav-item${view==='tracker'?' active':''}`} onClick={() => setView('tracker')}>
          <span>🏆</span>
          <span>Erfolgs-Tracker</span>
        </div>

        <div className="nav-section-title">Später</div>
        <div className="nav-item"><span>⚡ Quick Capture</span></div>
        <div className="nav-item"><span>♻ Routinen</span></div>
        <div className="nav-item"><span>🎧 Musik / Projekte</span></div>

        {streak > 0 && (
          <div className="streak-badge">🔥 {streak} Tag{streak !== 1 ? 'e' : ''} in Folge</div>
        )}
      </aside>

      <main className="main">
        {view === 'planner' && (
          <>
            <header className="main-header">
              <div>
                <div className="main-header-title">Dein Tag als Freigeist</div>
                <div className="main-header-subtitle">Maximal 3 echte Prioritäten. Alles andere ist Bonus.</div>
                <div className="pill-row">
                  <div className="pill">ADHS-freundlich</div>
                  <div className="pill">lokal gespeichert</div>
                  <div className="pill">später erweiterbar</div>
                </div>
              </div>
              <div className="pill">{doneCount}/{tasks.length || 3} erledigt</div>
            </header>

            <section className="card-row">
              <section className="card">
                <div className="card-title">Daily Big 3</div>
                <div className="card-subtitle">Was muss passieren, damit sich heute nach Fortschritt anfühlt?</div>
                <div className="list">
                  {tasks.map(task => (
                    <label key={task.id} className={`list-item${task.done?' done':''}`}>
                      <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                      <div className="list-item-label">
                        {task.label}
                        <div className="list-item-meta">{task.done ? '✓ fertig' : 'offen'}</div>
                      </div>
                    </label>
                  ))}
                  {tasks.length === 0 && (
                    <div className="list-item-meta">Noch nichts drin. Was wäre die eine Sache, die heute zählt?</div>
                  )}
                </div>
                <div className="input-row">
                  <input
                    placeholder="Neue Priorität ..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
                  />
                  <button onClick={addTask}>+ Add</button>
                </div>
                <div className="list-item-meta" style={{ marginTop: 8 }}>
                  Max 3.
                  <button className="link-btn" onClick={clearTasks}>Zurücksetzen</button>
                </div>
              </section>

              <section className="card">
                <div className="card-title">Anker & Ideen</div>
                <div className="card-subtitle">Deine Regeln für den Alltag.</div>
                <div className="chip-row">
                  <div className="chip">☕ Nach dem Aufstehen: 3 Dinge wählen</div>
                  <div className="chip">🎧 Erst Alltag, dann Musik</div>
                  <div className="chip">🧾 5-Minuten-Regel für Papierkram</div>
                  <div className="chip">📵 Fokusmodus für Sessions</div>
                  <div className="chip">👥 Freundetage ohne schlechtes Gewissen</div>
                </div>
              </section>
            </section>
          </>
        )}

        {view === 'tracker' && (
          <>
            <header className="main-header">
              <div>
                <div className="main-header-title">Erfolgs-Tracker</div>
                <div className="main-header-subtitle">Deine abgeschlossenen Big 3 auf einen Blick.</div>
              </div>
              <div className="streak-inline">
                🔥 <strong>{streak}</strong> Tag{streak !== 1 ? 'e' : ''} Streak
              </div>
            </header>

            {/* Legend */}
            <div className="legend-row">
              <span className="legend-dot full" /> Alle erledigt
              <span className="legend-dot partial" /> Teils erledigt
              <span className="legend-dot none" /> Nichts erledigt
            </div>

            {/* Calendar Nav */}
            <div className="cal-nav">
              <button className="cal-nav-btn" onClick={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); }
                else setCalMonth(m => m-1);
              }}>‹</button>
              <span className="cal-nav-label">{monthNames[calMonth]} {calYear}</span>
              <button className="cal-nav-btn" onClick={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); }
                else setCalMonth(m => m+1);
              }}>›</button>
            </div>

            {/* Calendar Grid */}
            <div className="cal-grid">
              {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => (
                <div key={d} className="cal-weekday">{d}</div>
              ))}
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`e${i}`} className="cal-day empty" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = dayKey(day);
                const status = dayStatus(day);
                const isToday = key === today;
                return (
                  <button
                    key={day}
                    className={`cal-day ${status} ${isToday ? 'today' : ''} ${selectedDay === key ? 'selected' : ''}`}
                    onClick={() => setSelectedDay(selectedDay === key ? null : key)}
                  >
                    <span className="cal-day-num">{day}</span>
                    {status !== 'empty' && (
                      <span className="cal-day-dots">
                        {historyMap[key]?.tasks.map((t, ti) => (
                          <span key={ti} className={`cal-dot ${t.done ? 'done' : 'open'}`} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Day Detail */}
            {selectedDay && (
              <div className="day-detail card">
                <div className="card-title">
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                {selectedRecord ? (
                  <div className="list">
                    {selectedRecord.tasks.map((t, i) => (
                      <div key={i} className={`list-item${t.done ? ' done' : ''}`}>
                        <span className="task-icon">{t.done ? '✅' : '⬜'}</span>
                        <span className="list-item-label">{t.label}</span>
                      </div>
                    ))}
                    <div className="list-item-meta" style={{marginTop:6}}>
                      {selectedRecord.tasks.filter(t=>t.done).length}/{selectedRecord.tasks.length} erledigt
                    </div>
                  </div>
                ) : (
                  <div className="list-item-meta">Kein Eintrag für diesen Tag.</div>
                )}
              </div>
            )}

            {/* Monthly Stats */}
            <div className="stats-row">
              {(() => {
                const monthRecords = history.filter(r => r.date.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`));
                const totalDays = monthRecords.length;
                const fullDays = monthRecords.filter(r => r.tasks.length > 0 && r.tasks.every(t => t.done)).length;
                const totalTasks = monthRecords.reduce((a, r) => a + r.tasks.filter(t => t.done).length, 0);
                return (
                  <>
                    <div className="stat-card">
                      <div className="stat-num">{totalDays}</div>
                      <div className="stat-label">Aktive Tage</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-num">{fullDays}</div>
                      <div className="stat-label">Volle Big-3-Tage</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-num">{totalTasks}</div>
                      <div className="stat-label">Tasks erledigt</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-num">🔥{streak}</div>
                      <div className="stat-label">Streak</div>
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        )}
      </main>
    </div>
  );
};
