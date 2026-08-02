import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import {
  loadCaptures,
  loadDayNotes,
  loadProjects,
  loadRoutines,
  loadTasksBundle,
  loadTracker,
  loadWeekFocusList,
  saveCaptures,
  saveDayNotes,
  saveProjects,
  saveRoutines,
  saveTasksBundle,
  saveTracker,
  saveWeekFocusList,
} from './db';
import type {
  Capture,
  CaptureType,
  DayNote,
  DayRecord,
  DayTask,
  Project,
  ProjectStatus,
  ProjectType,
  RoutineDay,
  RoutineHistoryEntry,
  RoutineItem,
  View,
  WeekFocus,
} from './types';

export type { Capture, CaptureType, DayNote, DayRecord, DayTask, Project, ProjectStatus, ProjectType, RoutineDay, RoutineHistoryEntry, RoutineItem, WeekFocus };

// ── Wochen-Helpers ──────────────────────────────────────────────

/** Gibt den ISO-Montag der Woche als YYYY-MM-DD zurück. */
function getWeekMonday(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=So, 1=Mo, ...
  const diff = day === 0 ? -6 : 1 - day; // Montag
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** Gibt alle YYYY-MM-DD-Daten der laufenden Woche (Mo–So) zurück. */
function getWeekDays(monday: string): string[] {
  const days: string[] = [];
  const base = new Date(monday + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  }
  return days;
}

/** Formatiert einen Montag-Datum-String als lesbaren Wochenbereich. */
function fmtWeekRange(monday: string): string {
  const mo = new Date(monday + 'T12:00:00');
  const so = new Date(mo);
  so.setDate(mo.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${mo.toLocaleDateString('de-DE', opts)} – ${so.toLocaleDateString('de-DE', opts)}`;
}

// ── Storage Keys ──────────────────────────────────────────
const REMINDER_KEY = 'freigeist-reminder-v1';

// ── Capture-Typ-Metadaten ─────────────────────────────────
const CAPTURE_TYPES: { value: CaptureType; label: string; emoji: string }[] = [
  { value: 'aufgabe', label: 'Aufgabe', emoji: '✅' },
  { value: 'idee',    label: 'Idee',    emoji: '💡' },
  { value: 'link',    label: 'Link',    emoji: '🔗' },
  { value: 'notiz',   label: 'Notiz',   emoji: '📝' },
];

function captureTypeLabel(type?: CaptureType): string {
  if (!type) return '';
  return CAPTURE_TYPES.find(t => t.value === type)?.emoji ?? '';
}

// ── Helpers ───────────────────────────────────────────────
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

// ── Default Routines ──────────────────────────────────────
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

// ── Streak Helpers ────────────────────────────────────────
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

// ── Export helpers ────────────────────────────────────────
function exportJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const FOCUS_MINS = 25;

// ── SVG Logo ──────────────────────────────────────────────
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

// ── Big 3 Task Item ───────────────────────────────────────
interface TaskItemProps {
  task: DayTask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveEdit: (id: string, label: string) => void;
}

function TaskItem({ task, onToggle, onDelete, onSaveEdit }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(task.label);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, task.label]);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.label) onSaveEdit(task.id, trimmed);
    setEditing(false);
  };
  const cancelEdit = () => { setDraft(task.label); setEditing(false); };

  if (editing) {
    return (
      <div className="task-edit-row">
        <input
          ref={inputRef}
          className="task-edit-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit(); }}
        />
        <button className="task-action-btn save" onClick={commitEdit} aria-label="Speichern">✓</button>
        <button className="task-action-btn cancel" onClick={cancelEdit} aria-label="Abbrechen">✕</button>
      </div>
    );
  }

  return (
    <div className={`list-item${task.done ? ' done' : ''}`}>
      <label className="task-check-label">
        <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
        <div className="list-item-label">
          {task.label}
          <div className="list-item-meta">{task.done ? '✓ erledigt' : 'offen'}</div>
        </div>
      </label>
      <div className="task-item-actions">
        <button className="task-action-btn edit" onClick={() => setEditing(true)} aria-label="Bearbeiten">✎</button>
        <button className="task-action-btn delete" onClick={() => onDelete(task.id)} aria-label="Löschen">×</button>
      </div>
    </div>
  );
}

// ── Tagesnotiz ────────────────────────────────────────────
interface DayNoteEditorProps {
  notes: DayNote[];
  today: string;
  onChange: (notes: DayNote[]) => void;
}

function DayNoteEditor({ notes, today, onChange }: DayNoteEditorProps) {
  const existing = notes.find(n => n.date === today);
  const [text, setText] = useState(existing?.text ?? '');
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const n = notes.find(n => n.date === today);
    setText(n?.text ?? '');
  }, [notes, today]);

  const handleChange = (val: string) => {
    setText(val);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const updated = [...notes.filter(n => n.date !== today)];
      if (val.trim()) updated.push({ date: today, text: val });
      onChange(updated);
      setSaved(true);
    }, 600);
  };

  return (
    <section className="card daynote-card">
      <div className="card-title">
        📝 Tagesnotiz
        {saved && <span className="daynote-saved-hint">gespeichert</span>}
      </div>
      <div className="card-subtitle">Ein freier Gedanke für heute.</div>
      <textarea
        className="daynote-textarea"
        placeholder="Was beschäftigt dich heute? Wie fühlst du dich? Was willst du festhalten…"
        value={text}
        onChange={e => handleChange(e.target.value)}
        rows={4}
      />
    </section>
  );
}

// ── Capture Item ──────────────────────────────────────────
interface CaptureItemProps {
  capture: Capture;
  showDate?: boolean;
  canPromote: boolean;
  onPromote: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

function CaptureItem({ capture, showDate, canPromote, onPromote, onDelete }: CaptureItemProps) {
  const typeEmoji = captureTypeLabel(capture.type);
  const isProcessed = capture.processed === true;

  return (
    <div className={`capture-item${isProcessed ? ' processed' : ''}`}>
      <div className="capture-item-main">
        <div className="capture-item-meta">
          {typeEmoji && <span className="capture-type-badge">{typeEmoji}</span>}
          <span className="capture-time">
            {showDate ? capture.date : fmtTime(capture.ts)}
          </span>
          {isProcessed && <span className="capture-processed-tag">✓ verarbeitet</span>}
        </div>
        <span className="capture-text">{capture.text}</span>
      </div>
      <div className="capture-item-actions">
        {!isProcessed && (
          <button
            className={`capture-promote${!canPromote ? ' disabled' : ''}`}
            onClick={() => canPromote && onPromote(capture.id, capture.text)}
            title={canPromote ? 'In Big 3 übernehmen' : 'Big 3 bereits voll (max. 3)'}
            aria-label="In Big 3 übernehmen"
          >
            → Big 3
          </button>
        )}
        <button className="capture-del" onClick={() => onDelete(capture.id)} aria-label="Löschen">×</button>
      </div>
    </div>
  );
}

// ── Projektkarte ─────────────────────────────────────────
interface ProjectCardProps {
  project: Project;
  meta: { emoji: string; label: string; color: string };
  isEditing: boolean;
  onEdit: (id: string) => void;
  onClose: () => void;
  onUpdate: (id: string, changes: Partial<Project>) => void;
  onDelete: (id: string) => void;
}

function ProjectCard({ project: p, meta, isEditing, onEdit, onClose, onUpdate, onDelete }: ProjectCardProps) {
  // Inline-Edit-State für nextStep (nur auf der View-Karte, ohne vollen Edit-Modus)
  const [editingNextStep, setEditingNextStep] = useState(false);
  const [nextStepDraft, setNextStepDraft] = useState(p.nextStep ?? '');
  const nextStepRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNextStep) {
      setNextStepDraft(p.nextStep ?? '');
      setTimeout(() => nextStepRef.current?.focus(), 0);
    }
  }, [editingNextStep, p.nextStep]);

  const commitNextStep = () => {
    const val = nextStepDraft.trim();
    onUpdate(p.id, { nextStep: val || undefined });
    setEditingNextStep(false);
  };

  const cancelNextStep = () => {
    setNextStepDraft(p.nextStep ?? '');
    setEditingNextStep(false);
  };

  if (isEditing) {
    return (
      <div className="project-card" style={{background: meta.color, borderColor:'var(--accent)'}}>
        <input
          style={{background:'transparent',border:'none',borderBottom:'1px solid var(--border-glow)',color:'var(--text)',fontSize:15,fontWeight:600,width:'100%',outline:'none',marginBottom:8,paddingBottom:4}}
          value={p.title} onChange={e => onUpdate(p.id, {title: e.target.value})} autoFocus
        />
        <div style={{display:'flex',gap:6,marginBottom:8}}>
          <select
            style={{flex:1,background:'var(--bg)',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text)',fontSize:12,padding:'4px 6px'}}
            value={p.type} onChange={e => onUpdate(p.id, {type: e.target.value as ProjectType})}>
            <option value="suno">Suno</option><option value="remix">Remix</option><option value="live">Live</option><option value="other">Other</option>
          </select>
          <select
            style={{flex:1,background:'var(--bg)',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text)',fontSize:12,padding:'4px 6px'}}
            value={p.status} onChange={e => onUpdate(p.id, {status: e.target.value as ProjectStatus})}>
            <option value="idee">Idee</option><option value="inarbeit">In Arbeit</option><option value="fertig">Fertig</option><option value="pausiert">Pausiert</option>
          </select>
        </div>
        <textarea
          style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid var(--border-subtle)',borderRadius:6,color:'var(--text)',fontSize:12,padding:'6px 8px',resize:'none',fontFamily:'var(--font-body)'}}
          rows={2} placeholder="Notiz…" value={p.note} onChange={e => onUpdate(p.id, {note: e.target.value})}
        />
        <input className="proj-input" placeholder="Suno URL" value={p.sunoUrl??''} onChange={e=>onUpdate(p.id,{sunoUrl:e.target.value})} />
        <div style={{display:'flex',gap:6,marginTop:8,justifyContent:'flex-end'}}>
          <button className="fokus-btn danger" style={{fontSize:11,padding:'5px 10px'}} onClick={() => onDelete(p.id)}>Löschen</button>
          <button className="fokus-btn primary" style={{fontSize:11,padding:'5px 10px'}} onClick={onClose}>Fertig</button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-card" style={{background: meta.color}}>
      {/* Kopfzeile: Titel + Typ-Badge */}
      <div className="proj-card-header" onClick={() => onEdit(p.id)}>
        <span className="proj-card-title">{p.title}</span>
        <span className="proj-card-type-badge">{p.type}</span>
      </div>

      {/* Notiz (optional, 2 Zeilen) */}
      {p.note && (
        <div className="proj-card-note" onClick={() => onEdit(p.id)}>{p.note}</div>
      )}

      {/* Nächster Schritt – immer sichtbar */}
      <div className="proj-nextstep-block">
        <div className="proj-nextstep-label">▶ Nächster Schritt</div>
        {editingNextStep ? (
          <div className="proj-nextstep-edit-row">
            <input
              ref={nextStepRef}
              className="proj-nextstep-input"
              value={nextStepDraft}
              onChange={e => setNextStepDraft(e.target.value)}
              placeholder="Was ist der nächste konkrete Schritt?"
              onKeyDown={e => {
                if (e.key === 'Enter') commitNextStep();
                if (e.key === 'Escape') cancelNextStep();
              }}
            />
            <button className="proj-nextstep-btn save" onClick={commitNextStep} aria-label="Speichern">✓</button>
            <button className="proj-nextstep-btn cancel" onClick={cancelNextStep} aria-label="Abbrechen">✕</button>
          </div>
        ) : (
          <div
            className={`proj-nextstep-value${p.nextStep ? '' : ' empty'}`}
            onClick={e => { e.stopPropagation(); setEditingNextStep(true); }}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingNextStep(true); } }}
          >
            {p.nextStep || 'Nächsten Schritt festhalten…'}
          </div>
        )}
      </div>

      {/* Footer: Suno-Link + Datum */}
      <div className="proj-card-footer" onClick={() => onEdit(p.id)}>
        {p.sunoUrl && (
          <a className="proj-suno-link" href={p.sunoUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>🔗 Suno</a>
        )}
        <span className="proj-card-date">{new Date(p.updatedAt).toLocaleDateString('de-DE')}</span>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────
export const App: React.FC = () => {
  // Big 3
  const [tasks, setTasks]         = useState<DayTask[]>([]);
  const [tasksDate, setTasksDate] = useState<string>('');
  const [input, setInput]         = useState('');
  const [history, setHistory]     = useState<DayRecord[]>([]);
  const [view, setView]           = useState<View>('planner');
  const [calYear, setCalYear]     = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]   = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay]     = useState<string | null>(null);
  const [fokusActive, setFokusActive]     = useState(false);
  const [reminderTime, setReminderTime]   = useState('08:00');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [notifPerm, setNotifPerm]         = useState<NotificationPermission>('default');
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const reminderRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFiredRef = useRef<string>('');

  // Quick Capture
  const [captures, setCaptures]   = useState<Capture[]>([]);
  const [capOpen, setCapOpen]     = useState(false);
  const [capText, setCapText]     = useState('');
  const [capType, setCapType]     = useState<CaptureType | undefined>(undefined);

  // Routinen
  const [routineDay, setRoutineDay]         = useState<RoutineDay>({ date: todayStr(), items: [] });
  const [routineConfig, setRoutineConfig]   = useState<RoutineItem[]>([]);
  const [routineHistory, setRoutineHistory] = useState<RoutineHistoryEntry[]>([]);
  const [routineAddLabel, setRoutineAddLabel] = useState('');
  const [routineAddCat, setRoutineAddCat]   = useState<'morgen'|'abend'|'custom'>('custom');

  // Projekte
  const [projects, setProjects]           = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [projTypeFilter, setProjTypeFilter] = useState<ProjectType | 'all'>('all');

  // Tagesnotizen
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);

  // Wochenfokus
  const [weekFocusList, setWeekFocusList] = useState<WeekFocus[]>([]);

  const [hydrated, setHydrated] = useState(false);

  // Global Escape handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setCapOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── URL params ───────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('morning') === '1' || params.get('morning') === 'true') setTimeout(() => setShowReminderPopup(true), 600);
    if (params.get('focus') === 'true') setTimeout(() => setFokusActive(true), 600);
    if (params.has('morning') || params.has('focus')) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  // ── Load ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tasksBundle, loadedHistory, loadedCaptures, routinesBundle, loadedProjects, loadedNotes, loadedWeekFocus] = await Promise.all([
        loadTasksBundle(),
        loadTracker(),
        loadCaptures(),
        loadRoutines(DEFAULT_ROUTINES),
        loadProjects(),
        loadDayNotes(),
        loadWeekFocusList(),
      ]);
      if (cancelled) return;

      const today = todayStr();

      // ── Tageswechsel-Logik für Big 3 ──────────────────────
      if (tasksBundle.date && tasksBundle.date !== today && tasksBundle.tasks.length > 0) {
        const alreadyRecorded = loadedHistory.some(r => r.date === tasksBundle.date);
        if (!alreadyRecorded) {
          const archiveEntry: DayRecord = {
            date: tasksBundle.date,
            tasks: tasksBundle.tasks.map(t => ({ label: t.label, done: t.done })),
          };
          const newHistory = [...loadedHistory, archiveEntry];
          setHistory(newHistory);
          void saveTracker(newHistory);
        } else {
          setHistory(loadedHistory);
        }
        setTasks([]);
        setTasksDate(today);
        void saveTasksBundle({ date: today, tasks: [] });
      } else {
        setTasks(tasksBundle.tasks);
        setTasksDate(tasksBundle.date || today);
        setHistory(loadedHistory);
        if (!tasksBundle.date) {
          void saveTasksBundle({ date: today, tasks: tasksBundle.tasks });
        }
      }

      setReminderTime(loadReminderTime());
      if ('Notification' in window) setNotifPerm(Notification.permission);
      setCaptures(loadedCaptures);

      // Routinen
      const cfg = routinesBundle.config.length ? routinesBundle.config : DEFAULT_ROUTINES;
      setRoutineConfig(cfg);
      const cfgIds = new Set(cfg.map(r => r.id));
      const storedDay = routinesBundle.day;
      if (storedDay.date === today) {
        const syncedItems = cfg.map(cfgItem => {
          const existing = storedDay.items.find(i => i.id === cfgItem.id);
          return existing ?? { ...cfgItem, done: false };
        }).filter(i => cfgIds.has(i.id));
        setRoutineDay({ date: today, items: syncedItems });
      } else {
        const prevHist = routinesBundle.history;
        if (storedDay.date && storedDay.items.length > 0) {
          const prevEntry: RoutineHistoryEntry = {
            date: storedDay.date,
            done: storedDay.items.filter(i => i.done).length,
            total: storedDay.items.length,
          };
          const newHist = [...prevHist.filter(e => e.date !== storedDay.date), prevEntry];
          setRoutineHistory(newHist);
          const fresh: RoutineDay = { date: today, items: cfg.map(r => ({ ...r, done: false })) };
          setRoutineDay(fresh);
          void saveRoutines({ config: cfg, day: fresh, history: newHist });
        } else {
          setRoutineHistory(prevHist);
          const fresh: RoutineDay = { date: today, items: cfg.map(r => ({ ...r, done: false })) };
          setRoutineDay(fresh);
        }
      }

      setProjects(loadedProjects);
      setDayNotes(loadedNotes);
      setWeekFocusList(loadedWeekFocus);
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Persist ───────────────────────────────────────────────
  useEffect(() => {
    if (hydrated) void saveTasksBundle({ date: tasksDate || todayStr(), tasks });
  }, [tasks, tasksDate, hydrated]);
  useEffect(() => { if (hydrated) void saveTracker(history); }, [history, hydrated]);
  useEffect(() => { saveReminderTime(reminderTime); }, [reminderTime]);
  useEffect(() => { if (hydrated) void saveCaptures(captures); }, [captures, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    void saveRoutines({ config: routineConfig, day: routineDay, history: routineHistory });
  }, [routineDay, routineConfig, routineHistory, hydrated]);
  useEffect(() => { if (hydrated) void saveProjects(projects); }, [projects, hydrated]);
  useEffect(() => { if (hydrated) void saveDayNotes(dayNotes); }, [dayNotes, hydrated]);
  useEffect(() => { if (hydrated) void saveWeekFocusList(weekFocusList); }, [weekFocusList, hydrated]);

  // ── Reminder ─────────────────────────────────────────────
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

  // ── Big 3 Actions ─────────────────────────────────────────
  const addTask = (label?: string) => {
    const lbl = (label ?? input).trim();
    if (!lbl) return;
    if (tasks.length >= 3) return; // Stille Ablehnung – kein alert
    const today = todayStr();
    setTasks(prev => [...prev, { id: Date.now().toString(), label: lbl, done: false }]);
    if (!tasksDate) setTasksDate(today);
    if (!label) setInput('');
  };

  const toggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTasks(updated);
    setHistory(recordDay(updated, history));
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    setHistory(recordDay(updated, history));
  };

  const editTask = (id: string, label: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, label } : t));
  };

  const clearTasks = () => { if (!window.confirm('Tagesliste wirklich zurücksetzen?')) return; setTasks([]); };

  // ── Quick Capture Actions ─────────────────────────────────
  const openCapture = () => {
    setCapText('');
    setCapType(undefined);
    setCapOpen(true);
  };

  const saveCapture = () => {
    const text = capText.trim();
    if (!text) return;
    const cap: Capture = {
      id: Date.now().toString(),
      text,
      ts: new Date().toISOString(),
      date: todayStr(),
      type: capType,
      processed: false,
    };
    setCaptures(prev => [cap, ...prev]);
    setCapText('');
    setCapType(undefined);
    setCapOpen(false);
  };

  const deleteCapture = (id: string) => setCaptures(prev => prev.filter(c => c.id !== id));

  /**
   * Promote: Capture-Text in Big 3 übernehmen.
   * Wenn Big 3 voll → kein alert, nur stille Ablehnung (Button ist disabled).
   * Nach Promote: Capture als verarbeitet markieren (bleibt sichtbar, aber ausgegraut).
   */
  const promoteCapture = (id: string, text: string) => {
    if (tasks.length >= 3) return;
    addTask(text);
    setCaptures(prev => prev.map(c => c.id === id ? { ...c, processed: true } : c));
  };

  const today = todayStr();
  const todayCaptures  = captures.filter(c => c.date === today);
  const olderCaptures  = captures.filter(c => c.date !== today);
  // Offene (nicht verarbeitete) Captures heute
  const openTodayCaptures = todayCaptures.filter(c => !c.processed);
  // Badge: alle unverarbeiteten Captures (heute + älter)
  const openCapturesCount = captures.filter(c => !c.processed).length;

  const canPromote = tasks.length < 3;

  // ── Routine Actions ───────────────────────────────────────
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
  const routineDone   = routineDay.items.filter(r => r.done).length;
  const routineTotal  = routineDay.items.length;
  const routineOpen   = routineTotal - routineDone;
  const routineStreak = calcRoutineStreak(routineHistory);

  // ── Project Actions ───────────────────────────────────────
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

  // ── Export ────────────────────────────────────────────────
  const handleExport = () => {
    exportJSON({
      exportedAt: new Date().toISOString(),
      tasks, history, captures, routineConfig, routineHistory, projects, dayNotes,
    }, `freigeist-export-${todayStr()}.json`);
  };

  // ── Computed ──────────────────────────────────────────────
  const doneCount    = tasks.filter(t => t.done).length;
  const streak       = calcStreak(history);
  const daysInMonth  = getDaysInMonth(calYear, calMonth);
  const firstWeekday = getFirstWeekday(calYear, calMonth);
  const historyMap   = Object.fromEntries(history.map(r => [r.date, r]));
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
          <button className={`fab${capOpen ? ' fab-open' : ''}`} onClick={() => capOpen ? setCapOpen(false) : openCapture()} aria-label="Quick Capture">
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
                {/* Typ-Auswahl – optional, kein Pflichtfeld */}
                <div className="cap-type-row">
                  <span className="cap-type-label">Typ:</span>
                  {CAPTURE_TYPES.map(t => (
                    <button
                      key={t.value}
                      className={`cap-type-btn${capType === t.value ? ' active' : ''}`}
                      onClick={() => setCapType(prev => prev === t.value ? undefined : t.value)}
                      type="button"
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
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
          <button className="fokus-btn" style={{ width: '100%', fontSize: 12, padding: '8px 12px', marginBottom: 12 }} onClick={handleExport}>
            ⬇ JSON Export
          </button>

          <div className="nav-section-title">Heute</div>
          <div className={`nav-item${view==='planner'?' active':''}`} onClick={() => setView('planner')}>
            <span className="nav-dot" /><span>Daily Big 3</span>
          </div>
          <div className={`nav-item${view==='week'?' active':''}`} onClick={() => setView('week')}>
            <span>📅</span><span>Wochenfokus</span>
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
            {/* Badge zeigt alle offenen (unverarbeiteten) Captures */}
            {openCapturesCount > 0 && <span className="nav-badge">{openCapturesCount}</span>}
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
          {routineStreak > 0 && <div className="streak-badge" style={{marginTop:4}}>♻ {routineStreak} Routine-Streak</div>}
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

              <section className="card">
                <div className="card-title">Daily Big 3</div>
                <div className="card-subtitle">Was muss passieren, damit sich heute nach Fortschritt anfühlt?</div>
                <div className="list">
                  {tasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={toggleTask}
                      onDelete={deleteTask}
                      onSaveEdit={editTask}
                    />
                  ))}
                  {tasks.length === 0 && (
                    <div className="list-item-meta">Noch nichts drin. Was wäre die eine Sache, die heute zählt?</div>
                  )}
                </div>
                <div className="input-row">
                  <input
                    placeholder={tasks.length >= 3 ? 'Big 3 bereits voll' : 'Neue Priorität …'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
                    disabled={tasks.length >= 3}
                  />
                  <button onClick={() => addTask()} disabled={tasks.length >= 3}>+ Add</button>
                </div>
                {tasks.length > 0 && (
                  <div className="list-item-meta" style={{marginTop:8}}>
                    Max 3. <button className="link-btn" onClick={clearTasks}>Alle zurücksetzen</button>
                  </div>
                )}
              </section>

              {/* Tagesnotiz */}
              <DayNoteEditor notes={dayNotes} today={today} onChange={setDayNotes} />

              {/* Offene Captures heute im Planner (nur unverarbeitete) */}
              {openTodayCaptures.length > 0 && (
                <section className="card captures-card">
                  <div className="card-title">
                    ⚡ Offene Captures
                    <span className="capture-open-badge">{openTodayCaptures.length}</span>
                  </div>
                  <div className="captures-list">
                    {openTodayCaptures.map(c => (
                      <CaptureItem
                        key={c.id}
                        capture={c}
                        canPromote={canPromote}
                        onPromote={promoteCapture}
                        onDelete={deleteCapture}
                      />
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
                  {dayNotes.find(n => n.date === selectedDay) && (
                    <div className="daynote-readonly">
                      <div className="daynote-readonly-label">📝 Notiz</div>
                      <div className="daynote-readonly-text">{dayNotes.find(n => n.date === selectedDay)!.text}</div>
                    </div>
                  )}
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

          {/* ── Quick Capture View / Inbox ── */}
          {view === 'capture' && (
            <>
              <header className="main-header">
                <div>
                  <div className="main-header-title">⚡ Inbox</div>
                  <div className="main-header-subtitle">Captures verarbeiten, priorisieren, weiterleiten.</div>
                </div>
                <div className="pill">
                  {openCapturesCount > 0
                    ? <><span style={{color:'var(--accent)',fontWeight:600}}>{openCapturesCount}</span> offen</>
                    : 'alles verarbeitet ✓'
                  }
                </div>
              </header>

              {/* Big-3-Status-Hinweis */}
              {!canPromote && (
                <div className="inbox-full-hint">
                  ✅ Big 3 sind voll. Captures können erst promoted werden, wenn ein Platz frei ist.
                </div>
              )}

              {/* Heute – offene Captures */}
              <section className="card captures-card">
                <div className="card-title">
                  Heute – offen
                  {openTodayCaptures.length > 0 && <span className="capture-open-badge">{openTodayCaptures.length}</span>}
                </div>
                {openTodayCaptures.length === 0
                  ? <div className="list-item-meta">Keine offenen Captures heute. Nutze den + Button.</div>
                  : (
                    <div className="captures-list">
                      {openTodayCaptures.map(c => (
                        <CaptureItem
                          key={c.id}
                          capture={c}
                          canPromote={canPromote}
                          onPromote={promoteCapture}
                          onDelete={deleteCapture}
                        />
                      ))}
                    </div>
                  )
                }
              </section>

              {/* Heute – verarbeitete Captures */}
              {todayCaptures.filter(c => c.processed).length > 0 && (
                <section className="card">
                  <div className="card-title" style={{color:'var(--text-muted)'}}>Heute – verarbeitet</div>
                  <div className="captures-list">
                    {todayCaptures.filter(c => c.processed).map(c => (
                      <CaptureItem
                        key={c.id}
                        capture={c}
                        canPromote={false}
                        onPromote={promoteCapture}
                        onDelete={deleteCapture}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Ältere offene Captures */}
              {olderCaptures.filter(c => !c.processed).length > 0 && (
                <section className="card">
                  <div className="card-title">
                    Älter – offen
                    <span className="capture-open-badge">{olderCaptures.filter(c => !c.processed).length}</span>
                  </div>
                  <div className="captures-list">
                    {olderCaptures.filter(c => !c.processed).slice(0, 20).map(c => (
                      <CaptureItem
                        key={c.id}
                        capture={c}
                        showDate
                        canPromote={canPromote}
                        onPromote={promoteCapture}
                        onDelete={deleteCapture}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Ältere verarbeitete Captures (kollabiert) */}
              {olderCaptures.filter(c => c.processed).length > 0 && (
                <section className="card">
                  <div className="card-title" style={{color:'var(--text-muted)',fontSize:12}}>
                    Älter – verarbeitet ({olderCaptures.filter(c => c.processed).length})
                  </div>
                  <div className="captures-list">
                    {olderCaptures.filter(c => c.processed).slice(0, 10).map(c => (
                      <CaptureItem
                        key={c.id}
                        capture={c}
                        showDate
                        canPromote={false}
                        onPromote={promoteCapture}
                        onDelete={deleteCapture}
                      />
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
              <div className="proj-filter-bar">
                {(['all','suno','remix','live','other'] as const).map(t => (
                  <button key={t} className={`proj-filter-btn${projTypeFilter===t?' active':''}`} onClick={()=>setProjTypeFilter(t)}>
                    {t==='all'?'★ Alle':t}
                  </button>
                ))}
              </div>
              {projects.length === 0 && (
                <div className="card" style={{textAlign:'center',padding:'32px 16px'}}>
                  <div style={{fontSize:32,marginBottom:10}}>🎵</div>
                  <div className="card-subtitle">Noch keine Projekte. Leg dein erstes an!</div>
                </div>
              )}
              {(['inarbeit','idee','pausiert','fertig'] as ProjectStatus[]).map(status => {
                const group = projects
                  .filter(p => p.status === status && (projTypeFilter==='all' || p.type===projTypeFilter))
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                if (!group.length) return null;
                const meta = STATUS_META[status];
                return (
                  <div key={status} className="projects-group">
                    <div className="projects-group-label">{meta.emoji} {meta.label} <span className="projects-group-count">({group.length})</span></div>
                    <div className="projects-grid">
                      {group.map(p => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          meta={meta}
                          isEditing={editingProject === p.id}
                          onEdit={setEditingProject}
                          onClose={() => setEditingProject(null)}
                          onUpdate={updateProject}
                          onDelete={deleteProject}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ── Wochenfokus View ── */}
          {view === 'week' && (
            <WeekFocusView
              weekFocusList={weekFocusList}
              history={history}
              onSave={setWeekFocusList}
            />
          )}

        </main>
      </div>
    </>
  );
};

// ── WeekFocusView ──────────────────────────────────────────────
interface WeekFocusViewProps {
  weekFocusList: WeekFocus[];
  history: DayRecord[];
  onSave: (list: WeekFocus[]) => void;
}

function WeekFocusView({ weekFocusList, history, onSave }: WeekFocusViewProps) {
  const currentWeekId = getWeekMonday();
  const weekDays      = getWeekDays(currentWeekId);
  const weekRange     = fmtWeekRange(currentWeekId);

  // Aktuellen Wochenfokus aus der Liste holen oder leer initialisieren
  const current = weekFocusList.find(w => w.weekId === currentWeekId) ?? { weekId: currentWeekId, themes: [] };

  // Lokaler Draft-State für die 3 Theme-Felder
  const [drafts, setDrafts] = useState<[string, string, string]>([
    current.themes[0] ?? '',
    current.themes[1] ?? '',
    current.themes[2] ?? '',
  ]);
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync wenn weekFocusList von außen aktualisiert wird
  useEffect(() => {
    const c = weekFocusList.find(w => w.weekId === currentWeekId);
    setDrafts([
      c?.themes[0] ?? '',
      c?.themes[1] ?? '',
      c?.themes[2] ?? '',
    ]);
  }, [weekFocusList, currentWeekId]);

  const handleDraftChange = (idx: 0 | 1 | 2, val: string) => {
    const next: [string, string, string] = [...drafts] as [string, string, string];
    next[idx] = val;
    setDrafts(next);
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const themes = next.map(t => t.trim()).filter(Boolean);
      const updated = [
        ...weekFocusList.filter(w => w.weekId !== currentWeekId),
        ...(themes.length ? [{ weekId: currentWeekId, themes }] : []),
      ];
      onSave(updated);
      setSaved(true);
    }, 700);
  };

  // Wochenstatistik aus History berechnen
  const weekRecords = history.filter(r => weekDays.includes(r.date));
  const activeDays  = weekRecords.length;
  const totalDone   = weekRecords.reduce((acc, r) => acc + r.tasks.filter(t => t.done).length, 0);
  const fullDays    = weekRecords.filter(r => r.tasks.length > 0 && r.tasks.every(t => t.done)).length;

  const hasThemes = drafts.some(d => d.trim());

  return (
    <>
      <header className="main-header">
        <div>
          <div className="main-header-title">📅 Wochenfokus</div>
          <div className="main-header-subtitle">{weekRange}</div>
        </div>
        {saved && <span className="daynote-saved-hint" style={{alignSelf:'center'}}>gespeichert</span>}
      </header>

      {/* Wochenthemen */}
      <section className="card week-themes-card">
        <div className="card-title">
          Woche ausrichten
        </div>
        <div className="card-subtitle">
          {hasThemes ? 'Deine Wochenprioritäten.' : 'Was soll diese Woche wirklich vorankommen?'}
        </div>
        <div className="week-themes-list">
          {([0, 1, 2] as const).map(idx => (
            <div key={idx} className="week-theme-row">
              <span className="week-theme-num">{idx + 1}</span>
              <input
                className="week-theme-input"
                placeholder={idx === 0 ? 'Wichtigstes Wochenthema…' : idx === 1 ? 'Zweites Thema (optional)…' : 'Drittes Thema (optional)…'}
                value={drafts[idx]}
                onChange={e => handleDraftChange(idx, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Wochenüberblick */}
      <section className="card week-overview-card">
        <div className="card-title">Woche auf einen Blick</div>
        <div className="card-subtitle">Big-3-Verlauf der laufenden Woche.</div>

        {/* Wochentag-Streifen */}
        <div className="week-days-strip">
          {weekDays.map((d, i) => {
            const rec = history.find(r => r.date === d);
            const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
            const isToday  = d === todayStr();
            let status: 'full' | 'partial' | 'none' | 'future' = 'future';
            if (rec && rec.tasks.length > 0) {
              const done = rec.tasks.filter(t => t.done).length;
              status = done === rec.tasks.length ? 'full' : done > 0 ? 'partial' : 'none';
            } else if (d <= todayStr() && rec) {
              status = 'none';
            }
            return (
              <div key={d} className={`week-day-cell ${status}${isToday ? ' today' : ''}`}>
                <span className="week-day-name">{dayNames[i]}</span>
                <span className="week-day-dot" />
                {rec && rec.tasks.length > 0 && (
                  <span className="week-day-count">
                    {rec.tasks.filter(t => t.done).length}/{rec.tasks.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Kompakte Stats */}
        <div className="week-stats-row">
          <div className="week-stat">
            <div className="week-stat-num">{activeDays}</div>
            <div className="week-stat-label">Tage aktiv</div>
          </div>
          <div className="week-stat">
            <div className="week-stat-num">{fullDays}</div>
            <div className="week-stat-label">Big 3 voll</div>
          </div>
          <div className="week-stat">
            <div className="week-stat-num">{totalDone}</div>
            <div className="week-stat-label">Tasks erledigt</div>
          </div>
        </div>
      </section>
    </>
  );
}
