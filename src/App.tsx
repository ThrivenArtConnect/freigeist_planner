import React, { useEffect, useState } from 'react';

export type DayTask = {
  id: string;
  label: string;
  done: boolean;
};

const STORAGE_KEY = 'freigeist-planner-v1';

function loadState(): DayTask[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveState(tasks: DayTask[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // ignore
  }
}

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<DayTask[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    setTasks(loadState());
  }, []);

  useEffect(() => {
    saveState(tasks);
  }, [tasks]);

  const addTask = () => {
    const label = input.trim();
    if (!label) return;
    if (tasks.length >= 3) {
      alert('Maximal 3 Tagesprioritäten. Streiche zuerst etwas, bevor du Neues drauflädst.');
      return;
    }
    setTasks([
      ...tasks,
      { id: Date.now().toString(), label, done: false },
    ]);
    setInput('');
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const clearTasks = () => {
    if (!window.confirm('Tagesliste wirklich zurücksetzen?')) return;
    setTasks([]);
  };

  const doneCount = tasks.filter(t => t.done).length;

  return (
    <div className="app-root">
      <aside className="sidebar">
        <h1>Freigeist Planner</h1>
        <div className="tagline">ADHS-taugliches Minimal-Board für deinen Tag.</div>

        <div className="nav-section-title">Heute</div>
        <div className="nav-item active">
          <span className="nav-dot" />
          <span>Daily Big 3</span>
        </div>

        <div className="nav-section-title">Später erweitern</div>
        <div className="nav-item">
          <span>⚡ Quick Capture</span>
        </div>
        <div className="nav-item">
          <span>♻ Routinen</span>
        </div>
        <div className="nav-item">
          <span>🎧 Musik / Projekte</span>
        </div>
      </aside>

      <main className="main">
        <header className="main-header">
          <div>
            <div className="main-header-title">Dein Tag als Freigeist</div>
            <div className="main-header-subtitle">
              Maximal 3 echte Prioritäten. Alles andere ist Bonus.
            </div>
            <div className="pill-row">
              <div className="pill">ADHS-freundlich</div>
              <div className="pill">lokal gespeichert</div>
              <div className="pill">später erweiterbar</div>
            </div>
          </div>
          <div className="pill">
            {doneCount}/{tasks.length || 3} erledigt
          </div>
        </header>

        <section className="card-row">
          <section className="card">
            <div className="card-title">Daily Big 3</div>
            <div className="card-subtitle">
              Was muss passieren, damit sich heute nicht nach Chaos, sondern nach Fortschritt anfühlt?
            </div>

            <div className="list">
              {tasks.map(task => (
                <label key={task.id} className="list-item">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                  />
                  <div className="list-item-label">
                    {task.label}
                    <div className="list-item-meta">
                      {task.done ? 'fertig' : 'offen'}
                    </div>
                  </div>
                </label>
              ))}
              {tasks.length === 0 && (
                <div className="list-item-meta">
                  Noch nichts drin. Frag dich: Wenn nur eine Sache heute klappt – was wäre das?
                </div>
              )}
            </div>

            <div className="input-row">
              <input
                placeholder="Neue Priorität (Musik, Alltag, Papierkram, ...)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addTask();
                }}
              />
              <button onClick={addTask}>+ Hinzufügen</button>
            </div>

            <div className="list-item-meta" style={{ marginTop: 8 }}>
              Halte es radikal klein. Max 3. Streichen ist erlaubt.
              <button
                style={{
                  marginLeft: 8,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: 11,
                }}
                onClick={clearTasks}
              >
                Tagesliste zurücksetzen
              </button>
            </div>
          </section>

          <section className="card">
            <div className="card-title">Anker & Ideen</div>
            <div className="card-subtitle">
              Deine Regeln für den Alltag – bevor du sie in Features baust.
            </div>
            <div className="chip-row">
              <div className="chip">☕ Nach dem Aufstehen: 3 Dinge wählen</div>
              <div className="chip">🎧 Erst Alltag, dann Musik</div>
              <div className="chip">🧾 5-Minuten-Regel für Papierkram</div>
              <div className="chip">📵 Fokusmodus für Sessions</div>
              <div className="chip">👥 Freundetage ohne schlechtes Gewissen</div>
            </div>
            <div className="list-item-meta" style={{ marginTop: 10 }}>
              Bau dir diese App in deinem Tempo weiter aus: Quick Capture, Routinen, Projekt-Boards, Suno-Prompts.
            </div>
          </section>
        </section>
      </main>
    </div>
  );
};
