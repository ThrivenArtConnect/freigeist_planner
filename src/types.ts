export type DayTask = { id: string; label: string; done: boolean; };
export type DayRecord = { date: string; tasks: { label: string; done: boolean }[]; };

/** Optionaler Typ eines Captures. Bestehende Captures ohne Typ bleiben kompatibel. */
export type CaptureType = 'aufgabe' | 'idee' | 'link' | 'notiz';

export type Capture = {
  id: string;
  text: string;
  ts: string;
  date: string;
  /** Optional – fehlt bei alten Captures, wird als untypisiert behandelt. */
  type?: CaptureType;
  /** true = wurde verarbeitet (z.B. in Big 3 promoted). Fehlt bei alten Captures = false. */
  processed?: boolean;
};

export type RoutineItem = { id: string; label: string; done: boolean; category: 'morgen' | 'abend' | 'custom'; };
export type RoutineDay = { date: string; items: RoutineItem[]; };
export type RoutineHistoryEntry = { date: string; done: number; total: number; };
export type ProjectStatus = 'idee' | 'inarbeit' | 'fertig' | 'pausiert';
export type ProjectType = 'suno' | 'remix' | 'live' | 'other';
export type Project = { id: string; title: string; type: ProjectType; status: ProjectStatus; note: string; sunoUrl?: string; updatedAt: string; createdAt: string; };

/** Genau eine Tagesnotiz pro Datum (YYYY-MM-DD). */
export type DayNote = { date: string; text: string; };

export type View = 'planner' | 'tracker' | 'capture' | 'routines' | 'projects';
