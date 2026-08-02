# Freigeist Planner – Feature Backlog

## Arbeitsregel

Priorität wird nicht nach „coolem Feature“, sondern nach echter Alltagsnutzung entschieden.

Reihenfolge:

1. tägliche Nutzbarkeit
2. mobile Reibung senken
3. Capture und Ordnung
4. Projektklarheit
5. Reflexion und soziale Verbindung
6. Integrationen und Nice-to-haves

Status-Legende:

- [ ] offen
- [~] in Arbeit
- [x] umgesetzt
- [?] zuerst im Repository prüfen

---

# P0 – Nutzbar machen

Diese Funktionen entscheiden, ob die App täglich genutzt werden kann.

## Daily Big 3

- [?] Prüfen, wie Daily Big 3 aktuell implementiert ist
- [ ] maximal drei aktive Tagesprioritäten technisch erzwingen
- [ ] Big-3-Aufgabe schnell hinzufügen, bearbeiten, löschen und abhaken
- [ ] klarer Fortschritt: 0/3, 1/3, 2/3, 3/3
- [ ] Tageswechsel sauber behandeln
- [ ] erledigte Big 3 im Success Tracker speichern
- [ ] klarer Empty State, wenn noch keine Big 3 gesetzt sind

Akzeptanz:
- Der Tagesfokus ist beim Öffnen sofort sichtbar.
- Es gibt nie mehr als drei aktive Big-3-Aufgaben.
- Abschluss funktioniert mobil zuverlässig.

## Tagesnotiz

- [?] Prüfen, ob Tagesnotiz bereits vorhanden ist
- [ ] genau ein Freitextfeld pro Tag
- [ ] automatisch dem aktuellen Datum zugeordnet
- [ ] Speichern ohne zusätzliche Schritte
- [ ] frühere Tagesnotizen lesbar machen

Akzeptanz:
- Eine kurze Tagesreflexion kann ohne Navigation oder Formularstress gespeichert werden.

## Quick Capture / Inbox

- [?] Bestehenden Capture-Flow prüfen
- [ ] Floating Action Button für sofortige Erfassung
- [ ] eine Capture-Eingabe mit möglichst wenig Feldern
- [ ] Capture nach Typ erfassen: Aufgabe, Idee, Link, Notiz, Person
- [ ] Inbox-Ansicht für unbearbeitete Captures
- [ ] Badge mit Anzahl unbearbeiteter Captures
- [ ] Capture später in Aufgabe oder Projekt überführen
- [ ] Quick Filter nach Typ

Akzeptanz:
- Ein Gedanke ist auf Mobile in wenigen Sekunden gespeichert.
- Der Nutzer muss beim Capture noch keine perfekte Kategorie auswählen.

---

# P1 – Tägliche Orientierung

## Routinen und Anker

- [?] Prüfen, ob Routinen bereits existieren
- [ ] wenige frei anpassbare Routinen / Anker
- [ ] täglicher Reset pro Datum
- [ ] große mobile Toggle-Chips oder Buttons
- [ ] keine Streak-Bestrafung
- [ ] optional: „Heute reicht ein kleiner Schritt“-Hinweis

Beispiele:
- Wasser
- Duschen / Startklar machen
- Essen
- 10 Minuten Bewegung
- kurzer Aufräum-Anker
- Musik / Kreativstart

## Wochenfokus

- [ ] leichte Wochenansicht ohne komplexes Kalender-System
- [ ] ein bis drei Wochenfokus-Themen
- [ ] Überblick über offene und erledigte Big 3
- [ ] kurzer Wochenrückblick
- [ ] Reflexionsfrage: „Was lief gut?“

## Success Tracker

- [?] Prüfen, ob Tracker oder Kalender bereits existiert
- [ ] Kalenderansicht mit erledigten Big 3
- [ ] positive visuelle Rückmeldung bei erfolgreichen Tagen
- [ ] keine negative Hervorhebung bei leeren Tagen
- [ ] Wochen- und Monatsüberblick optional

---

# P1 – Projekte und Creator-Workflow

## Projektübersicht

- [?] Bestehende Projektstruktur prüfen
- [ ] Projekte nach aktiv, später, abgeschlossen sortieren
- [ ] klare Projektkarte mit Titel, Status und nächstem Schritt
- [ ] Aufgaben und Captures Projekten zuordnen
- [ ] Quick Filter nach Projekttyp
- [ ] Projekt-Suche
- [ ] klare Empty States

## Suno / Musik-Projekte

- [ ] optionales Suno-URL-Feld in Projektkarten
- [ ] Suno-Link mobil einfach öffnen
- [ ] Projekte können Typen wie Musik, Tech, Alltag oder Privat erhalten
- [ ] keine spezialisierte Musikproduktion erzwingen; nur schnelle Verlinkung und Ordnung

## Nächster Schritt

- [ ] pro aktivem Projekt ein klarer nächster Schritt
- [ ] optional aus Capture oder Aufgabe übernehmen
- [ ] auf Projektkarte direkt sichtbar

Akzeptanz:
- Der Nutzer kann ein Projekt in Sekunden wiederfinden.
- Der nächste Schritt ist klarer als eine lange Aufgabenliste.

---

# P2 – Menschen und Verbindung

## Average of Five

- [ ] Bereich „Average of Five“ anlegen
- [ ] bis zu fünf wichtigste Personen verwalten
- [ ] Person anlegen, bearbeiten und entfernen
- [ ] Felder: Name, Rolle, Einfluss, letzter Kontakt, Gefühl nach Kontakt, Notiz
- [ ] ruhige Reflexionsansicht
- [ ] keine öffentliche, bewertende oder sozialvergleichende Logik
- [ ] Daten standardmäßig privat behandeln

Akzeptanz:
- Die Funktion hilft bei bewusster sozialer Reflexion, ohne wie ein CRM zu wirken.

## Liebste Personen

- [ ] Bereich für wichtige Personen oder Favoriten
- [ ] Personen aus Average of Five übernehmen können
- [ ] optional eigene Favoriten unabhängig davon anlegen
- [ ] schnelle mobile Auswahl einer Person

## Kontakt-Kurzbefehle

- [ ] Vorlagen für Terminerinnerung
- [ ] Vorlagen für Terminanfrage
- [ ] Vorlage „Ich möchte reden“
- [ ] Vorlage „Ich denke an dich“
- [ ] Vorlage „Ich melde mich später“
- [ ] Freitext-Vorlage
- [ ] Copy-Button für jede Vorlage
- [ ] Share-Sheet-Unterstützung prüfen
- [ ] später optional: deeplink-basierte Messenger-Übergaben

Akzeptanz:
- Eine Kontaktvorlage kann mit wenigen Taps kopiert oder geteilt werden.
- Version 1 braucht keine direkte Messenger- oder Kalenderintegration.

---

# P2 – Mobile UX und Stabilität

## Mobile Bedienung

- [ ] alle Action Buttons auf reale Touch-Nutzung prüfen
- [ ] Touch Targets mindestens ausreichend groß machen
- [ ] Floating Capture Button nicht durch andere Elemente verdecken
- [ ] lange Listen, Modals und Bottom Sheets auf iPhone testen
- [ ] keine Hover-only Interaktionen
- [ ] Fokuszustände und aktive Zustände sichtbar machen

## PWA und Installation

- [?] Manifest, Icons und Service Worker prüfen
- [ ] App-Icon auf iPhone zuverlässig prüfen
- [ ] Apple Touch Icon prüfen
- [ ] Offline-Grundfunktion prüfen
- [ ] Installations- und Update-Verhalten dokumentieren

## Daten und Sync

- [?] Lokale Speicherung und vorhandene Supabase-Integration analysieren
- [ ] klare Datenquelle definieren
- [ ] keine Daten verlieren bei Reload oder Update
- [ ] Lade-, Leer- und Fehlerzustände bauen
- [ ] sensible Zugangsdaten nie im Repository speichern
- [ ] Sync erst erweitern, wenn Kernfunktionen stabil sind

---

# P3 – Später prüfen

Diese Punkte erst anfangen, wenn P0 bis P2 stabil und wirklich genutzt werden.

- [ ] Erinnerungen / lokale Notifications
- [ ] Kalenderintegration
- [ ] direkter Versand über Messenger-Deep-Links
- [ ] Energie- oder Stimmungs-Check-in
- [ ] Projektvorlagen
- [ ] wiederkehrende Aufgaben
- [ ] Export / Backup
- [ ] Mehrgeräte-Sync verbessern
- [ ] Datenschutz- und Datenexport-Seite
- [ ] Desktop-spezifische Schnellzugriffe
- [ ] Widgets

---

# Nicht im aktuellen Scope

Diese Ideen vorerst nicht bauen:

- Team- oder Kundenverwaltung
- komplexes Kanban-System
- detailliertes Zeiterfassungssystem
- Social Feed
- öffentliches Profil
- Ranking, Punkte oder harte Streaks
- KI-Chat als Kernfeature
- zu viele Integrationen gleichzeitig
- kompletter Kalender-Ersatz
