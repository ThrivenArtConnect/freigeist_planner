import { useEffect, useState } from 'react';

const FOCUS_KEY = 'freigeist-focus-v1';

/**
 * useFocusMode
 * - Liest beim Start URL-Param ?focus=true|false (iOS Kurzbefehl-Integration)
 * - Speichert Zustand in localStorage
 * - Setzt data-focus auf <body> fuer CSS-basiertes Ausblenden
 */
export function useFocusMode() {
  const [focusActive, setFocusActive] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('focus') === 'true') return true;
    if (params.get('focus') === 'false') return false;
    try {
      return localStorage.getItem(FOCUS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.body.setAttribute('data-focus', String(focusActive));
    try {
      localStorage.setItem(FOCUS_KEY, String(focusActive));
    } catch {}
  }, [focusActive]);

  const toggle = () => setFocusActive((f) => !f);
  const activate = () => setFocusActive(true);
  const deactivate = () => setFocusActive(false);

  return { focusActive, toggle, activate, deactivate };
}
