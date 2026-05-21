const TOKEN_KEY = "bookscape_auth_token";
const USER_KEY = "bookscape_auth_user";
const LAST_USER_KEY = "bookscape_last_known_user";
const SESSION_RECOVERY_KEY = "bookscape_session_recovery_message";
const AUTH_EVENT = "bookscape:auth-session-changed";

function emitAuthChanged() {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export function getAuthChangedEventName() {
  return AUTH_EVENT;
}

export function saveAuthSession(authData) {
  localStorage.setItem(TOKEN_KEY, authData.token);
  localStorage.setItem(USER_KEY, JSON.stringify(authData.user));
  localStorage.setItem(LAST_USER_KEY, JSON.stringify(authData.user));
  localStorage.removeItem(SESSION_RECOVERY_KEY);
  emitAuthChanged();
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getLastKnownUser() {
  const raw = localStorage.getItem(USER_KEY) || localStorage.getItem(LAST_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function markAuthSessionExpired(message) {
  const existingToken = localStorage.getItem(TOKEN_KEY);
  const existingMessage = localStorage.getItem(SESSION_RECOVERY_KEY);
  const user = getStoredUser() || getLastKnownUser();

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(SESSION_RECOVERY_KEY, message);

  if (existingToken || existingMessage !== message) {
    emitAuthChanged();
  }
}

export function getAuthRecoveryMessage() {
  return localStorage.getItem(SESSION_RECOVERY_KEY);
}

export function hasOfflineSession() {
  return Boolean(getStoredUser() || getLastKnownUser());
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LAST_USER_KEY);
  localStorage.removeItem(SESSION_RECOVERY_KEY);
  emitAuthChanged();
}

export function isAuthenticated() {
  return Boolean(getAuthToken() || getStoredUser());
}
