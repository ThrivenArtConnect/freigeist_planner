import React, { useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────
export type DayTask = { id: string; label: string; done: boolean; };
export type DayRecord = { date: string; tasks: { label: string; done: boolean }[]; };
export type Capture = { id: string; text: string; ts: string; date: string; };
export type RoutineItem = { id: string; label: string; done: boolean; category: 'morgen' | 'abend' | 'custom'; };
export type RoutineDay = { date: string; items: RoutineItem[]; };
export type ProjectStatus = 'idee' | 'inarbeit' | 'fertig' | 'pausiert';
export type ProjectType = 'suno' | 'remix' | 'live' | 'other';
export type Project = { id: string; title: string; type: ProjectType; status: ProjectStatus; note: string; updatedAt: string; createdAt: string; };

// ── Storage Keys ─────────────────────────────────────────
const STORAGE_KEY   = 'freigeist-planner-v1';
const HISTORY_KEY   = 'freigeist-history-v1';
const REMINDER_KEY  = 'freigeist-reminder-v1';
const CAPTURES_KEY  = 'freigeist-captures-v1';
const ROUTINES_KEY  = 'freigeist-routines-v1';
const ROUTINE_CFG_KEY = 'freigeist-routine-config-v1';
const PROJECTS_KEY  = 'freigeist-projects-v1';

// ── Helpers ──────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function load<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function save(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ── Default Routines ─────────────────────────────────────
const DEFAULT_ROUTINES: RoutineItem[] = [
  { id:'r1', label:'Wasser trinken',       category:'morgen', done:false },
  { id:'r2', label:'Bewegung',             category:'morgen', done:false },
  { id:'r3', label:'3 Prioritäten setzen', category:'morgen', done:false },
  { id:'r4', label:'Tages-Rückblick',      category:'abend',  done:false },
  { id:'r5', label:'Morgen vorbereiten',   category:'abend',  done:false },
];

const STATUS_META: Record<ProjectStatus, { emoji: string; label: string; color: string }> = {
  idee:     { emoji:'🟡', label:'Idee',      color:'rgba(250,204,21,0.15)' },
  inarbeit: { emoji:'🔵', label:'In Arbeit', color:'rgba(0,229,255,0.10)' },
  fertig:   { emoji:'🟢', label:'Fertig',    color:'rgba(34,197,94,0.12)' },
  pausiert: { emoji:'⏸',  label:'Pausiert',  color:'rgba(255,255,255,0.04)' },
};

function loadState(): DayTask[]  { return load(STORAGE_KEY, []); }
function saveState(t: DayTask[]) { save(STORAGE_KEY, t); }
function loadHistory(): DayRecord[]  { return load(HISTORY_KEY, []); }
function saveHistory(h: DayRecord[]) { save(HISTORY_KEY, h); }
function loadReminderTime(): string  { return load(REMINDER_KEY, '08:00'); }
function saveReminderTime(t: string) { save(REMINDER_KEY, t); }

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

type View = 'planner' | 'tracker' | 'capture' | 'routines' | 'projects';
const FOCUS_MINS = 25;

// ── SVG Logo ─────────────────────────────────────────────
function FreigeistLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="Freigeist" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="28" rx="8" fill="url(#lg)" />
      <path d="M14 22 C14 22 8 17 8 12 A6 6 0 0 1 20 12 C20 17 14 22 14 22Z" fill="none" stroke="#00e5ff" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="14" cy="12" r="2" fill="#00e5ff" opacity="0.9" />
      <path d="M14 10 L14 6" stroke="#00e5ff" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0d0d18" /><stop offset="1" stopColor="#141428" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Fokus-Timer ───────────────────────────────────────────
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
    } else { if (ref.current) clearInterval(ref.current); }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const pct = ((FOCUS_MINS * 60 - secs) / (FOCUS_MINS * 60)) * 100;
  return (
    <div className="fokus-overlay">
      <div className="fokus-card">
        <div className="fokus-label">⚡ FOKUS MODUS</div>
        <div className="fokus-timer">{mm}:{ss}</div>
        <div className="fokus-bar"><div className="fokus-bar-fill" style={{ width: `${pct}%` }} /></div>
        <div className="fokus-actions">
          <button className="fokus-btn primary" onClick={() => setRunning(r => !r)}>
            {running ? '⏸ Pause' : secs === FOCUS_MINS * 60 ? '▶ Starten' : '▶ Weiter'}
          </button>
          <button className="fokus-btn" onClick={() => { setSecs(FOCUS_MINS * 60); setRunning(false); }}>↺ Reset</button>
          <button className="fokus-btn danger" onClick={onExit}>✕ Beenden</button>
        </div>
        <div className="fokus-tip">📵 Handy weg · Ablenkungen aus · Nur dieser Task zählt.</div>
      </div>
    </div>
  );
}

// ── Morning Reminder Popup ────────────────────────────────
function ReminderPopup({ onClose, onOpen }: { onClose: () => void; onOpen: () => void }) {
  return (
    <div className="reminder-overlay" onClick={onClose}>
      <div className="reminder-card" onClick={e => e.stopPropagation()}>
        <div className="reminder-emoji">☀️</div>
        <div className="reminder-title">Guten Morgen, Karim!</div>
        <div className="reminder-body">Zeit für deine <strong>3 Big Things</strong>.<br />Was zählt heute wirklich?</div>
        <div className="reminder-actions">
          <button className="fokus-btn primary" onClick={onOpen}>✏️ Jetzt eintragen</button>
          <button className="fokus-btn" onClick={onClose}>Später</button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export const App: React.FC = () => {
  // Big 3
  const [tasks, setTasks]       = useState<DayTask[]>([]);
  const [input, setInput]       = useState('');
  const [history, setHistory]   = useState<DayRecord[]>([]);
  const [view, setView]         = useState<View>('planner');
  const [calYear, setCalYear]   = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [fokusActive, setFokusActive] = useState(false);
  const [reminderTime, setReminderTime]       = useState('08:00');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [notifPerm, setNotifPerm]             = useState<NotificationPermission>('default');
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const reminderRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFiredRef = useRef<string>('');

  // Quick Capture
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [capOpen, setCapOpen]   = useState(false);
  const [capText, setCapText]   = useState('');

  // Routinen
  const [routineDay, setRoutineDay]     = useState<RoutineDay>({ date: todayStr(), items: [] });
  const [routineConfig, setRoutineConfig] = useState<RoutineItem[]>([]);
  const [routineAddLabel, setRoutineAddLabel] = useState('');
  const [routineAddCat, setRoutineAddCat]     = useState<'morgen'|'abend'|'custom'>('custom');

  // Projekte
  const [projects, setProjects]             = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [newProject, setNewProject]         = useState<Partial<Project> | null>(null);

  // ── URL params ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('morning') === '1' || params.get('morning') === 'true') setTimeout(() => setShowReminderPopup(true), 600);
    if (params.get('focus') === 'true') setTimeout(() => setFokusActive(true), 600);
    if (params.has('morning') || params.has('focus')) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // ── Load from storage ───────────────────────────────────
  useEffect(() => {
    setTasks(loadState());
    setHistory(loadHistory());
    setReminderTime(loadReminderTime());
    if ('Notification' in window) setNotifPerm(Notification.permission);

    // Captures
    setCaptures(load<Capture[]>(CAPTURES_KEY, []));

    // Routinen config + tages-reset
    const cfg = load<RoutineItem[]>(ROUTINE_CFG_KEY, DEFAULT_ROUTINES);
    setRoutineConfig(cfg);
    const storedDay = load<RoutineDay>(ROUTINES_KEY, { date: '', items: [] });
    const today = todayStr();
    if (storedDay.date === today) {
      setRoutineDay(storedDay);
    } else {
      const fresh: RoutineDay = { date: today, items: cfg.map(r => ({ ...r, done: false })) };
      setRoutineDay(fresh);
      save(ROUTINES_KEY, fresh);
    }

    // Projekte
    setProjects(load<Project[]>(PROJECTS_KEY, []));
  }, []);

  // ── Persist ─────────────────────────────────────────────
  useEffect(() => { saveState(tasks); }, [tasks]);
  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => { saveReminderTime(reminderTime); }, [reminderTime]);
  useEffect(() => { save(CAPTURES_KEY, captures); }, [captures]);
  useEffect(() => { save(ROUTINES_KEY, routineDay); }, [routineDay]);
  useEffect(() => { save(ROUTINE_CFG_KEY, routineConfig); }, [routineConfig]);
  useEffect(() => { save(PROJECTS_KEY, projects); }, [projects]);

  // ── Reminder ────────────────────────────────────────────
  useEffect(() => {
    if (!reminderEnabled) { if (reminderRef.current) clearInterval(reminderRef.current); return; }
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const todayKey = todayStr() + hhmm;
      if (hhmm === reminderTime && lastFiredRef.current !== todayKey) {
        lastFiredRef.current = todayKey;
        if (notifPerm === 'granted') new Notification('☀️ Freigeist – Guten Morgen!', { body: 'Was sind deine 3 Big Things für heute?', icon: '/apple-touch-icon.png' });
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
    if (!reminderEnabled && notifPerm !== 'granted') await requestNotifPermission();
    setReminderEnabled(e => !e);
  };

  // ── Big 3 Actions ────────────────────────────────────────
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
  const clearTasks = () => { if (!window.confirm('Tagesliste wirklich zurücksetzen?')) return; setTasks([]); };

  // ── Quick Capture Actions ────────────────────────────────
  const saveCapture = () => {
    const text = capText.trim();
    if (!text) return;
    const cap: Capture = { id: Date.now().toString(), text, ts: new Date().toISOString(), date: todayStr() };
    setCaptures(prev => [cap, ...prev]);
    setCapText('');
    setCapOpen(false);
  };
  const deleteCapture = (id: string) => setCaptures(prev => prev.filter(c => c.id !== id));
  const todayCaptures = captures.filter(c => c.date === todayStr());

  // ── Routine Actions ──────────────────────────────────────
  const toggleRoutine = (id: string) => {
    setRoutineDay(prev => ({ ...prev, items: prev.items.map(r => r.id === id ? { ...r, done: !r.done } : r) }));
  };
  const addRoutine = () => {
    const label = routineAddLabel.trim();
    if (!label) return;
    const newItem: RoutineItem = { id: `r${Date.now()}`, label, category: routineAddCat, done: false };
    setRoutineConfig(prev => [...prev, newItem]);
    setRoutineDay(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setRoutineAddLabel('');
  };
  const deleteRoutine = (id: string) => {
    setRoutineConfig(prev => prev.filter(r => r.id !== id));
    setRoutineDay(prev => ({ ...prev, items: prev.items.filter(r => r.id !== id) }));
  };
  const routineDone  = routineDay.items.filter(r => r.done).length;
  const routineTotal = routineDay.items.length;
  const routineOpen  = routineTotal - routineDone;

  // ── Project Actions ──────────────────────────────────────
  const addProject = () => {
    const p: Project = { id: Date.now().toString(), title: 'Neues Projekt', type: 'suno', status: 'idee', note: '', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
    setProjects(prev => [p, ...prev]);
    setEditingProject(p.id);
    setNewProject(null);
  };
  const updateProject = (id: string, changes: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p));
  };
  const deleteProject = (id: string) => { if (!window.confirm('Projekt löschen?')) return; setProjects(prev => prev.filter(p => p.id !== id)); };
  const inArbeitCount = projects.filter(p => p.status === 'inarbeit').length;

  // ── Computed ─────────────────────────────────────────────
  const doneCount   = tasks.filter(t => t.done).length;
  const streak      = calcStreak(history);
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstWeekday = getFirstWeekday(calYear, calMonth);
  const historyMap  = Object.fromEntries(history.map(r => [r.date, r]));
  const today       = todayStr();
  const monthNames  = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

  function dayKey(day: number) { return `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`; }
  function dayStatus(day: number): 'full' | 'partial' | 'none' | 'empty' {
    const rec = historyMap[dayKey(day)];
    if (!rec || !rec.tasks.length) return 'empty';
    const done = rec.tasks.filter(t => t.done).length;
    if (done === rec.tasks.length) return 'full';
    if (done > 0) return 'partial';
    return 'none';
  }
  const selectedRecord = selectedDay ? historyMap[selectedDay] : null;

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {fokusActive && <FokusOverlay onExit={() => setFokusActive(false)} />}
      {showReminderPopup && (
        <ReminderPopup onClose={() => setShowReminderPopup(false)} onOpen={() => { setShowReminderPopup(false); setView('planner'); }} />
      )}

      {/* FAB – always visible */}
      {!fokusActive && (
        <>
          <button className={`fab${capOpen ? ' fab-open' : ''}`} onClick={() => setCapOpen(o => !o)} aria-label="Quick Capture">
            <span className="fab-icon">{capOpen ? '×' : '+'}</span>
          </button>
          {capOpen && (
            <>
              <div className="cap-backdrop" onClick={() => setCapOpen(false)} />
              <div className="cap-sheet">
                <div className="cap-handle" />
                <div className="cap-title">⚡ Quick Capture</div>
                <textarea
                  className="cap-textarea" autoFocus rows={3}
                  placeholder="Gedanke, Task, Idee…"
                  value={capText} onChange={e => setCapText(e.target.value)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveCapture(); if (e.key === 'Escape') setCapOpen(false); }}
                />
                <div className="cap-actions">
                  <button className="fokus-btn" onClick={() => setCapOpen(false)}>Abbrechen</button>
                  <button className="fokus-btn primary" onClick={saveCapture} disabled={!capText.trim()}>Speichern</button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div className="app-root">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <FreigeistLogo />
            <div>
              <h1>Freigeist Planner</h1>
              <div className="tagline">ADHS-taugliches Minimal-Board.</div>
            </div>
          </div>

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
            <span>⚡</span><span style={{flex:1}}>Fokus-Modus</span>
            <button className={`toggle-btn${fokusActive?' on':''}`} onClick={() => setFokusActive(f => !f)} aria-label="Fokus-Modus">
              <span className="toggle-knob" />
            </button>
          </div>
          <div className="nav-item" style={{cursor:'default'}}>
            <span>⏰</span><span style={{flex:1}}>Wecker</span>
            <button className={`toggle-btn${reminderEnabled?' on':''}`} onClick={toggleReminder} aria-label="Wecker">
              <span className="toggle-knob" />
            </button>
          </div>
          {reminderEnabled && (
            <div className="reminder-time-row">
              <span style={{fontSize:11,color:'var(--text-muted)'}}>Uhrzeit</span>
              <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className="time-input" />
            </div>
          )}
          {notifPerm === 'denied' && <div className="notif-warn">⚠️ Benachrichtigungen blockiert – in Safari-Einstellungen freischalten.</div>}

          <div className="nav-section-title">Features</div>
          <div className={`nav-item${view==='capture'?' active':''}`} onClick={() => setView('capture')}>
            <span>⚡</span><span style={{flex:1}}>Quick Capture</span>
            {todayCaptures.length > 0 && <span className="nav-badge">{todayCaptures.length}</span>}
          </div>
          <div className={`nav-item${view==='routines'?' active':''}`} onClick={() => setView('routines')}>
            <span>♻</span><span style={{flex:1}}>Routinen</span>
            {routineOpen > 0 && <span className="nav-badge">{routineOpen}</span>}
          </div>
          <div className={`nav-item${view==='projects'?' active':''}`} onClick={() => setView('projects')}>
            <span>🎧</span><span style={{flex:1}}>Musik / Projekte</span>
            {inArbeitCount > 0 && <span className="nav-badge">{inArbeitCount}</span>}
          </div>

          {streak > 0 && <div className="streak-badge">🔥 {streak} Tag{streak !== 1 ? 'e' : ''} in Folge</div>}
        </aside>

        {/* ── Main ── */}
        <main className="main">

          {/* ── Planner ── */}
          {view === 'planner' && (
            <>
              <header className="main-header">
                <div>
                  <div className="main-header-title">Dein Tag als Freigeist</div>
                  <div className="main-header-subtitle">Maximal 3 echte Prioritäten. Alles andere ist Bonus.</div>
                  <div className="pill-row">
                    <div className="pill">ADHS-freundlich</div>
                    <div className="pill">lokal gespeichert</div>
                    <button className={`pill fokus-pill${fokusActive?' active':''}`} onClick={() => setFokusActive(f => !f)}>
                      {fokusActive ? '⚡ Fokus AN' : '⚡ Fokus starten'}
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
                        <div className="list-item-label">{task.label}<div className="list-item-meta">{task.done ? '✓ erledigt' : 'offen'}</div></div>
                      </label>
                    ))}
                    {tasks.length === 0 && <div className="list-item-meta">Noch nichts drin. Was wäre die eine Sache, die heute zählt?</div>}
                  </div>
                  <div className="input-row">
                    <input placeholder="Neue Priorität …" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask(); }} />
                    <button onClick={addTask}>+ Add</button>
                  </div>
                  <div className="list-item-meta" style={{marginTop:8}}>Max 3. <button className="link-btn" onClick={clearTasks}>Zurücksetzen</button></div>
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
              {/* Quick Captures heute im Planner */}
              {todayCaptures.length > 0 && (
                <section className="card captures-card">
                  <div className="card-title">⚡ Captures heute</div>
                  <div className="captures-list">
                    {todayCaptures.map(c => (
                      <div key={c.id} className="capture-item">
                        <span className="capture-time">{fmtTime(c.ts)}</span>
                        <span className="capture-text">{c.text}</span>
                        <button className="capture-del" onClick={() => deleteCapture(c.id)} aria-label="Löschen">×</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── Tracker ── */}
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
                <span><span className="legend-dot full" /> Alle erledigt</span>
                <span><span className="legend-dot partial" /> Teils erledigt</span>
                <span><span className="legend-dot none" /> Nichts erledigt</span>
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
                    <button key={day} className={`cal-day ${status}${isToday?' today':''}${selectedDay===key?' selected':''}`} onClick={() => setSelectedDay(selectedDay===key?null:key)}>
                      <span className="cal-day-num">{day}</span>
                      {status!=='empty' && <span className="cal-day-dots">{historyMap[key]?.tasks.map((t,ti) => <span key={ti} className={`cal-dot ${t.done?'done':'open'}`} />)}</span>}
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
                  return (<>
                    <div className="stat-card"><div className="stat-num">{mr.length}</div><div className="stat-label">Aktive Tage</div></div>
                    <div className="stat-card"><div className="stat-num">{mr.filter(r=>r.tasks.length>0&&r.tasks.every(t=>t.done)).length}</div><div className="stat-label">Volle Big-3-Tage</div></div>
                    <div className="stat-card"><div className="stat-num">{mr.reduce((a,r)=>a+r.tasks.filter(t=>t.done).length,0)}</div><div className="stat-label">Tasks erledigt</div></div>
                    <div className="stat-card"><div className="stat-num">🔥{streak}</div><div className="stat-label">Streak</div></div>
                  </>);
                })()}
              </div>
            </>
          )}

          {/* ── Quick Capture View ── */}
          {view === 'capture' && (
            <>
              <header className="main-header">
                <div>
                  <div className="main-header-title">⚡ Quick Capture</div>
                  <div className="main-header-subtitle">Alle Captures des heutigen Tages.</div>
                </div>
                <div className="pill">{todayCaptures.length} heute</div>
              </header>
              <section className="card captures-card">
                {todayCaptures.length === 0
                  ? <div className="list-item-meta">Noch keine Captures heute. Nutze den + Button unten rechts.</div>
                  : (
                    <div className="captures-list">
                      {todayCaptures.map(c => (
                        <div key={c.id} className="capture-item">
                          <span className="capture-time">{fmtTime(c.ts)}</span>
                          <span className="capture-text">{c.text}</span>
                          <button className="capture-del" onClick={() => deleteCapture(c.id)} aria-label="Löschen">×</button>
                        </div>
                      ))}
                    </div>
                  )
                }
              </section>
              {captures.filter(c => c.date !== todayStr()).length > 0 && (
                <section className="card">
                  <div className="card-title" style={{marginBottom:10}}>Ältere Captures</div>
                  <div className="captures-list">
                    {captures.filter(c => c.date !== todayStr()).slice(0,20).map(c => (
                      <div key={c.id} className="capture-item">
                        <span className="capture-time" style={{minWidth:72}}>{c.date}</span>
                        <span className="capture-text">{c.text}</span>
                        <button className="capture-del" onClick={() => deleteCapture(c.id)} aria-label="Löschen">×</button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── Routinen View ── */}
          {view === 'routines' && (
            <>
              <header className="main-header">
                <div>
                  <div className="main-header-title">♻ Routinen</div>
                  <div className="main-header-subtitle">Täglich zurückgesetzt. Dein Rhythmus.</div>
                </div>
                <div className="pill">{routineDone}/{routineTotal}</div>
              </header>
              <section className="card routines-card">
                <div className="routines-header">
                  <span className="routines-progress-text">{routineDone} / {routineTotal} erledigt</span>
                </div>
                <div className="routines-bar-wrap">
                  <div className="routines-bar-fill" style={{width: routineTotal ? `${(routineDone/routineTotal)*100}%` : '0%'}} />
                </div>
                {(['morgen','abend','custom'] as const).map(cat => {
                  const items = routineDay.items.filter(r => r.category === cat);
                  if (!items.length) return null;
                  const labels: Record<string,string> = { morgen:'🌅 Morgen', abend:'🌙 Abend', custom:'✨ Eigene' };
                  return (
                    <div key={cat} className="routine-group">
                      <div className="routine-group-label">{labels[cat]}</div>
                      <div className="routine-chips">
                        {items.map(r => (
                          <div key={r.id} className={`routine-chip${r.done?' done':''}`} onClick={() => toggleRoutine(r.id)}>
                            <span className="routine-check">{r.done ? '✅' : '◻'}</span>
                            <span className="routine-chip-label">{r.label}</span>
                            <button className="routine-del" onClick={e => { e.stopPropagation(); deleteRoutine(r.id); }} aria-label="Löschen">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div className="routine-add-form">
                  <input className="routine-add-input" placeholder="Neue Routine…" value={routineAddLabel} onChange={e => setRoutineAddLabel(e.target.value)} onKeyDown={e => { if (e.key==='Enter') addRoutine(); }} />
                  <select className="routine-add-select" value={routineAddCat} onChange={e => setRoutineAddCat(e.target.value as 'morgen'|'abend'|'custom')}>
                    <option value="morgen">Morgen</option>
                    <option value="abend">Abend</option>
                    <option value="custom">Eigene</option>
                  </select>
                  <button className="routine-add-btn" onClick={addRoutine} style={{width:'auto',padding:'9px 14px'}}>+ Hinzufügen</button>
                </div>
              </section>
            </>
          )}

          {/* ── Projekte View ── */}
          {view === 'projects' && (
            <>
              <header className="main-header">
                <div>
                  <div className="main-header-title">🎧 Musik / Projekte</div>
                  <div className="main-header-subtitle">Deine SiCKaRiM Tracks & Ideen.</div>
                </div>
                <button className="fokus-btn primary" style={{fontSize:13,padding:'7px 14px'}} onClick={addProject}>+ Neu</button>
              </header>
              {projects.length === 0 && (
                <div className="card" style={{textAlign:'center',padding:'32px 16px'}}>
                  <div style={{fontSize:32,marginBottom:10}}>🎵</div>
                  <div className="card-subtitle">Noch keine Projekte. Leg dein erstes an!</div>
                </div>
              )}
              {(['inarbeit','idee','pausiert','fertig'] as ProjectStatus[]).map(status => {
                const group = projects.filter(p => p.status === status);
                if (!group.length) return null;
                const meta = STATUS_META[status];
                return (
                  <div key={status} className="projects-group">
                    <div className="projects-group-label">{meta.emoji} {meta.label} <span className="projects-group-count">({group.length})</span></div>
                    <div className="projects-grid">
                      {group.map(p => (
                        editingProject === p.id ? (
                          <div key={p.id} className="project-card" style={{background: meta.color, borderColor:'var(--accent)'}}>
                            <input style={{background:'transparent',border:'none',borderBottom:'1px solid var(--border-glow)',color:'var(--text)',fontSize:15,fontWeight:600,width:'100%',outline:'none',marginBottom:8,paddingBottom:4}}
                              value={p.title} onChange={e => updateProject(p.id, {title: e.target.value})} autoFocus />
                            <div style={{display:'flex',gap:6,marginBottom:8}}>
                              <select style={{flex:1,background:'var(--bg)',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text)',fontSize:12,padding:'4px 6px'}}
                                value={p.type} onChange={e => updateProject(p.id, {type: e.target.value as ProjectType})}>
                                <option value="suno">Suno</option><option value="remix">Remix</option><option value="live">Live</option><option value="other">Other</option>
                              </select>
                              <select style={{flex:1,background:'var(--bg)',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text)',fontSize:12,padding:'4px 6px'}}
                                value={p.status} onChange={e => updateProject(p.id, {status: e.target.value as ProjectStatus})}>
                                <option value="idee">Idee</option><option value="inarbeit">In Arbeit</option><option value="fertig">Fertig</option><option value="pausiert">Pausiert</option>
                              </select>
                            </div>
                            <textarea style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text)',fontSize:12,padding:'6px 8px',resize:'none',fontFamily:'var(--font-body)'}}
                              rows={2} placeholder="Notiz…" value={p.note} onChange={e => updateProject(p.id, {note: e.target.value})} />
                            <div style={{display:'flex',gap:6,marginTop:8,justifyContent:'flex-end'}}>
                              <button className="fokus-btn danger" style={{fontSize:11,padding:'5px 10px'}} onClick={() => deleteProject(p.id)}>Löschen</button>
                              <button className="fokus-btn primary" style={{fontSize:11,padding:'5px 10px'}} onClick={() => setEditingProject(null)}>Fertig</button>
                            </div>
                          </div>
                        ) : (
                          <div key={p.id} className="project-card" style={{background: meta.color}} onClick={() => setEditingProject(p.id)}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                              <span style={{fontSize:15,fontWeight:600,color:'var(--text)',lineHeight:1.3}}>{p.title}</span>
                              <span style={{fontSize:11,background:'rgba(255,255,255,0.06)',padding:'2px 7px',borderRadius:999,whiteSpace:'nowrap',color:'var(--text-muted)'}}>{p.type}</span>
                            </div>
                            {p.note && <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.5,marginTop:4,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{p.note}</div>}
                            <div style={{fontSize:10,color:'var(--text-faint)',marginTop:6}}>{new Date(p.updatedAt).toLocaleDateString('de-DE')}</div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

        </main>
      </div>
    </>
  );
};
