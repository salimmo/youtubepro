// App-Rahmen (Deutsch): Seitenleiste, Login, Benutzermenü, Workflow-Verlauf, API-Fehler.
const dictionary: Record<string, string> = {
  // App-Layout
  "shell.skipToContent": "Zum Inhalt springen",
  "shell.mainAreaLabel": "Arbeitsbereich der Anwendung",
  "shell.toggleSidebar": "Seitenleiste umschalten",
  "shell.checkingSession": "Sitzung wird geprüft …",

  // Seitenleiste
  "shell.homeLink": "YouTube Pro Startseite",
  "shell.tools": "Tools",
  "shell.nav.research": "Recherche",
  "shell.nav.script": "Skript-Writer",
  "shell.nav.thumbnail": "Thumbnail-Creator",
  "shell.nav.channel": "Kanal",
  "shell.nav.admin": "Admin",
  "shell.nav.settings": "Einstellungen",
  "shell.step.research": "Recherche",
  "shell.step.script": "Skript",
  "shell.step.thumbnail": "Thumbnail",
  "shell.stepStatus.inactive": "inaktiv",
  "shell.stepStatus.completed": "abgeschlossen",
  "shell.stepStatus.current": "aktuell",
  "shell.stepStatus.upcoming": "ausstehend",
  "shell.newWorkflow": "Neuer Workflow",
  "shell.workflowProgress": "Workflow-Fortschritt",
  "shell.recentWorkflows": "Letzte Workflows",
  "shell.historyLoading": "Lokaler Verlauf wird geladen …",
  "shell.historyEmpty": "Deine letzten Recherchen, Skripte und Thumbnails erscheinen hier.",
  "shell.workflowActions": "Aktionen für {title}",
  "shell.untitledWorkflow": "Unbenannter Workflow",
  "shell.renameTitle": "Workflow umbenennen",
  "shell.renameDescription": "Gib diesem Projekt einen kurzen Namen, den du später leicht wiedererkennst.",
  "shell.workflowNameLabel": "Workflow-Name",
  "shell.maxChars": "Maximal 48 Zeichen",
  "shell.saveName": "Namen speichern",
  "shell.renameEmpty": "Gib einen Workflow-Namen ein.",
  "shell.renameFailed": "Der Workflow konnte nicht umbenannt werden.",
  "shell.deleteTitle": "„{title}“ löschen?",
  "shell.deleteDescription": "Dadurch werden die lokal gespeicherte Recherche, die Ideen, das Skript und das Thumbnail dieses Workflows entfernt. Diese Aktion kann nicht rückgängig gemacht werden.",
  "shell.deleteWorkflow": "Workflow löschen",

  // Login
  "shell.login.ariaLabel": "Anmeldung",
  "shell.login.subtitle": "Melde dich an, um mit deiner Recherche fortzufahren.",
  "shell.login.username": "Benutzername",
  "shell.login.password": "Passwort",
  "shell.login.submit": "Anmelden",
  "shell.login.submitting": "Anmeldung läuft …",
  "shell.login.missingCredentials": "Bitte gib Benutzername und Passwort ein.",
  "shell.login.failed": "Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.",

  // Auth-Kontext
  "shell.auth.sessionCheckFailed": "Die Sitzung konnte nicht geprüft werden.",
  "shell.auth.serverUnreachable": "Der Server ist nicht erreichbar. Bitte versuche es später erneut.",
  "shell.auth.invalidCredentials": "Benutzername oder Passwort ist falsch.",
  "shell.auth.tooManyAttempts": "Zu viele Versuche. Bitte warte kurz.",

  // Benutzermenü
  "shell.user.roleAdmin": "Admin",
  "shell.user.roleUser": "Benutzer",
  "shell.user.menuLabel": "Benutzermenü für {name}",
  "shell.user.changePassword": "Passwort ändern",
  "shell.user.logout": "Abmelden",
  "shell.user.passwordChangedTitle": "Passwort geändert",
  "shell.user.passwordChangedDescription": "Dein neues Passwort ist ab sofort gültig.",
  "shell.user.wrongCurrentPassword": "Das aktuelle Passwort ist falsch.",
  "shell.user.checkInputs": "Bitte prüfe deine Eingaben.",
  "shell.user.passwordMismatch": "Die Passwörter stimmen nicht überein.",
  "shell.user.passwordSameAsCurrent": "Das neue Passwort muss sich vom aktuellen unterscheiden.",
  "shell.user.passwordChangeFailed": "Das Passwort konnte nicht geändert werden.",
  "shell.user.changePasswordDescription": "Gib dein aktuelles Passwort ein und wähle ein neues mit mindestens 8 Zeichen.",
  "shell.user.currentPassword": "Aktuelles Passwort",
  "shell.user.newPassword": "Neues Passwort",
  "shell.user.confirmPassword": "Neues Passwort wiederholen",
  "shell.user.savePassword": "Passwort speichern",

  // Workflow-Verlauf (workflow-context)
  "shell.history.saveFailed": "Der Workflow konnte nicht auf dem Server gespeichert werden.",
  "shell.history.loadFailed": "Deine Workflows konnten nicht vom Server geladen werden. Der aktuelle Workflow bleibt für diese Sitzung geöffnet.",
  "shell.history.notAvailable": "Dieser Workflow ist nicht mehr verfügbar.",
  "shell.history.openFailed": "Der ausgewählte Workflow konnte nicht geöffnet werden.",
  "shell.history.nameEmpty": "Workflow-Namen dürfen nicht leer sein.",
  "shell.history.renameFailed": "Der Workflow konnte nicht umbenannt werden.",
  "shell.history.deleteFailed": "Der Workflow konnte nicht gelöscht werden.",

  // Workflow-Speicher (workflow-storage)
  "shell.storage.loginRequired": "Anmeldung erforderlich.",
  "shell.storage.statusError": "Workflow-Speicher antwortete mit Status {status}.",
  "shell.storage.notFound": "Workflow nicht gefunden.",

  // API-Client (queryClient)
  "shell.api.htmlError": "Der Server war nicht erreichbar (Status {status}).",
  "shell.api.htmlSuggestion": "Statt einer API-Antwort kam eine HTML-Fehlerseite, vermutlich von einem Proxy, einer Firewall oder einem Bot-Schutz zwischen Browser und Server. Versuche es erneut und prüfe, ob ein VPN, Firmennetz oder Filter aktiv ist.",
  "shell.api.htmlDetailTitle": "Seitentitel: {title}",
  "shell.api.htmlDetailNoTitle": "HTML-Seite ohne Titel",
  "shell.api.unauthorized": "Nicht autorisierte Anfrage.",
};

export default dictionary;
