# Maintainer-Übergabe

Lies zuerst `README.md`. Es beschreibt das aktuelle Produkt, das Local-first-Zugriffsmodell, die exakten Eingabelimits und die Verifikationsbefehle.

## Aktuelle Produktübersicht

- `client/src/pages/research.tsx`: durchgehender Recherche-Arbeitsbereich mit Überblick, Analytics, allen zurückgegebenen Videos, Snapshot-gebundenen KI-Insights und automatisch generierten fundierten Ideen.
- `client/src/pages/script.tsx`: Übergabe der ausgewählten Idee, vollständige Skript-Generierung, Bearbeitung und fundierte Neugenerierung von Abschnitten oder Absätzen.
- `client/src/pages/thumbnail.tsx`: schrittbasierter Thumbnail-Creator mit serverseitig ausgewähltem Bildmodell, bearbeitbaren visuellen Steuerelementen, validierten Referenzbildern und Download-Status.
- `client/src/pages/settings.tsx`: lokaler Anbieterstatus, Ersatzschlüssel und Modellauswahl.
- `client/src/lib/workflow-context.tsx`: Kontinuität von Recherche über Skript bis Thumbnail.
- `server/youtube.ts`: YouTube-Suche, Anreicherung, Herkunftsnachweis, Warnungen bei Teilphasen und deterministische Snapshot-Identität.
- `server/gemini.ts`: aktive Gemini-Text- und Bildoperationen.
- `server/routes.ts`: API-Oberfläche und In-Memory-Ratenlimit.
- `server/settings.ts`: Nur-lokal-Richtlinie für Einstellungen und `.env`-Schreibzugriffe nur für den Besitzer.
- `shared/schema.ts` und `shared/evidence-contracts.ts`: öffentliche Anfrage-, Antwort- und Evidenz-Verträge.

## Feste Grenzen

- Bewahre die Snapshot- und Evidenz-Verträge über Recherche, Ideen und Skript hinweg.
- Gib niemals API-Schlüssel an den Browser zurück und protokolliere keine Anfrage- oder Antwort-Bodies.
- Halte die Einstellungen nur lokal, sofern kein separat authentifiziertes Design für Remote-Geheimnisverwaltung implementiert ist.
- Der stillgelegte Login, das Initialpasswort, die Thumbnail-Freischaltung, Pro Script Studio, der alte Replit-KI-Proxy und der Datenbank-/Session-Stack sind nicht Teil dieses Produkts.
- Füge keine Lizenz hinzu, bevor der Besitzer eine ausgewählt hat.
- Führe während der automatisierten Verifikation keine Live-Anbieteraufrufe durch.

## Verifikation

```bash
npm test
npm run check
npm run build
```

Das Verhalten kostenpflichtiger Anbieter erfordert weiterhin einen expliziten Abnahmedurchlauf mit Live-Schlüssel. Halte diesen getrennt von Vertragstests und erfolgreichem Produktions-Build.
