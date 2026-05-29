export type DayTask = { id: string; label: string; done: boolean; };
export type DayRecord = { date: string; tasks: { label: string; done: boolean }[]; };
export type Capture = { id: string; text: string; ts: string; date: string; };
export type RoutineItem = { id: string; label: string; done: boolean; category: 'morgen' | 'abend' | 'custom'; };
export type RoutineDay = { date: string; items: RoutineItem[]; };
export type RoutineHistoryEntry = { date: string; done: number; total: number; };
export type ProjectStatus = 'idee' | 'inarbeit' | 'fertig' | 'pausiert';
export type ProjectType = 'suno' | 'remix' | 'live' | 'other';
export type Project = { id: string; title: string; type: ProjectType; status: ProjectStatus; note: string; sunoUrl?: string; updatedAt: string; createdAt: string; };

export type View = 'planner' | 'tracker' | 'capture' | 'routines' | 'projects';
