import { supabase, getUserId } from './supabase';
import type {
  Capture,
  DayNote,
  DayRecord,
  DayTask,
  Project,
  RoutineDay,
  RoutineHistoryEntry,
  RoutineItem,
  WeekFocus,
} from './types';

const STORAGE_KEY      = 'freigeist-planner-v1';
const HISTORY_KEY      = 'freigeist-history-v1';
const CAPTURES_KEY     = 'freigeist-captures-v1';
const ROUTINES_KEY     = 'freigeist-routines-v1';
const ROUTINE_CFG_KEY  = 'freigeist-routine-config-v1';
const ROUTINE_HIST_KEY = 'freigeist-routine-history-v1';
const PROJECTS_KEY     = 'freigeist-projects-v1';
const DAY_NOTES_KEY    = 'freigeist-daynotes-v1';
const WEEK_FOCUS_KEY   = 'freigeist-weekfocus-v1';

// ── Tageswechsel-State ────────────────────────────────────
/** Speichert das Datum, für das die aktuellen Tasks geladen wurden. */
const TASKS_DATE_KEY = 'freigeist-tasks-date-v1';

function lsLoad<T>(key: string, fallback: T): T {
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) as T : fallback;
  } catch {
    return fallback;
  }
}

function lsSave(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

async function sbFetch(table: string): Promise<Record<string, unknown> | null> {
  try {
    const uid = getUserId();
    const { data, error } = await supabase.from(table).select('*').eq('user_id', uid).limit(1);
    if (error || !data?.length) return null;
    return data[0] as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function sbUpsert(table: string, payload: Record<string, unknown>) {
  try {
    const uid = getUserId();
    await supabase.from(table).upsert({ user_id: uid, ...payload }, { onConflict: 'user_id' });
  } catch { /* offline / misconfigured */ }
}

// ── Tasks (Big 3) ─────────────────────────────────────────

export type TasksBundle = {
  date: string;
  tasks: DayTask[];
};

/**
 * Lädt die Big-3-Tasks.
 * Gibt zusätzlich das gespeicherte Datum zurück, damit App.tsx
 * einen Tageswechsel erkennen und die Tasks archivieren kann.
 */
export async function loadTasksBundle(): Promise<TasksBundle> {
  const savedDate  = lsLoad<string>(TASKS_DATE_KEY, '');
  const savedTasks = lsLoad<DayTask[]>(STORAGE_KEY, []);

  const row = await sbFetch('tasks');
  if (row?.bundle) {
    const bundle = row.bundle as TasksBundle;
    lsSave(TASKS_DATE_KEY, bundle.date);
    lsSave(STORAGE_KEY, bundle.tasks);
    return bundle;
  }

  // Rückwärts-Kompatibilität: altes Format (nur Array) aus Supabase
  if (row?.data && Array.isArray(row.data)) {
    const tasks = row.data as DayTask[];
    lsSave(STORAGE_KEY, tasks);
    // Datum unbekannt → leer lassen, damit App.tsx Tageswechsel korrekt behandelt
    return { date: savedDate, tasks };
  }

  if (savedTasks.length || savedDate) {
    void sbUpsert('tasks', { bundle: { date: savedDate, tasks: savedTasks } });
  }
  return { date: savedDate, tasks: savedTasks };
}

export async function saveTasksBundle(bundle: TasksBundle) {
  lsSave(TASKS_DATE_KEY, bundle.date);
  lsSave(STORAGE_KEY, bundle.tasks);
  await sbUpsert('tasks', { bundle });
}

// ── Tracker ───────────────────────────────────────────────

export async function loadTracker(): Promise<DayRecord[]> {
  const fallback = lsLoad<DayRecord[]>(HISTORY_KEY, []);
  const row = await sbFetch('tracker');
  if (row?.data) {
    const history = row.data as DayRecord[];
    lsSave(HISTORY_KEY, history);
    return history;
  }
  if (fallback.length) void sbUpsert('tracker', { data: fallback });
  return fallback;
}

export async function saveTracker(history: DayRecord[]) {
  lsSave(HISTORY_KEY, history);
  await sbUpsert('tracker', { data: history });
}

// ── Captures ──────────────────────────────────────────────

export async function loadCaptures(): Promise<Capture[]> {
  const fallback = lsLoad<Capture[]>(CAPTURES_KEY, []);
  const row = await sbFetch('captures');
  if (row?.data) {
    const captures = row.data as Capture[];
    lsSave(CAPTURES_KEY, captures);
    return captures;
  }
  if (fallback.length) void sbUpsert('captures', { data: fallback });
  return fallback;
}

export async function saveCaptures(captures: Capture[]) {
  lsSave(CAPTURES_KEY, captures);
  await sbUpsert('captures', { data: captures });
}

// ── Routinen ──────────────────────────────────────────────

export type RoutinesBundle = {
  config: RoutineItem[];
  day: RoutineDay;
  history: RoutineHistoryEntry[];
};

export async function loadRoutines(defaultConfig: RoutineItem[]): Promise<RoutinesBundle> {
  const cfgFallback = lsLoad<RoutineItem[]>(ROUTINE_CFG_KEY, defaultConfig);
  const dayFallback = lsLoad<RoutineDay>(ROUTINES_KEY, { date: '', items: [] });
  const histFallback = lsLoad<RoutineHistoryEntry[]>(ROUTINE_HIST_KEY, []);

  const row = await sbFetch('routines');
  if (row?.data) {
    const bundle = row.data as RoutinesBundle;
    lsSave(ROUTINE_CFG_KEY, bundle.config);
    lsSave(ROUTINES_KEY, bundle.day);
    lsSave(ROUTINE_HIST_KEY, bundle.history);
    return bundle;
  }

  const bundle: RoutinesBundle = { config: cfgFallback, day: dayFallback, history: histFallback };
  if (cfgFallback.length || dayFallback.items.length || histFallback.length) {
    void sbUpsert('routines', { data: bundle });
  }
  return bundle;
}

export async function saveRoutines(bundle: RoutinesBundle) {
  lsSave(ROUTINE_CFG_KEY, bundle.config);
  lsSave(ROUTINES_KEY, bundle.day);
  lsSave(ROUTINE_HIST_KEY, bundle.history);
  await sbUpsert('routines', { data: bundle });
}

// ── Projekte ──────────────────────────────────────────────

export async function loadProjects(): Promise<Project[]> {
  const fallback = lsLoad<Project[]>(PROJECTS_KEY, []);
  const row = await sbFetch('projects');
  if (row?.data) {
    const projects = row.data as Project[];
    lsSave(PROJECTS_KEY, projects);
    return projects;
  }
  if (fallback.length) void sbUpsert('projects', { data: fallback });
  return fallback;
}

export async function saveProjects(projects: Project[]) {
  lsSave(PROJECTS_KEY, projects);
  await sbUpsert('projects', { data: projects });
}

// ── Tagesnotizen ──────────────────────────────────────────

export async function loadDayNotes(): Promise<DayNote[]> {
  const fallback = lsLoad<DayNote[]>(DAY_NOTES_KEY, []);
  const row = await sbFetch('daynotes');
  if (row?.data) {
    const notes = row.data as DayNote[];
    lsSave(DAY_NOTES_KEY, notes);
    return notes;
  }
  if (fallback.length) void sbUpsert('daynotes', { data: fallback });
  return fallback;
}

export async function saveDayNotes(notes: DayNote[]) {
  lsSave(DAY_NOTES_KEY, notes);
  await sbUpsert('daynotes', { data: notes });
}

// ── Wochenfokus ──────────────────────────────────────────────

export async function loadWeekFocusList(): Promise<WeekFocus[]> {
  const fallback = lsLoad<WeekFocus[]>(WEEK_FOCUS_KEY, []);
  const row = await sbFetch('weekfocus');
  if (row?.data) {
    const list = row.data as WeekFocus[];
    lsSave(WEEK_FOCUS_KEY, list);
    return list;
  }
  if (fallback.length) void sbUpsert('weekfocus', { data: fallback });
  return fallback;
}

export async function saveWeekFocusList(list: WeekFocus[]) {
  lsSave(WEEK_FOCUS_KEY, list);
  await sbUpsert('weekfocus', { data: list });
}
