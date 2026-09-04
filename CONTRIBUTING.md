# Mitwirken an YouTube Pro

YouTube Pro begrüßt fokussierte Beiträge, die den durchgehenden Workflow von Recherche über Insights, Ideen und Skript-Writer bis zum Thumbnail-Creator bewahren.

## Lokale Einrichtung

1. Installiere Node.js 22.12 oder neuer.
2. Führe `npm install` aus.
3. Kopiere `.env.example` nach `.env` und trage deine eigenen Anbieter-Schlüssel ein, oder konfiguriere sie über die lokale Einstellungsseite.
4. Führe `npm run dev` aus und öffne `http://127.0.0.1:5000`.

Committe niemals `.env`, Anbieter-Schlüssel, generierte private Daten oder Exporte mit privaten Kanalinformationen.

## Erforderliche Prüfungen

Führe alle Prüfungen aus, bevor du einen Pull Request eröffnest:

```bash
npm test
npm run check
npm run build
```

Die automatisierte Suite verwendet Fixtures und Mocks. Sie darf kein YouTube- oder Gemini-Kontingent verbrauchen.

## Pull Requests

- Halte jede Änderung fokussiert und erläutere ihre Auswirkung für Nutzer.
- Bewahre Snapshot-IDs und Quellvideo-Evidenz über die Phasen Recherche, Insights, Ideen und Skript hinweg.
- Halte Anbieter-Zugangsdaten und kostenpflichtige Aufrufe auf dem Server.
- Ergänze oder aktualisiere fokussierte Tests, wenn du Anfrage-Verträge, Anbieterverhalten, Evidenzregeln, Exporte oder Sicherheitsgrenzen änderst.
- Füge bei wesentlichen Interface-Änderungen Screenshots im dunklen und hellen Design bei, wenn praktikabel.
- Gib an, welche Prüfungen ausgeführt wurden und welche Abnahmearbeiten noch ausstehen.

## Lizenz und Beiträge

Mit deinem Beitrag stimmst du zu, dass deine Beiträge unter der [Apache License 2.0](LICENSE) des Repositorys lizenziert werden.
