// App shell (English): sidebar, login, user menu, workflow history, API errors.
const dictionary: Record<string, string> = {
  // App layout
  "shell.skipToContent": "Skip to content",
  "shell.mainAreaLabel": "Application workspace",
  "shell.toggleSidebar": "Toggle sidebar",
  "shell.checkingSession": "Checking session…",

  // Sidebar
  "shell.homeLink": "YouTube Pro home",
  "shell.tools": "Tools",
  "shell.nav.research": "Research",
  "shell.nav.script": "Script Writer",
  "shell.nav.thumbnail": "Thumbnail Creator",
  "shell.nav.channel": "Channel",
  "shell.nav.admin": "Admin",
  "shell.nav.settings": "Settings",
  "shell.step.research": "Research",
  "shell.step.script": "Script",
  "shell.step.thumbnail": "Thumbnail",
  "shell.stepStatus.inactive": "inactive",
  "shell.stepStatus.completed": "completed",
  "shell.stepStatus.current": "current",
  "shell.stepStatus.upcoming": "upcoming",
  "shell.newWorkflow": "New Workflow",
  "shell.workflowProgress": "Workflow progress",
  "shell.recentWorkflows": "Recent Workflows",
  "shell.historyLoading": "Loading history…",
  "shell.historyEmpty": "Your recent research, scripts and thumbnails will appear here.",
  "shell.workflowActions": "Actions for {title}",
  "shell.untitledWorkflow": "Untitled workflow",
  "shell.renameTitle": "Rename Workflow",
  "shell.renameDescription": "Give this project a short name you will easily recognize later.",
  "shell.workflowNameLabel": "Workflow name",
  "shell.maxChars": "Up to 48 characters",
  "shell.saveName": "Save Name",
  "shell.renameEmpty": "Enter a workflow name.",
  "shell.renameFailed": "The workflow could not be renamed.",
  "shell.deleteTitle": "Delete “{title}”?",
  "shell.deleteDescription": "This removes the locally stored research, ideas, script and thumbnail of this workflow. This action cannot be undone.",
  "shell.deleteWorkflow": "Delete Workflow",

  // Login
  "shell.login.ariaLabel": "Sign in",
  "shell.login.subtitle": "Sign in to continue with your research.",
  "shell.login.username": "Username",
  "shell.login.password": "Password",
  "shell.login.submit": "Sign In",
  "shell.login.submitting": "Signing in…",
  "shell.login.missingCredentials": "Please enter your username and password.",
  "shell.login.failed": "Sign-in failed. Please try again.",

  // Auth context
  "shell.auth.sessionCheckFailed": "The session could not be verified.",
  "shell.auth.serverUnreachable": "The server is unreachable. Please try again later.",
  "shell.auth.invalidCredentials": "Username or password is incorrect.",
  "shell.auth.tooManyAttempts": "Too many attempts. Please wait a moment.",

  // User menu
  "shell.user.roleAdmin": "Admin",
  "shell.user.roleUser": "User",
  "shell.user.menuLabel": "User menu for {name}",
  "shell.user.changePassword": "Change Password",
  "shell.user.logout": "Sign Out",
  "shell.user.passwordChangedTitle": "Password changed",
  "shell.user.passwordChangedDescription": "Your new password is effective immediately.",
  "shell.user.wrongCurrentPassword": "The current password is incorrect.",
  "shell.user.checkInputs": "Please check your input.",
  "shell.user.passwordMismatch": "The passwords do not match.",
  "shell.user.passwordSameAsCurrent": "The new password must differ from the current one.",
  "shell.user.passwordChangeFailed": "The password could not be changed.",
  "shell.user.changePasswordDescription": "Enter your current password and choose a new one with at least 8 characters.",
  "shell.user.currentPassword": "Current password",
  "shell.user.newPassword": "New password",
  "shell.user.confirmPassword": "Repeat new password",
  "shell.user.savePassword": "Save Password",

  // Workflow history (workflow-context)
  "shell.history.saveFailed": "The workflow could not be saved on the server.",
  "shell.history.loadFailed": "Your workflows could not be loaded from the server. The current workflow stays open for this session.",
  "shell.history.notAvailable": "This workflow is no longer available.",
  "shell.history.openFailed": "The selected workflow could not be opened.",
  "shell.history.nameEmpty": "Workflow names cannot be empty.",
  "shell.history.renameFailed": "The workflow could not be renamed.",
  "shell.history.deleteFailed": "The workflow could not be deleted.",

  // Workflow storage (workflow-storage)
  "shell.storage.loginRequired": "Sign-in required.",
  "shell.storage.statusError": "Workflow storage responded with status {status}.",
  "shell.storage.notFound": "Workflow not found.",

  // API client (queryClient)
  "shell.api.htmlError": "The server was unreachable (status {status}).",
  "shell.api.htmlSuggestion": "Instead of an API response, an HTML error page was returned, probably from a proxy, firewall or bot protection between the browser and the server. Try again and check whether a VPN, corporate network or filter is active.",
  "shell.api.htmlDetailTitle": "Page title: {title}",
  "shell.api.htmlDetailNoTitle": "HTML page without a title",
  "shell.api.unauthorized": "Unauthorized request.",
};

export default dictionary;
