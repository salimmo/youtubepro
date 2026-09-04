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
- Eine PostgreSQL-Datenbank (Version 14 oder neuer) für Login, Benutzer und Aktivitätsprotokoll. Lokal reicht `docker compose up postgres`.
- Ein YouTube Data API v3-Schlüssel für die Recherche.
- Ein Gemini-API-Schlüssel für Insights, Ideen, Skripte und Thumbnails.

Kopiere die Beispielkonfiguration und fülle sie lokal aus:

```bash
cp .env.example .env
npm install
npm run dev
```

Der Server lauscht standardmäßig auf `127.0.0.1:5000`. Öffne `http://127.0.0.1:5000` und melde dich mit dem Admin-Konto aus `ADMIN_USER` und `ADMIN_PASSWORD` an.

Du kannst auch ohne API-Schlüssel starten und sie als Admin in den **Einstellungen** eingeben. Die Einstellungen schreiben Ersetzungen in die ignorierte `.env`-Datei mit Berechtigungen nur für den Besitzer. Gespeicherte Werte werden nie an den Browser zurückgegeben.

## Login, Rollen und Aktivitätsprotokoll

Die App hat ein eigenes Login mit zwei Rollen. Alle Daten dazu liegen in PostgreSQL.

- **Admin**: Darf alles benutzen, verwaltet Benutzer, sieht die Einstellungen und den Admin-Bereich mit dem kompletten Aktivitätsprotokoll aller Benutzer.
- **Benutzer**: Darf Recherche, Skript-Writer und Thumbnail-Creator uneingeschränkt benutzen, kann sein Passwort ändern, sieht aber weder Einstellungen noch Admin-Bereich noch das Protokoll.

Der erste Admin wird beim Start aus `ADMIN_USER` und `ADMIN_PASSWORD` angelegt, solange die Datenbank noch keine Benutzer enthält. Weitere Konten legt der Admin unter **Admin → Benutzer** mit Startpasswort an. Es gibt keine öffentliche Registrierung. Konten lassen sich deaktivieren, Passwörter zurücksetzen und Rollen ändern.

Das Aktivitätsprotokoll unter **Admin → Aktivitäten** speichert pro Aktion Zeitpunkt, Benutzer, Aktion, Zusammenfassung, Status, Dauer und Client-Adresse. Zusätzlich werden die erzeugten Inhalte gespeichert und sind dort direkt einsehbar: Recherche-Snapshots mit Videoliste, KI-Insights, Ideen, komplette Skripte, neu generierte Abschnitte und Absätze, Titelvorschläge, Sprechtexte und Thumbnails als Bild. Auch Anmeldungen, fehlgeschlagene Anmeldungen, Abmeldungen, Passwortänderungen und Admin-Aktionen werden protokolliert.

Technik: Passwörter werden mit scrypt gehasht. Die Sitzung läuft über ein `HttpOnly`-Cookie mit `SameSite=Lax`, hinter HTTPS zusätzlich `Secure`, und verlängert sich bei Nutzung (Standard 30 Tage, `SESSION_TTL_HOURS`). Login-Versuche sind auf 10 pro Adresse und 10 Minuten begrenzt. Verändernde Anfragen mit fremdem `Origin` werden abgelehnt.

Hinweis: Wer Kolleginnen und Kollegen ein Konto gibt, sollte sie über das Protokoll informieren. In Deutschland gelten dafür Datenschutz- und gegebenenfalls Mitbestimmungsregeln.

## Konfiguration

| Variable | Zweck | Standard |
| --- | --- | --- |
| `YOUTUBE_API_KEY` | Suche und Anreicherung über die YouTube Data API v3 | Erforderlich für die Recherche |
| `GEMINI_API_KEY` | Gemini-Text- und Bildgenerierung | Erforderlich für KI-Funktionen |
| `GEMINI_TEXT_MODEL` | Modell für Recherche, Ideen, Skript und Neugenerierung | `gemini-3.7-flash` |
| `GEMINI_IMAGE_MODEL` | Modell für die Thumbnail-Generierung | `gemini-3.1-flash-image` |
| `OUTPUT_LANGUAGE` | Sprache der KI-generierten Inhalte (Insights, Ideen, Skripte, Thumbnail-Text) | `German (Deutsch)` |
| `DATABASE_URL` | PostgreSQL-Verbindung für Login, Benutzer und Protokoll | Erforderlich |
| `DATABASE_SSL` | `true` erzwingt TLS zur Datenbank | `false` |
| `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` | Erster Admin, nur bei leerer Benutzertabelle | leer |
| `SESSION_TTL_HOURS` | Gültigkeit einer Anmeldung in Stunden | `720` |
| `PORT` | Lokaler HTTP-Port | `5000` |
| `HOST` | Bind-Adresse | `127.0.0.1` (im Docker-Image `0.0.0.0`) |
| `TRUST_PROXY` | Anzahl vertrauenswürdiger Proxy-Hops für `X-Forwarded-For` | leer (im Docker-Image `1`) |
| `ENV_FILE` | Pfad der `.env`-Datei, in die die Einstellungen-Seite schreibt | `.env` (im Docker-Image `/app/data/.env`) |

Die Einstellungsseite zeigt die Server-Allowlist und deren aktuelle Beschreibungen an. Modelle sind nicht im Client fest kodiert. Eine Änderung der Allowlist in `server/gemini-models.ts` ändert die verfügbaren Optionen in den Einstellungen.

## Deployment mit Coolify

Das Repository enthält ein produktionsfertiges [`Dockerfile`](Dockerfile) (mehrstufiger Build, Node 22 Alpine, läuft als unprivilegierter Benutzer `node`), eine [`docker-compose.yml`](docker-compose.yml) mit PostgreSQL und einen Health-Check unter `/api/health`. Der Health-Check antwortet auch ohne Datenbank mit `200` und meldet den Datenbankstatus im Body, damit Coolify den Container beim Datenbankstart nicht neu startet.

### Schritt für Schritt

1. **Repository pushen**: Dieses Repository in ein Git-Remote (GitHub, GitLab, Gitea) pushen, auf das Coolify zugreifen kann.
2. **PostgreSQL anlegen**: In Coolify *New Resource → Database → PostgreSQL* im selben Projekt anlegen und starten. Die *Internal URL* (Form `postgres://postgres:PASSWORT@HOSTNAME:5432/postgres`) kopieren.
3. **Anwendung anlegen**: *New Resource → Application* wählen, das Repository und den Branch (`main`) angeben.
4. **Build-Pack**: *Dockerfile* wählen (Coolify erkennt die Datei im Root automatisch). Alternativ *Docker Compose* mit `docker-compose.yml`, dann bringt die Compose-Datei ihre eigene PostgreSQL-Instanz mit.
5. **Port**: Unter *Ports Exposes* den Wert `5000` eintragen.
6. **Umgebungsvariablen** setzen (siehe Tabelle unten). Mindestens `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`, `YOUTUBE_API_KEY` und `GEMINI_API_KEY`.
7. **Persistenz (optional)**: Unter *Storages* ein Volume auf `/app/data` mounten, wenn Admins Schlüssel über die Einstellungen-Seite speichern sollen. Wer die Schlüssel in Coolify pflegt, braucht das nicht.
8. **Health-Check (optional)**: In Coolify den Health-Check auf Pfad `/api/health`, Port `5000` setzen. Das Docker-Image bringt zusätzlich einen eigenen `HEALTHCHECK` mit.
9. **Domain** zuweisen und *Deploy* klicken. Coolify stellt über Traefik automatisch HTTPS bereit. Danach mit `ADMIN_USER` und `ADMIN_PASSWORD` anmelden und unter **Admin → Benutzer** weitere Konten anlegen.

### Umgebungsvariablen für Coolify

| Variable | Pflicht | Beschreibung |
| --- | --- | --- |
| `DATABASE_URL` | ja | Interne PostgreSQL-URL aus Coolify |
| `ADMIN_USER` / `ADMIN_PASSWORD` | ja (erster Start) | Erster Admin, Passwort mindestens 8 Zeichen. Wird nur angelegt, solange keine Benutzer existieren. |
| `YOUTUBE_API_KEY` | ja | YouTube Data API v3 |
| `GEMINI_API_KEY` | ja | Gemini Text- und Bildgenerierung |
| `ADMIN_DISPLAY_NAME` | nein | Anzeigename des ersten Admins |
| `GEMINI_TEXT_MODEL` / `GEMINI_IMAGE_MODEL` | nein | Modellauswahl, Standard `gemini-3.7-flash` / `gemini-3.1-flash-image` |
| `OUTPUT_LANGUAGE` | nein | Sprache der KI-Ausgaben, Standard `German (Deutsch)` |
| `SESSION_TTL_HOURS` | nein | Gültigkeit einer Anmeldung, Standard `720` |
| `DATABASE_SSL` | nein | `true` für TLS zu einer externen Datenbank |
| `TRUST_PROXY` | nein | Im Image bereits `1` (ein Proxy-Hop, Traefik). |
| `HOST` / `PORT` | nein | Im Image bereits `0.0.0.0` / `5000`. |
| `ENV_FILE` | nein | Im Image bereits `/app/data/.env`. |

Hinweise:

- In Coolify gesetzte Umgebungsvariablen haben Vorrang vor Werten, die die Einstellungen-Seite in die `.env`-Datei schreibt.
- Ohne erreichbare Datenbank startet der Container, zeigt aber nur die Login-Seite mit Fehlermeldung. Der Server versucht die Verbindung beim Start bis zu 30-mal mit steigender Wartezeit.
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

- Jede Nutzung erfordert ein Login. Konten werden ausschließlich von Admins angelegt, siehe [Login, Rollen und Aktivitätsprotokoll](#login-rollen-und-aktivitätsprotokoll).
- API-Schlüssel bleiben serverseitig, `.env` wird ignoriert und die Einstellungen-Seite ist Admins vorbehalten.
- Der Verlauf der letzten Workflows bleibt im aktuellen Browserprofil. Er wird nicht an einen separaten Verlaufsdienst gesendet und enthält nie API-Schlüssel.
- Anfrage- und Antwort-Bodies werden nicht in Server-Logs geschrieben. Erzeugte Inhalte und Aktionen werden in der Datenbank protokolliert und sind nur für Admins einsehbar.
- Die Anwendung bindet sich an Loopback, sofern `HOST` nicht ausdrücklich geändert wird.
- Für öffentliche Deployments HTTPS verwenden (Coolify macht das über Traefik), damit das Session-Cookie als `Secure` gesetzt wird.
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
- PostgreSQL über `pg` für Benutzer, Sessions, Aktivitätsprotokoll und gespeicherte Inhalte
- Eigenes Cookie-Login mit scrypt-Passwort-Hashing, ohne Passport und ohne externen Identitätsanbieter

## Kontingente und Kosten

Die YouTube-Suche ist im Vergleich zur Video- und Kanal-Anreicherung kontingentintensiv. Gemini-Limits und -Preise variieren je nach Modell und Konto. Prüfe die aktuelle offizielle Dokumentation, bevor du Modelle änderst oder den Server aus der Ferne erreichbar machst:

- [YouTube Data API quota costs](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Gemini pricing](https://ai.google.dev/pricing)
- [Gemini image generation and SynthID](https://ai.google.dev/gemini-api/docs/image-generation)

## Lizenz

YouTube Pro ist Open Source unter der [Apache License 2.0](LICENSE).

## Mitwirken und Sicherheit

Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für das lokale Quality Gate. Melde Sicherheitsprobleme vertraulich gemäß [SECURITY.md](SECURITY.md), niemals in einem öffentlichen Issue.
