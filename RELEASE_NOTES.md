# Release Notes

## 2026-08-25: Version 1.0.0 – öffentliche Veröffentlichung

Diese Version führt den vollständigen Local-first-Workflow, die aktuelle Produktdokumentation und die Release-Prüfungen im öffentlichen GitHub-Repository zusammen.

### Enthalten

- **Vollständiger Erstellungs-Workflow:** Recherche, evidenzbasierte KI-Insights, automatisch generierte Ideen, Skript-Writer mit Teleprompter und Thumbnail-Creator bleiben über ein wiederherstellbares Projekt verbunden.
- **Steuerung des Workflow-Verlaufs:** Die acht zuletzt verwendeten browserlokalen Projekte können nach ausdrücklicher Bestätigung erneut geöffnet, umbenannt oder gelöscht werden.
- **Aktuelle Produkt-Tour:** Fünf aktuelle Screenshots dokumentieren Recherche-Analytics, Quellvideos, KI-Insights, den Skript-Teleprompter und den Thumbnail-Creator.
- **Launch-Paket:** Ein fünfminütiges Demonstrationsskript, eine Präsentation, eine Shot-Liste und ein YouTube-Veröffentlichungspaket sind unter `docs/launch-video/` verfügbar.
- **Open-Source-Repository:** Das exakte Release ist unter `AgriciDaniel/youtubepro` unter der Apache License 2.0 verfügbar.

### Verifikation

- `npm test`: 62 Tests bestanden
- `npm run check`: TypeScript-Prüfung bestanden
- `npm run build`: Produktions-Builds für Client und Server abgeschlossen
- `npm audit --audit-level=high`: 0 Schwachstellen
- Aktueller Quellcode-Scan außerhalb der ignorierten `.env`: 0 Geheimnisfunde
- GitHub Actions führt dieselben Test-, TypeScript- und Produktions-Build-Gates bei jedem Push und Pull Request aus

### Release-Grenze

Dies ist das Release einer Local-first-Anwendung, kein gehärteter Mehrbenutzer-Internetdienst. Setze den Server nicht direkt dem Internet aus, ohne die in `SECURITY.md` beschriebenen Kontrollen für Authentifizierung, Geheimnisverwaltung, gemeinsames Ratenlimit und deploymentspezifische Sicherheit.

## 2026-08-24: Wiederherstellbare lokale Workflows und überarbeitete Recherche-Erfahrung

Dieses Update macht es einfacher, YouTube Pro zu verlassen und später fortzusetzen. Recherche, generierte Ideen, Skripte und Thumbnail-Arbeit bleiben jetzt als lokale Workflows gruppiert, während das Recherche-Briefing dichte KI-Ausgaben in einem visuelleren, schnell erfassbaren Format präsentiert.

### Hinzugefügt

- **Letzte Workflows:** Die Seitenleiste listet die acht zuletzt aktualisierten Projekte auf und öffnet den zuletzt sinnvollen Schritt in Recherche, Skript-Writer oder Thumbnail-Creator erneut.
- **Browserlokale Persistenz:** Recherche-Snapshots, KI-Insights, fundierte Ideen, Skript-Ausgaben und -Überarbeitungen, Thumbnail-Briefings und generierte Thumbnail-Ergebnisse werden in IndexedDB gespeichert.
- **Unabhängige Projekte:** **Neuer Workflow** startet ein neues Projekt, ohne frühere Arbeit in der Liste der letzten Workflows zu ersetzen.
- **Workflow-Verwaltung:** Letzte Projekte können über die Seitenleiste umbenannt oder nach ausdrücklicher Bestätigung gelöscht werden.
- **Tests für Workflow-Hilfsfunktionen:** Gemeinsames Verhalten für Titel, Reihenfolge, Deduplizierung und Verlaufslimit ist jetzt durch fokussierte automatisierte Tests abgedeckt.

### Verbessert

- **Lesbarkeit der Recherche:** KI-Insights verwenden kompakte visuelle Zusammenfassungen, ausklappbare Erkenntnisse, Chancen-Karten sowie eingeklappte Evidenz- und Methodik-Details.
- **Klarheit der Evidenz:** Beobachtete Erkenntnisse, abgeleitete Empfehlungen und Metriken, die YouTube-Studio-Daten des Kanalinhabers erfordern, bleiben sichtbar getrennt.
- **Fortsetzungsverhalten:** Recherche-Ergebnisse werden gespeichert, sobald der Snapshot öffentlicher Daten zurückkommt, und anschließend erneut angereichert, wenn KI-Insights und fundierte Ideen fertig sind.
- **Skript-Writer:** Generierte Ausgaben, unterstützende Metadaten, Formulareingaben und Nutzer-Überarbeitungen werden mit dem ausgewählten Workflow wiederhergestellt.
- **Thumbnail-Creator:** Briefing, erweiterte visuelle Steuerelemente, generiertes Bild und Modellinformationen werden mit dem ausgewählten Workflow wiederhergestellt.
- **Navigation:** Das Öffnen eines gespeicherten Workflows führt zum sinnvollsten abgeschlossenen Schritt statt zu einer leeren Route.

### Dokumentation

- Die Aufnahmen der Produkt-Tour wurden durch fünf aktuelle Screenshots ersetzt, die Recherche-Analytics, Quellvideos, KI-Insights, den Skript-Teleprompter und den Thumbnail-Creator abdecken.
- Das README wurde um das Verhalten des Workflow-Verlaufs, die Grenzen der lokalen Speicherung und Details zur Wiederherstellung erweitert.

### Datenschutz- und Speichergrenzen

- Der Workflow-Verlauf bleibt im aktuellen Browserprofil. Er wird nicht mit einem Server oder einem anderen Gerät synchronisiert.
- API-Schlüssel bleiben serverseitig und werden nicht in den Workflow-Verlauf geschrieben.
- Hochgeladene Thumbnail-Referenzbilder werden nicht gespeichert. Nutzer müssen sie für eine spätere Generierung erneut auswählen.
- Die Recherche verwendet weiterhin öffentliche Metadaten der YouTube Data API. Metriken, die nur dem Inhaber zugänglich sind, wie Impressionen, Klickrate, Traffic-Quellen und Retention, erfordern YouTube Studio und werden nicht als öffentliche Fakten abgeleitet.

### Verifikation

- `npm test`: 61 Tests bestanden
- `npm run check`: TypeScript-Prüfung bestanden
- `npm run build`: Produktions-Builds für Client und Server abgeschlossen
- Prüfungen der README-Bildreferenzen und der Quellbild-Prüfsummen bestanden
