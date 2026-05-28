import React, { useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────
export type DayTask = { id: string; label: string; done: boolean; };
export type DayRecord = { date: string; tasks: { label: string; done: boolean }[]; };
export type Capture = { id: string; text: string; ts: string; date: string; };
export type RoutineItem = { id: string; label: string; done: boolean; category: 'morgen' | 'abend' | 'custom'; };
export type RoutineDay = { date: string; items: RoutineItem[]; };
export type RoutineHistoryEntry = { date: string; done: number; total: number; };
export type ProjectStatus = 'idee' | 'inarbeit' | 'fertig' | 'pausiert';
export type ProjectType = 'suno' | 'remix' | 'live' | 'other';
export type Project = { id: string; title: string; type: ProjectType; status: ProjectStatus; note: string; sunoUrl?: string; updatedAt: string; createdAt: string; };

// ── Storage Keys ─────────────────────────────────────────
const STORAGE_KEY       = 'freigeist-planner-v1';
const HISTORY_KEY       = 'freigeist-history-v1';
const REMINDER_KEY      = 'freigeist-reminder-v1';
const CAPTURES_KEY      = 'freigeist-captures-v1';
const ROUTINES_KEY      = 'freigeist-routines-v1';
const ROUTINE_CFG_KEY   = 'freigeist-routine-config-v1';
const ROUTINE_HIST_KEY  = 'freigeist-routine-history-v1';
const PROJECTS_KEY      = 'freigeist-projects-v1';

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

// ── Routine Streak ────────────────────────────────────────
function calcRoutineStreak(hist: RoutineHistoryEntry[]): number {
  const full = hist.filter(e => e.total > 0 && e.done === e.total).map(e => e.date).sort().reverse();
  if (!full.length) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < full.length; i++) {
    const diff = Math.round((today.getTime() - new Date(full[i]).getTime()) / 86400000);
    if (diff === i || (i === 0 && diff <= 1)) streak++;
    else break;
  }
  return streak;
}

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

// ── Export helpers ───────────────────────────────────────
function exportJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

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
  const [captures, setCaptures]       = useState<Capture[]>([]);
  const [capOpen, setCapOpen]         = useState(false);
  const [capText, setCapText]         = useState('');
  const [oldCapturesPage, setOldCapturesPage] = useState(1);
  const OLD_CAP_PER_PAGE = 20;

  // Routinen
  const [routineDay, setRoutineDay]           = useState<RoutineDay>({ date: todayStr(), items: [] });
  const [routineConfig, setRoutineConfig]     = useState<RoutineItem[]>([]);
  const [routineHistory, setRoutineHistory]   = useState<RoutineHistoryEntry[]>([]);
  const [routineAddLabel, setRoutineAddLabel] = useState('');
  const [routineAddCat, setRoutineAddCat]     = useState<'morgen'|'abend'|'custom'>('custom');
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [editingRoutineLabel, setEditingRoutineLabel] = useState('');

  // Projekte
  const [projects, setProjects]             = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<string | null>(null);

  // Global Escape handler for FAB sheet
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setCapOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

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
    setCaptures(load<Capture[]>(CAPTURES_KEY, []));

    // Routine config + tages-reset with sync fix
    const cfg = load<RoutineItem[]>(ROUTINE_CFG_KEY, DEFAULT_ROUTINES);
    setRoutineConfig(cfg);
    const cfgIds = new Set(cfg.map(r => r.id));
    const storedDay = load<RoutineDay>(ROUTINES_KEY, { date: '', items: [] });
    const today = todayStr();
    if (storedDay.date === today) {
      // FIX: filter out items not in current config, add missing ones
      const syncedItems = cfg.map(cfgItem => {
        const existing = storedDay.items.find(i => i.id === cfgItem.id);
        return existing ?? { ...cfgItem, done: false };
      }).filter(i => cfgIds.has(i.id));
      const fresh: RoutineDay = { date: today, items: syncedItems };
      setRoutineDay(fresh);
    } else {
      // Day changed: save previous day to history before reset
      const prevHist = load<RoutineHistoryEntry[]>(ROUTINE_HIST_KEY, []);
      if (storedDay.date && storedDay.items.length > 0) {
        const prevEntry: RoutineHistoryEntry = {
          date: storedDay.date,
          done: storedDay.items.filter(i => i.done).length,
          total: storedDay.items.length,
        };
        const newHist = [...prevHist.filter(e => e.date !== storedDay.date), prevEntry];
        save(ROUTINE_HIST_KEY, newHist);
        setRoutineHistory(newHist);
      } else {
        setRoutineHistory(prevHist);
      }
      const fresh: RoutineDay = { date: today, items: cfg.map(r => ({ ...r, done: false })) };
      setRoutineDay(fresh);
      save(ROUTINES_KEY, fresh);
    }

    setProjects(load<Project[]>(PROJECTS_KEY, []));
  }, []);

  // ── Persist ─────────────────────────────────────────────
  useEffect(() => { saveState(tasks); }, [tasks]);
  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => { saveReminderTime(reminderTime); }, [reminderTime]);
  useEffect(() => { save(CAPTURES_KEY, captures); }, [captures]);
  useEffect(() => { save(ROUTINES_KEY, routineDay); }, [routineDay]);
  useEffect(() => { save(ROUTINE_CFG_KEY, routineConfig); }, [routineConfig]);
  useEffect(() => { save(ROUTINE_HIST_KEY, routineHistory); }, [routineHistory]);
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
  const addTask = (label?: string) => {
    const lbl = (label ?? input).trim();
    if (!lbl) return;
    if (tasks.length >= 3) { alert('Maximal 3 Tagesprioritäten.'); return; }
    setTasks(prev => [...prev, { id: Date.now().toString(), label: lbl, done: false }]);
    if (!label) setInput('');
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
  // Capture → Big 3: promote capture text to task
  const promoteCapture = (text: string, id: string) => {
    if (tasks.length >= 3) { alert('Maximal 3 Tagesprioritäten.'); return; }
    addTask(text);
    deleteCapture(id);
  };
  const todayCaptures  = captures.filter(c => c.date === todayStr());
  const olderCaptures  = captures.filter(c => c.date !== todayStr());
  const olderPageCount = Math.ceil(olderCaptures.length / OLD_CAP_PER_PAGE);
  const olderPageItems = olderCaptures.slice((oldCapturesPage - 1) * OLD_CAP_PER_PAGE, oldCapturesPage * OLD_CAP_PER_PAGE);

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
  const startEditRoutine = (r: RoutineItem) => { setEditingRoutineId(r.id); setEditingRoutineLabel(r.label); };
  const saveEditRoutine = (id: string) => {
    const label = editingRoutineLabel.trim();
    if (!label) return;
    setRoutineConfig(prev => prev.map(r => r.id === id ? { ...r, label } : r));
    setRoutineDay(prev => ({ ...prev, items: prev.items.map(r => r.id === id ? { ...r, label } : r) }));
    setEditingRoutineId(null);
  };
  const routineDone   = routineDay.items.filter(r => r.done).length;
  const routineTotal  = routineDay.items.length;
  const routineOpen   = routineTotal - routineDone;
  const routineStreak = calcRoutineStreak(routineHistory);

  // ── Project Actions ──────────────────────────────────────
  const addProject = () => {
    const p: Project = { id: Date.now().toString(), title: 'Neues Projekt', type: 'suno', status: 'idee', note: '', sunoUrl: '', updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
    setProjects(prev => [p, ...prev]);
    setEditingProject(p.id);
  };
  const updateProject = (id: string, changes: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...changes, updatedAt: new Date().toISOString() } : p));
  };
  const deleteProject = (id: string) => { if (!window.confirm('Projekt löschen?')) return; setProjects(prev => prev.filter(p => p.id !== id)); setEditingProject(null); };
  const inArbeitCount = projects.filter(p => p.status === 'inarbeit').length;

  // ── Export ───────────────────────────────────────────────
  const handleExport = () => {
    exportJSON({
      exportedAt: new Date().toISOString(),
      tasks, history, captures, routineConfig, routineHistory, projects,
    }, `freigeist-export-${todayStr()}.json`);
  };

  // ── Computed ─────────────────────────────────────────────
  const doneCount    = tasks.filter(t => t.done).length;
  const streak       = calcStreak(history);
  const daysInMonth  = getDaysInMonth(calYear, calMonth);
  const firstWeekday = getFirstWeekday(calYear, calMonth);
  const historyMap   = Object.fromEntries(history.map(r => [r.date, r]));
  const today        = todayStr();
  const monthNames   = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

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

      {/* FAB */}
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
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveCapture(); }}
                />
                <div className="cap-actions">
                  <button className="fokus-btn" onClick={() => setCapOpen(false)}>Abbrechen</button>
                  <button className="fokus-btn primary" onClick={saveCapture} disabled={!capText.trim()}>Speichern ⌘↵</button>
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
            <div c