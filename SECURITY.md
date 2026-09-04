# Sicherheitsrichtlinie

## Eine Schwachstelle melden

Melde vermutete Schwachstellen nicht in einem öffentlichen Issue. Nutze den privaten Security-Advisory-Prozess des Repositorys oder kontaktiere den Repository-Besitzer über einen bereits freigegebenen privaten Kanal.

Gib die betroffene Route oder Komponente, Schritte zur Reproduktion, die erwartete Auswirkung und einen minimalen Proof of Concept an. Entferne API-Schlüssel, Zugriffstoken, personenbezogene Daten und private Kanaldaten aus allen Meldungen und Screenshots.

## Unterstützte Konfiguration

Die aktuell unterstützte Konfiguration ist Local-first:

- Der Server bindet sich standardmäßig an `127.0.0.1`.
- YouTube- und Gemini-Schlüssel bleiben in der Server-Umgebung.
- Der lokale Einstellungs-Endpunkt akzeptiert ausschließlich Same-Origin-Loopback-Anfragen.
- Kostenpflichtige Routen verwenden einen In-Memory-Ratenlimiter pro Prozess.

Dies ist kein gehärteter Mehrbenutzer-Internetdienst. Ergänze vor einem Remote-Deployment authentifizierten Zugriff, einen vertrauenswürdigen Pfad zur Geheimnisverwaltung, einen gemeinsamen Ratenlimiter, eine Anfrage-Beobachtbarkeit, die Geheimnisse und Inhalts-Bodies ausschließt, sowie eine deploymentspezifische Bedrohungsanalyse.

## Umgang mit kompromittierten Zugangsdaten

Wenn Zugangsdaten versehentlich committet werden, widerrufe oder rotiere sie sofort. Sie aus dem letzten Commit zu entfernen reicht nicht aus, da Git-Historie und Klone den Wert weiterhin enthalten können.
