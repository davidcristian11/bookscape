function setCookie(name, value, days = 30) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

export function recordVisit(pathname) {
  const visits = Number(getCookie("bookscape_visits") || "0") + 1;
  setCookie("bookscape_visits", String(visits));
  setCookie("bookscape_last_section", pathname);
  setCookie("bookscape_last_active", new Date().toISOString());
}

export function setPreferenceCookie(name, value) {
  setCookie(`bookscape_pref_${name}`, value);
}

export function getPreferenceCookie(name, fallback) {
  return getCookie(`bookscape_pref_${name}`) || fallback;
}
