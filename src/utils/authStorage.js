const TOKEN_KEY = "bookscape_auth_token";
const USER_KEY = "bookscape_auth_user";
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

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuthChanged();
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}
