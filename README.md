<p align="center">
  <img src="client/public/youtube-pro.svg" width="88" alt="YouTube Pro logo">
</p>

<h1 align="center">YouTube Pro</h1>

<p align="center">
  Recherchieren, verstehen, schreiben und ein YouTube-Video verpacken – in einem Local-first-Workflow.
</p>

YouTube Pro ist ein evidenzbasierter Arbeitsbereich für YouTube-Recherche, Ideenauswahl, Skript-Erstellung und Thumbnail-Erstellung. Es kombiniert öffentliche Datensätze der YouTube Data API v3 mit Gemini-Analysen, während API-Schlüssel auf dem Server bleiben.

YouTube Pro ist ein unabhängiges Projekt. Es steht in keiner Verbindung zu YouTube oder Google und wird von diesen weder unterstützt noch gesponsert. YouTube- und Google-Produktnamen sind Marken der jeweiligen Inhaber.

## Produkt-Tour

### Recherche-Analytics

Suche ein Thema, prüfe den zurückgegebenen Snapshot öffentlicher Daten, vergleiche Momentum und Veröffentlichungsmuster, sieh dir die Datenabdeckung an und gehe weiter zu KI-gestützten Insights und Ideen.

![YouTube Pro research analytics with video performance, momentum, duration, and publication graphs](docs/images/research-analytics.png)

### Quellvideos

Prüfe jedes Video, das im aktiven Snapshot öffentlicher Daten enthalten ist – mit Thumbnails, Kanalinformationen, Aufrufen, Veröffentlichungszeitpunkt, Likes und Kommentaren in einem Raster.

![YouTube Pro source-video grid showing every video used in the research snapshot](docs/images/research-source-videos.png)

### KI-Insights

Verwandle den aktiven Snapshot in ein schnell erfassbares Recherche-Briefing mit Zielgruppenfragen, Chancen-Themen, empfohlenen Schritten und einer klaren Trennung zwischen beobachteter Evidenz, Ableitung und Metriken, die YouTube Studio erfordern.

![YouTube Pro AI Insights with visual summaries, evidence balance, and an expandable evidence ledger](docs/images/research-ai-insights.png)

### Skript-Teleprompter

Verwandle eine ausgewählte Idee in ein bearbeitbares Skript und lies es dann in einem fokussierten Teleprompter mit Steuerung für Tempo, Größe, Marker, Rückgängig und Wiedergabe.

![YouTube Pro teleprompter with playback and reading controls](docs/images/script-teleprompter.png)

### Thumbnail-Creator

Beschreibe das gewünschte Ergebnis einmal, füge optionale Referenzen oder erweiterte Steuerelemente hinzu, generiere ein gut lesbares 16:9-Thumbnail und erstelle Varianten aus demselben Workflow.

![YouTube Pro Thumbnail Creator with a generated thumbnail preview and minimal creation controls](docs/images/thumbnail-creator.png)

Diese Screenshots stammen aus einem laufenden lokalen Entwicklungs-Build mit öffentlichen YouTube-Metadaten. Es handelt sich nicht um generierte Interface-Mockups.

## Workflow

Das Produkt folgt einem durchgehenden Workflow:

1. **Recherche**: Suche bis zu 50 öffentliche YouTube-Videos und prüfe Überblick, Analytics, Abdeckung und jedes zurückgegebene Video.
2. **KI-Insights**: Gemini analysiert exakt den aktiven Recherche-Snapshot. Aussagen behalten ihre Snapshot-Identität und die IDs der Quellvideos oder werden ausdrücklich als aggregierte Ableitung oder als "Erfordert YouTube Studio" gekennzeichnet.
3. **Fundierte Ideen**: Ideen werden nach gültigen Insights automatisch generiert. Wähle eine Idee aus und gehe dann explizit weiter zum Skript-Writer.
4. **Skript-Writer**: Generiere und bearbeite ein Skript aus dem ausgewählten Ideenpaket und dessen Evidenz. Die Neugenerierung von Abschnitten und Absätzen nutzt denselben begrenzten Evidenzkontext.
5. **Thumbnail-Creator**: Nutze das ausgewählte Versprechen und Thumbnail-Konzept, ergebnisorientierte Vorlagen, bearbeitbare Steuerelemente und bis zu drei zulässige Referenzen.

Es gibt keinen eigenständigen Ideen-Bildschirm. Der alte Pfad `/ideas` leitet zum Ideen-Abschnitt innerhalb der Recherche weiter.

Jeder Klick auf **Neuer Workflow** erstellt ein separates lokales Projekt. Die Seitenleiste behält die acht zuletzt verwendeten Workflows in der IndexedDB des Browsers, erlaubt das Umbenennen oder Löschen und öffnet den zuletzt aktiven Schritt Recherche, Skript oder Thumbnail erneut. Recherche-Snapshots, generierte Ideen, bearbeitbare Skripte, Thumbnail-Briefings und generierte Thumbnail-Ergebnisse werden gemeinsam wiederhergestellt. Hochgeladene Referenzbilder werden absichtlich nicht gespeichert, sodass Berechtigung und Dateiauswahl bei jeder späteren Generierung neu erfolgen.

## Anforderungen

- Node.js 22.12 oder neuer. CI prüft Node.js 22.12 und die aktuelle Node.js-24-LTS-Linie.
- Ein YouTube Data API v3-Schlüssel für die Recherche.
- Ein Gemini-API-Schlüssel für Insights, Ideen, Skripte und Thumbnails.

Kopiere die Beispielkonfiguration und fülle sie lokal aus:

```bash
cp .env.example .env
npm install
npm run dev
```

Der Server lauscht standardmäßig auf `127.0.0.1:5000`. Öffne `http://127.0.0.1:5000`.

Du kannst stattdessen auch ohne Schlüssel starten und sie in den **Einstellungen** eingeben. Die Einstellungen schreiben Ersetzungen in die ignorierte `.env`-Datei mit Berechtigungen nur für den Besitzer. Gespeicherte Werte werden nie an den Browser zurückgegeben. Die Einstellungen akzeptieren standardmäßig ausschließlich direkte Loopback-Anfragen vom selben Ursprung (Same-Origin) und lehnen weitergeleitete oder Reverse-Proxy-Anfragen ab. Für Server-Deployments siehe `ALLOW_REMOTE_SETTINGS` im Abschnitt [Deployment mit Coolify](#deployment-mit-coolify).

## Konfiguration

| Variable | Zweck | Standard |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | Suche und Anreicherung über die YouTube Data API v3 | Erforderlich für die Recherche |
| `GEMINI_API_KEY` | Gemini-Text- und Bildgenerierung | Erforderlich für KI-Funktionen |
| `GEMINI_TEXT_MODEL` | Modell für Recherche, Ideen, Skript und Neugenerierung | `gemini-3.7-flash` |
| `GEMINI_IMAGE_MODEL` | Modell für die Thumbnail-Generierung | `gemini-3.1-flash-image` |
| `OUTPUT_LANGUAGE` | Sprache der KI-generierten Inhalte (Insights, Ideen, Skripte, Thumbnail-Text) | `German (Deutsch)` |
| `PORT` | Lokaler HTTP-Port | `5000` |
| `HOST` | Bind-Adresse | `127.0.0.1` (im Docker-Image `0.0.0.0`) |
| `TRUST_PROXY` | Anzahl vertrauenswürdiger Proxy-Hops für `X-Forwarded-For` | leer (im Docker-Image `1`) |
| `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` | Aktivieren HTTP Basic Auth für die gesamte App außer `/api/health` | leer (deaktiviert) |
| `ALLOW_REMOTE_SETTINGS` | Erlaubt die Einstellungen-Seite über das Netz, nur zusammen mit Basic Auth | `false` |
| `ENV_FILE` | Pfad der `.env`-Datei, in die die Einstellungen-Seite schreibt | `.env` (im Docker-Image `/app/data/.env`) |

Die Einstellungsseite zeigt die Server-Allowlist und deren aktuelle Beschreibungen an. Modelle sind nicht im Client fest kodiert. Eine Änderung der Allowlist in `server/gemini-models.ts` ändert die verfügbaren Optionen in den Einstellungen.

## Deployment mit Coolify

Das Repository enthält ein produktionsfertiges [`Dockerfile`](Dockerfile) (mehrstufiger Build, Node 22 Alpine, läuft als unprivilegierter Benutzer `node`), eine [`docker-compose.yml`](docker-compose.yml) und einen Health-Check unter `/api/health`.

### Schritt für Schritt

1. **Repository pushen**: Dieses Repository in ein Git-Remote (GitHub, GitLab, Gitea) pushen, auf das Coolify zugreifen kann.
2. **Neue Ressource anlegen**: In Coolify *New Resource → Application* wählen, das Repository und den Branch (`main`) angeben.
3. **Build-Pack**: *Dockerfile* wählen (Coolify erkennt die Datei im Root automatisch). Alternativ *Docker Compose* mit `docker-compose.yml`.
4. **Port**: Unter *Ports Exposes* den Wert `5000` eintragen.
5. **Umgebungsvariablen** setzen (siehe Tabelle unten). Mindestens `YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `BASIC_AUTH_USER` und `BASIC_AUTH_PASSWORD`.
6. **Persistenz (optional)**: Unter *Storages* ein Volume auf `/app/data` mounten, wenn die Einstellungen-Seite Schlüssel serverseitig speichern soll (`ALLOW_REMOTE_SETTINGS=true`).
7. **Health-Check (optional)**: In Coolify den Health-Check auf Pfad `/api/health`, Port `5000` setzen. Das Docker-Image bringt zusätzlich einen eigenen `HEALTHCHECK` mit.
8. **Domain** zuweisen und *Deploy* klicken. Coolify stellt über Traefik automatisch HTTPS bereit.

### Umgebungsvariablen für Coolify

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | ja | YouTube Data API v3 |
| `GEMINI_API_KEY` | ja | Gemini Text- und Bildgenerierung |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` | dringend empfohlen | Aktiviert HTTP Basic Auth für die gesamte App (außer `/api/health`). Ohne Login sind deine kostenpflichtigen Schlüssel für jeden nutzbar, der die URL kennt. |
| `GEMINI_TEXT_MODEL` / `GEMINI_IMAGE_MODEL` | nein | Modellauswahl, Standard `gemini-3.7-flash` / `gemini-3.1-flash-image` |
| `OUTPUT_LANGUAGE` | nein | Sprache der KI-Ausgaben, Standard `German (Deutsch)` |
| `ALLOW_REMOTE_SETTINGS` | nein | `true` erlaubt Speichern über die Einstellungen-Seite. Wirkt nur mit Basic Auth. Braucht ein Volume auf `/app/data`. |
| `TRUST_PROXY` | nein | Im Image bereits `1` (ein Proxy-Hop, Traefik). |
| `HOST` / `PORT` | nein | Im Image bereits `0.0.0.0` / `5000`. |
| `ENV_FILE` | nein | Im Image bereits `/app/data/.env`. |

Hinweise:

- In Coolify gesetzte Umgebungsvariablen haben Vorrang vor Werten, die die Einstellungen-Seite in die `.env`-Datei schreibt. Wer die Schlüssel in Coolify pflegt, kann `ALLOW_REMOTE_SETTINGS` weglassen.
- Das Ratenlimit (10 kostenpflichtige Anfragen pro Client-Adresse und Minute) nutzt hinter Traefik den `X-Forwarded-For`-Header. Bei mehr als einem Proxy-Hop `TRUST_PROXY` anpassen.
- Der Server beendet sich bei `SIGTERM` sauber, sodass Redeploys in Coolify ohne hängende Container ablaufen.

### Lokal mit Docker testen

```bash
docker compose up --build
```

Anschließend `http://localhost:5000` öffnen. Die Variablen aus `.env` werden von Docker Compose automatisch eingelesen.

## Daten- und Anfragelimits

- Recherche-Suchbegriff: 1 bis 200 Zeichen.
- Recherche-Stichprobe: 1 bis 50 Videos pro Suchanfrage. Die Gesamtergebniszahl von YouTube ist ein Näherungswert und wird getrennt von der zurückgegebenen Stichprobe gekennzeichnet.
- Recherche-Anreicherung: öffentliche Videostatistiken, Dauer, Untertitel, Tags, Sprache, Themenkategorien, ausgewählte Statusfelder, Livestream-Details und öffentliche Kanal-Metadaten, sofern verfügbar. Fehlende oder private öffentliche Felder bleiben nicht verfügbar und werden nie mit Null aufgefüllt.
- KI-Evidenz-Eingabe: exakt der aktive, geordnete Snapshot, höchstens 50 Videos, dessen deterministische aggregierte Analytics, Anreicherungsabdeckung, Warnungen, Filter, Suchbegriff, Abrufzeitpunkt und Snapshot-ID.
- Skript-Eingabe: Thema bis 500 Zeichen, eigene Tonalitätsmerkmale bis 300, Notizen bis 5.000, Skript- oder Abschnittsinhalt bis 80.000, wo zutreffend.
- Thumbnail-Referenzen: PNG oder JPEG, 128 bis 4096 Pixel, höchstens 5 MB nach Aufbereitung pro Bild, 12 MB dekodiert insgesamt und nicht mehr als drei Referenzen. Der Browser lehnt Quelldateien über 10 MB bereits vor der Aufbereitung ab.
- Globaler JSON-Body: 18 MB, erforderlich für die begrenzten base64-kodierten Thumbnail-Referenzen. URL-kodierte Eingaben sind auf 64 KB und 100 Parameter begrenzt.
- Kostenpflichtige YouTube- und Gemini-Routen: 10 Anfragen pro Client-Adresse pro 60 Sekunden in diesem lokalen Single-Process-Server.

## Datenschutz- und Zugriffsmodell

- Es gibt keinen eigenen Login-Bildschirm, kein Initialpasswort, keine Thumbnail-Freischaltung und keine Pro-Script-Studio-Sperre. Für öffentliche Deployments lässt sich optional HTTP Basic Auth über `BASIC_AUTH_USER` und `BASIC_AUTH_PASSWORD` aktivieren.
- API-Schlüssel bleiben serverseitig und `.env` wird ignoriert.
- Der Verlauf der letzten Workflows bleibt im aktuellen Browserprofil. Er wird nicht an einen separaten Verlaufsdienst gesendet und enthält nie API-Schlüssel.
- Anfrage- und Antwort-Bodies werden nicht protokolliert.
- Die Anwendung bindet sich an Loopback, sofern `HOST` nicht ausdrücklich geändert wird.
- Setze den Server nie ohne Schutz dem Internet aus. Aktiviere für Fernzugriff Basic Auth oder eine Authentifizierung am Reverse-Proxy. Die Einstellungen-Seite bleibt ohne `ALLOW_REMOTE_SETTINGS` auf Loopback beschränkt.
- Der In-Memory-Ratenlimiter arbeitet pro Prozess. Er eignet sich für diesen Local-first-Standard und ein einzelnes Coolify-Container-Deployment, nicht für ein horizontal skaliertes Deployment. Hinter einem Proxy muss `TRUST_PROXY` gesetzt sein, sonst teilen sich alle Nutzer ein Limit.

Gemini-Bildausgaben enthalten Googles unsichtbare SynthID-Herkunftskennzeichnung. Die Anwendung fügt kein sichtbares Wasserzeichen hinzu und behauptet nicht, dass SynthID deaktiviert werden kann.

## Befehle

```bash
npm run dev       # development server
npm test          # contract and provider-behavior tests
npm run check     # TypeScript check
npm run build     # production client and server build
npm start         # run the production build
```

Die Continuous Integration führt bei jedem Pull Request und jedem Push auf `main` die Test-Suite, die TypeScript-Prüfung und den Produktions-Build aus.

## Technologie

- React 18, TypeScript, Vite, Tailwind CSS und shadcn/ui
- Express 5
- Google Gemini über `@google/genai`
- YouTube Data API v3
- Keine serverseitige Laufzeitdatenbank, kein Session-Store, keine Passport-Authentifizierung und kein von Replit verwalteter KI-Proxy

## Kontingente und Kosten

Die YouTube-Suche ist im Vergleich zur Video- und Kanal-Anreicherung kontingentintensiv. Gemini-Limits und -Preise variieren je nach Modell und Konto. Prüfe die aktuelle offizielle Dokumentation, bevor du Modelle änderst oder den Server aus der Ferne erreichbar machst:

- [YouTube Data API quota costs](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Gemini pricing](https://ai.google.dev/pricing)
- [Gemini image generation and SynthID](https://ai.google.dev/gemini-api/docs/image-generation)

## Lizenz

YouTube Pro ist Open Source unter der [Apache License 2.0](LICENSE).

## Mitwirken und Sicherheit

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für das lokale Quality Gate. Melde Sicherheitsprobleme vertraulich gemäß [SECURITY.md](SECURITY.md), niemals in einem öffentlichen Issue.
