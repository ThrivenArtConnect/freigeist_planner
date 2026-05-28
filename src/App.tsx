import React, { useEffect, useRef, useState } from 'react';

export type DayTask = {
  id: string;
  label: string;
  done: boolean;
};

export type DayRecord = {
  date: string;
  tasks: { label: string; done: boolean }[];
};

const STORAGE_KEY = 'freigeist-planner-v1';
const HISTORY_KEY = 'freigeist-history-v1';
const REMINDER_KEY = 'freigeist-reminder-v1';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function loadState(): DayTask[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveState(t: DayTask[]) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch {} }

function loadHistory(): DayRecord[] {
  try { const r = localStorage.getItem(HISTORY_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveHistory(h: DayRecord[]) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {} }

function loadReminderTime(): string {
  try { return localStorage.getItem(REMINDER_KEY) || '08:00'; } catch { return '08:00'; }
}
function saveReminderTime(t: string) { try { localStorage.setItem(REMINDER_KEY, t); } catch {} }

function recordDay(tasks: DayTask[], history: DayRecord[]): DayRecord[] {
  const today = todayStr();
  const entry: DayRecord = { date: today, tasks: tasks.map(t => ({ label: t.label, done: t.done })) };
  return [...history.filter(r => r.date !== today), entry];
}

function calcStreak(history: DayRecord[]): number {
  const dates = history.filter(r => r.tasks.some(t => t.done)).map(r => r.date).sort().reverse();
  if (!dates.length) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const diff = Math.round((today.getTime() - new Date(dates[i]).getTime()) / 86400000);
    if (diff === i || (i === 0 && diff <= 1)) streak++;
    else break;
  }
  return streak;
}

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstWeekday(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

type View = 'planner' | 'tracker' | 'settings';

// ── Fokus-Timer ──────────────────────────────────────────
const FOCUS_MINS = 25;

function FokusOverlay({ onExit }: { onExit: () => void }) {
  const [secs, setSecs] = useState(FOCUS_MINS * 60);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setSecs(s => {
        if (s <= 1) { clearInterval(ref.current!); setRunning(false); return 0; }
        return s - 1;
      }), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const pct = ((FOCUS_MINS * 60 - secs) / (FOCUS_MINS * 60)) * 100;

  return (
    <div className="fokus-overlay">
      <div className="fokus-card">
        <div className="fokus-label">🎯 FOKUS MODUS</div>
        <div className="fokus-timer">{mm}:{ss}</div>
        <div className="fokus-bar"><div className="fokus-bar-fill" style={{ width: `${pct}%` }} /></div>
        <div className="fokus-actions">
          <button className="fokus-btn primary" onClick={() => setRunning(r => !r)}>
            {running ? '⏸ Pause' : secs === FOCUS_MINS * 60 ? '▶ Starten' : '▶ Weiter'}
          </button>
          <button className="fokus-btn" onClick={() => { setSecs(FOCUS_MINS * 60); setRunning(false); }}>↺ Reset</button>
          <button className="fokus-btn danger" onClick={onExit}>✕ Beenden</button>
        </div>
        <div className="fokus-tip">📵 Handy weg. Alle Ablenkungen aus. Nur dieser Task zählt.</div>
      </div>
    </div>
  );
}

// ── Morning Reminder Popup ──────────────────────────────
function ReminderPopup({ onClose, onOpen }: { onClose: () => void; onOpen: () => void }) {
  return (
    <div className="reminder-overlay" onClick={onClose}>
      <div className="reminder-card" onClick={e => e.stopPropagation()}>
        <div className="reminder-emoji">☀️</div>
        <div className="reminder-title">Guten Morgen, Freigeist!</div>
        <div className="reminder-body">Zeit für deine <strong>3 Big Things</strong>.<br />Was zählt heute wirklich?</div>
        <div className="reminder-actions">
          <button className="fokus-btn primary" onClick={onOpen}>✏️ Jetzt eintragen</button>
          <button className="fokus-btn" onClick={onClose}>Später</button>
        </div>
      </div>
    </div>
  );
}

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<DayTask[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<DayRecord[]>([]);
  const [view, setView] = useState<View>('planner');
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Fokus
  const [fokusActive, setFokusActive] = useState(false);

  // Reminder
  const [reminderTime, setReminderTime] = useState('08:00');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const reminderRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFiredRef = useRef<string>('');

  useEffect(() => {
    setTasks(loadState());
    setHistory(loadHistory());
    setReminderTime(loadReminderTime());
    if ('Notification' in window) setNotifPerm(Notification.permission);
  }, []);

  useEffect(() => { saveState(tasks); }, [tasks]);
  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => { saveReminderTime(reminderTime); }, [reminderTime]);

  // Reminder tick – check every 30s
  useEffect(() => {
    if (!reminderEnabled) { if (reminderRef.current) clearInterval(reminderRef.current); return; }
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const todayKey = todayStr() + hhmm;
      if (hhmm === reminderTime && lastFiredRef.current !== todayKey) {
        lastFiredRef.current = todayKey;
        // Browser notification
        if (notifPerm === 'granted') {
          new Notification('☀️ Freigeist – Guten Morgen!', {
            body: 'Was sind deine 3 Big Things für heute?',
            icon: '/apple-touch-icon.png',
          });
        }
        // In-App popup
        setShowReminderPopup(true);
      }
    };
    check();
    reminderRef.current = setInterval(check, 30000);
    return () => { if (reminderRef.current) clearInterval(reminderRef.current); };
  }, [reminderEnabled, reminderTime, notifPerm]);

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  const toggleReminder = async () => {
    if (!reminderEnabled && notifPerm !== 'granted') {
      await requestNotifPermission();
    }
    setReminderEnabled(e => !e);
  };

  const addTask = () => {
    const label = input.trim();
    if (!label) return;
    if (tasks.length >= 3) { alert('Maximal 3 Tagesprioritäten.'); return; }
    setTasks([...tasks, { id: Date.now().toString(), label, done: false }]);
    setInput('');
  };

  const toggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(updated);
    setHistory(recordDay(updated, history));
  };

  const clearTasks = () => {
    if (!window.confirm('Tagesliste wirklich zurücksetzen?')) return;
    setTasks([]);
  };

  const doneCount = tasks.filter(t => t.done).length;
  const streak = calcStreak(history);
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstWeekday = getFirstWeekday(calYear, calMonth);
  const historyMap = Object.fromEntries(history.map(r => [r.date, r]));
  const today = todayStr();

  function dayKey(day: number) {
    return `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function dayStatus(day: number): 'full' | 'partial' | 'none' | 'empty' {
    const rec = historyMap[dayKey(day)];
    if (!rec || !rec.tasks.length) return 'empty';
    const done = rec.tasks.filter(t => t.done).length;
    if (done === rec.tasks.length) return 'full';
    if (done > 0) return 'partial';
    return 'none';
  }

  const monthNames = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const selectedRecord = selectedDay ? historyMap[selectedDay] : null;

  return (
    <>
      {fokusActive && <FokusOverlay onExit={() => setFokusActive(false)} />}
      {showReminderPopup && (
        <ReminderPopup
          onClose={() => setShowReminderPopup(false)}
          onOpen={() => { setShowReminderPopup(false); setView('planner'); }}
        />
      )}

      <div className="app-root">
        <aside className="sidebar">
          <h1>Freigeist Planner</h1>
          <div className="tagline">ADHS-taugliches Minimal-Board für deinen Tag.</div>

          <div className="nav-section-title">Heute</div>
          <div className={`nav-item${view==='planner'?' active':''}`} onClick={() => setView('planner')}>
            <span className="nav-dot" /><span>Daily Big 3</span>
          </div>

          <div className="nav-section-title">Verlauf</div>
          <div className={`nav-item${view==='tracker'?' active':''}`} onClick={() => setView('tracker')}>
            <span>🏆</span><span>Erfolgs-Tracker</span>
          </div>

          <div className="nav-section-title">Tools</div>
          <div className="nav-item" style={{cursor:'default'}}>
            <span>🎯</span>
            <span style={{flex:1}}>Fokus-Modus</span>
            <button
              className={`toggle-btn${fokusActive?' on':''}`}
              onClick={() => setFokusActive(f => !f)}
              aria-label="Fokus-Modus umschalten"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="nav-item" style={{cursor:'default'}}>
            <span>⏰</span>
            <span style={{flex:1}}>Wecker</span>
            <button
              className={`toggle-btn${reminderEnabled?' on':''}`}
              onClick={toggleReminder}
              aria-label="Wecker umschalten"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {reminderEnabled && (
            <div className="reminder-time-row">
              <span style={{fontSize:11,color:'var(--text-muted)'}}>Uhrzeit</span>
              <input
                type="time"
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
                className="time-input"
              />
            </div>
          )}

          {notifPerm === 'denied' && (
            <div className="notif-warn">⚠️ Benachrichtigungen blockiert – in Safari-Einstellungen freischalten.</div>
          )}

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
                    <button
                      className={`pill fokus-pill${fokusActive?' active':''}`}
                      onClick={() => setFokusActive(f => !f)}
                    >
                      {fokusActive ? '🎯 Fokus AN' : '🎯 Fokus starten'}
                    </button>
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
                <div className="streak-inline">🔥 <strong>{streak}</strong> Tag{streak !== 1 ? 'e' : ''} Streak</div>
              </header>
              <div className="legend-row">
                <span className="legend-dot full" /> Alle erledigt
                <span className="legend-dot partial" /> Teils erledigt
                <span className="legend-dot none" /> Nichts erledigt
              </div>
              <div className="cal-nav">
                <button className="cal-nav-btn" onClick={() => { if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }}>‹</button>
                <span className="cal-nav-label">{monthNames[calMonth]} {calYear}</span>
                <button className="cal-nav-btn" onClick={() => { if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }}>›</button>
              </div>
              <div className="cal-grid">
                {['Mo','Di','Mi','Do','Fr','Sa','So'].map(d => <div key={d} className="cal-weekday">{d}</div>)}
                {Array.from({length:firstWeekday}).map((_,i) => <div key={`e${i}`} className="cal-day empty" />)}
                {Array.from({length:daysInMonth}).map((_,i) => {
                  const day = i+1, key = dayKey(day), status = dayStatus(day), isToday = key===today;
                  return (
                    <button key={day} className={`cal-day ${status}${isToday?' today':''}${selectedDay===key?' selected':''}`}
                      onClick={() => setSelectedDay(selectedDay===key?null:key)}>
                      <span className="cal-day-num">{day}</span>
                      {status!=='empty' && (
                        <span className="cal-day-dots">
                          {historyMap[key]?.tasks.map((t,ti) => <span key={ti} className={`cal-dot ${t.done?'done':'open'}`} />)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <div className="day-detail card">
                  <div className="card-title">{new Date(selectedDay+'T12:00:00').toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'})}</div>
                  {selectedRecord ? (
                    <div className="list">
                      {selectedRecord.tasks.map((t,i) => (
                        <div key={i} className={`list-item${t.done?' done':''}`}>
                          <span className="task-icon">{t.done?'✅':'⬜'}</span>
                          <span className="list-item-label">{t.label}</span>
                        </div>
                      ))}
                      <div className="list-item-meta" style={{marginTop:6}}>{selectedRecord.tasks.filter(t=>t.done).length}/{selectedRecord.tasks.length} erledigt</div>
                    </div>
                  ) : <div className="list-item-meta">Kein Eintrag für diesen Tag.</div>}
                </div>
              )}
              <div className="stats-row">
                {(() => {
                  const mr = history.filter(r=>r.date.startsWith(`${calYear}-${String(calMonth+1).padStart(2,'0')}`));
                  return (
                    <>
                      <div className="stat-card"><div className="stat-num">{mr.length}</div><div className="stat-label">Aktive Tage</div></div>
                      <div className="stat-card"><div className="stat-num">{mr.filter(r=>r.tasks.length>0&&r.tasks.every(t=>t.done)).length}</div><div className="stat-label">Volle Big-3-Tage</div></div>
                      <div className="stat-card"><div className="stat-num">{mr.reduce((a,r)=>a+r.tasks.filter(t=>t.done).length,0)}</div><div className="stat-label">Tasks erledigt</div></div>
                      <div className="stat-card"><div className="stat-num">🔥{streak}</div><div className="stat-label">Streak</div></div>
                    </>
                  );
                })()}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
};
