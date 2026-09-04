# Portierungsleitfaden

Die App ist Local-first und hat keine Laufzeitdatenbank und keine Authentifizierungsschicht. Für den aktuellen Workflow und die Einrichtung lies `README.md`.

## Portierbare Grenzen

- Recherche-Backend: `server/youtube.ts`, `server/provider-errors.ts` und die Recherche-Schemas in `shared/schema.ts`.
- Evidenz- und KI-Backend: `server/gemini.ts`, `shared/evidence-contracts.ts` und `server/script-regeneration-contract.ts`.
- Thumbnail-Backend: `server/thumbnail-contract.ts`, `server/gemini-models.ts` und die Thumbnail-Routen in `server/routes.ts`.
- Client-Workflow: die Seiten Recherche, Skript, Thumbnail und Einstellungen sowie `client/src/lib/workflow-context.tsx`.

Der Browser erwartet Same-Origin-Routen unter `/api`. Die UI verwendet Wouter, TanStack Query, shadcn/ui-Primitives und die Design-Tokens in `client/src/index.css`.

## Sicherheitsanforderungen beim Portieren

- Halte Google-Zugangsdaten auf dem Server.
- Bewahre die strikte Zod-Validierung und die Prüfungen der Snapshot-Identität.
- Ersetze den In-Memory-Limiter durch einen gemeinsamen Limiter, bevor du mehrere Instanzen betreibst.
- Die lokalen Einstellungen lehnen normale proxy-weitergeleitete Anfragen absichtlich ab. Deaktiviere sie oder stelle sie hinter eine separate authentifizierte Administration, falls die Anwendung remote wird.
- Füge Authentifizierung hinzu, bevor du kostenpflichtige Anbieter-Routen nicht vertrauenswürdigen Nutzern zugänglich machst.
- Halte das globale Body-Limit groß genug für die dokumentierten 12 MB dekodierter Thumbnail-Referenzen insgesamt, stelle aber keinen unbegrenzten oder 50-MB-Standard wieder her.

## Routen

- `GET /api/youtube/search`
- `GET /api/settings/status`
- `PUT /api/settings/api-keys`
- `POST /api/research/insights`
- `POST /api/ideas/generate`
- `POST /api/script/generate`
- `POST /api/script/regenerate-titles`
- `POST /api/script/regenerate-section`
- `POST /api/script/regenerate-paragraph`
- `POST /api/script/extract-narration`
- `POST /api/thumbnail/generate`
- `POST /api/thumbnail/suggestions`

Der stillgelegte Login, die Passwort-Freischaltung, Pro Script Studio, die von Replit verwaltete Videogenerierung und die Datenbank-/Session-Routen dürfen nicht als versehentlicher Kompatibilitätscode wieder eingeführt werden.
