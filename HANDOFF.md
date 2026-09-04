# Maintainer-Übergabe

Lies zuerst `README.md`. Es beschreibt das aktuelle Produkt, das Local-first-Zugriffsmodell, die exakten Eingabelimits und die Verifikationsbefehle.

## Aktuelle Produktübersicht

- `client/src/pages/research.tsx`: durchgehender Recherche-Arbeitsbereich mit Überblick, Analytics, allen zurückgegebenen Videos, Snapshot-gebundenen KI-Insights und automatisch generierten fundierten Ideen.
- `client/src/pages/script.tsx`: Übergabe der ausgewählten Idee, vollständige Skript-Generierung, Bearbeitung und fundierte Neugenerierung von Abschnitten oder Absätzen.
- `client/src/pages/thumbnail.tsx`: schrittbasierter Thumbnail-Creator mit serverseitig ausgewähltem Bildmodell, bearbeitbaren visuellen Steuerelementen, validierten Referenzbildern und Download-Status.
- `client/src/pages/settings.tsx`: Anbieterstatus, Ersatzschlüssel und Modellauswahl (nur Admins).
- `client/src/pages/login.tsx`, `client/src/lib/auth-context.tsx`, `client/src/components/user-menu.tsx`: Login, Sitzungszustand, Passwort ändern, Abmelden.
- `client/src/pages/admin.tsx` und `client/src/components/admin/*`: Admin-Bereich mit Übersicht, Benutzerverwaltung, Aktivitätsprotokoll und Inhalts-Dialog.
- `client/src/lib/workflow-context.tsx`: Kontinuität von Recherche über Skript bis Thumbnail.
- `server/youtube.ts`: YouTube-Suche, Anreicherung, Herkunftsnachweis, Warnungen bei Teilphasen und deterministische Snapshot-Identität.
- `server/gemini.ts`: aktive Gemini-Text- und Bildoperationen.
- `server/routes.ts`: API-Oberfläche und In-Memory-Ratenlimit.
- `server/settings.ts`: `.env`-Schreibzugriffe nur für den Besitzer; die Routen sind über `requireAdmin` geschützt.
- `server/db.ts`: PostgreSQL-Pool, idempotente Migrationen, Verbindungsaufbau mit Wiederholungen.
- `server/auth.ts`, `server/auth-routes.ts`: scrypt-Passwörter, Cookie-Sessions, Login/Logout, Admin-API für Benutzer, Aktivitäten und Inhalte.
- `server/activity.ts`: Aktivitätsprotokoll und Inhaltsspeicher, in `server/routes.ts` an jede Route angebunden.
- `shared/auth-contracts.ts`: Verträge für Login, Benutzer, Aktivitäten und Inhalte.
- `shared/schema.ts` und `shared/evidence-contracts.ts`: öffentliche Anfrage-, Antwort- und Evidenz-Verträge.

## Feste Grenzen

- Bewahre die Snapshot- und Evidenz-Verträge über Recherche, Ideen und Skript hinweg.
- Gib niemals API-Schlüssel an den Browser zurück und protokolliere keine Anfrage- oder Antwort-Bodies.
- Einstellungen und Admin-Bereich bleiben der Rolle `admin` vorbehalten. Jede Route unter `/api` außer Health und Login braucht eine Session.
- Fehler beim Protokollieren dürfen die eigentliche Anfrage nie scheitern lassen (`server/activity.ts` fängt alles ab).
- Die Thumbnail-Freischaltung, Pro Script Studio und der alte Replit-KI-Proxy sind nicht Teil dieses Produkts.
- Füge keine Lizenz hinzu, bevor der Besitzer eine ausgewählt hat.
- Führe während der automatisierten Verifikation keine Live-Anbieteraufrufe durch.

## Verifikation

```bash
npm test
npm run check
npm run build
```

Das Verhalten kostenpflichtiger Anbieter erfordert weiterhin einen expliziten Abnahmedurchlauf mit Live-Schlüssel. Halte diesen getrennt von Vertragstests und erfolgreichem Produktions-Build.
