# iOS Kurzbefehle fuer Freigeist Planner

Mit der **Shortcuts App** auf iPhone/iPad kannst du den Focus-Modus
und den Morgen-Wecker direkt per Home-Screen-Button oder Siri steuern.

---

## Focus-Modus AN

1. **Kurzbefehle App** oeffnen -> **+** (Neu)
2. Name: `Freigeist FOKUS AN`
3. Aktionen:
   - `Fokus` -> **Stoeren nicht** -> **Aktivieren**
   - `URL oeffnen` -> `https://DEINE-URL/?focus=true`
4. Symbol auswaehlen, **Zum Home-Bildschirm** hinzufuegen

## Focus-Modus AUS

1. Kurzbefehl duplizieren
2. Name: `Freigeist FOKUS AUS`
3. Fokus-Aktion -> **Deaktivieren**
4. URL -> `https://DEINE-URL/?focus=false`

---

## Morgen-Wecker Automatisierung

1. **Kurzbefehle** -> Tab **Automatisierungen** -> **+**
2. Ausloser: **Wecker** -> deinen Morgen-Wecker -> "Wenn gestoppt"
3. Aktion: `URL oeffnen` -> `https://DEINE-URL/`
4. App erkennt die Uhrzeit und zeigt das Big-3-Popup automatisch

> DEINE-URL ersetzen durch z.B. `https://freigeist-planner.vercel.app`

---

## Widget-Tipp

Beide Kurzbefehle als 2x1 Widget auf dem Home-Bildschirm:
- Fokus AN -> linke Haelfte
- Fokus AUS -> rechte Haelfte

---

## Push-Notifications auf iOS freischalten

1. Einstellungen -> Safari -> Erweitert -> Experimentelle Funktionen
2. Web Push fuer Home-Screen Apps aktivieren
3. Freigeist zum Home-Bildschirm hinzufuegen (Teilen -> Zum Home-Bildschirm)
4. App oeffnen -> Benachrichtigung erlauben

> Push-Notifications funktionieren auf iOS **nur** wenn die PWA
> als Home-Screen App installiert ist (nicht im Safari-Tab).
