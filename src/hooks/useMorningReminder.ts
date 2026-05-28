import { useEffect, useRef, useState } from 'react';

const REMINDER_KEY = 'freigeist-reminder-v1';
const LAST_FIRED_KEY = 'freigeist-reminder-lastfired';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useMorningReminder(onTrigger: () => void) {
  const [reminderTime, setReminderTimeState] = useState<string>(() => {
    try { return localStorage.getItem(REMINDER_KEY) || '08:00'; } catch { return '08:00'; }
  });
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFiredRef = useRef<string>(
    (() => { try { return localStorage.getItem(LAST_FIRED_KEY) || ''; } catch { return ''; } })()
  );

  useEffect(() => {
    if ('Notification' in window) setNotifPerm(Notification.permission);
  }, []);

  const setReminderTime = (t: string) => {
    setReminderTimeState(t);
    try { localStorage.setItem(REMINDER_KEY, t); } catch {}
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) return 'denied' as NotificationPermission;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    return perm;
  };

  const toggleReminder = async () => {
    if (!reminderEnabled && notifPerm !== 'granted') {
      await requestPermission();
    }
    setReminderEnabled((e) => !e);
  };

  useEffect(() => {
    if (!reminderEnabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayKey = `${todayStr()}_${hhmm}`;

      if (hhmm === reminderTime && lastFiredRef.current !== todayKey) {
        lastFiredRef.current = todayKey;
        try { localStorage.setItem(LAST_FIRED_KEY, todayKey); } catch {}

        if (notifPerm === 'granted') {
          try {
            new Notification('Freigeist - Guten Morgen!', {
              body: 'Was sind deine 3 Big Things fuer heute?',
              icon: '/apple-touch-icon.png',
              tag: 'big3-morning',
              requireInteraction: true,
            });
          } catch {}
        }

        onTrigger();
      }
    };

    check();
    intervalRef.current = setInterval(check, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [reminderEnabled, reminderTime, notifPerm, onTrigger]);

  return {
    reminderTime,
    setReminderTime,
    reminderEnabled,
    toggleReminder,
    notifPerm,
    requestPermission,
  };
}
