# iOS Kurzbefehle für Freigeist Planner

Mit der **Shortcuts App** auf iPhone/iPad kannst du den Focus-Modus
und den Morgen-Wecker direkt per Home-Screen-Button oder Siri steuern.

---

## ⬇️ Direkt installieren (iCloud Links)

| Kurzbefehl | Link |
|---|---|
| 🎯 **Freigeist FOKUS AN** | [Installieren](https://www.icloud.com/shortcuts/b7c5816a8d0a49949d746184cef1d8ab) |
| 😌 **Freigeist FOKUS AUS** | [Installieren](https://www.icloud.com/shortcuts/4663909f8e8d4c84a884a55dd36bbf23) |

> Einfach auf dem iPhone öffnen → „Kurzbefehl hinzufügen" → fertig.

---

## Was die Kurzbefehle machen

### 🎯 FOKUS AN
1. Aktiviert **Nicht stören** (iOS Fokus-Modus)
2. Öffnet `https://freigeistplanner.vercel.app/?focus=true`
   → App schaltet automatisch in den Fokus-Modus

### 😌 FOKUS AUS
1. Deaktiviert **Nicht stören**
2. Öffnet `https://freigeistplanner.vercel.app/?focus=false`
   → App beendet den Fokus-Modus

---

## Manuell erstellen (Fallback)

### FOKUS AN
1. **Kurzbefehle App** öffnen → **+** (Neu)
2. Name: `Freigeist FOKUS AN`
3. Aktionen:
   - `Fokus` → **Nicht stören** → **Aktivieren**
   - `URL öffnen` → `https://freigeistplanner.vercel.app/?focus=true`
4. Symbol wählen → **Zum Home-Bildschirm** hinzufügen

### FOKUS AUS
1. Kurzbefehl duplizieren
2. Name: `Freigeist FOKUS AUS`
3. Fokus-Aktion → **Deaktivieren**
4. URL → `https://freigeistplanner.vercel.app/?focus=false`

---

## Morgen-Wecker Automatisierung

1. **Kurzbefehle** → Tab **Automatisierungen** → **+**
2. Auslöser: **Wecker** → deinen Morgen-Wecker → „Wenn gestoppt"
3. Aktion: `URL öffnen` → `https://freigeistplanner.vercel.app/`
4. App erkennt die Uhrzeit und zeigt das Big-3-Popup automatisch

---

## Widget-Tipp

Beide Kurzbefehle als **2×1 Widget** auf dem Home-Bildschirm:
- 🎯 Fokus AN → linke Hälfte
- 😌 Fokus AUS → rechte Hälfte

---

## Push-Notifications auf iOS freischalten

1. Einstellungen → Safari → Erweitert → Experimentelle Funktionen
2. Web Push für Home-Screen Apps aktivieren
3. Freigeist zum Home-Bildschirm hinzufügen (Teilen → Zum Home-Bildschirm)
4. App öffnen → Benachrichtigung erlauben

> Push-Notifications funktionieren auf iOS **nur** wenn die PWA
> als Home-Screen App installiert ist (nicht im Safari-Tab).
