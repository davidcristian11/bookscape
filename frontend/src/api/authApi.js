import { API_BASE_URL } from "./config";
import { markAuthSessionExpired } from "../utils/authStorage";

function extractErrorMessage(data) {
  if (!data) return "Request failed";

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc.join(".") : "field";
        return `${field}: ${item.msg}`;
      })
      .join(" | ");
  }

  return data.message || "Request failed";
}

async function request(path, options = {}) {
  const { clearOnUnauthorized = false, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    },
    ...fetchOptions,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && clearOnUnauthorized) {
      markAuthSessionExpired("Your server session expired. Please sign in again.");
    }
    throw new Error(extractErrorMessage(data));
  }

  return data;
}

export async function registerUser(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function refreshSession(refreshToken) {
  return request("/auth/refresh", {
    method: "POST",
    clearOnUnauthorized: true,
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function getCurrentUser(token) {
  return request("/auth/me", {
    method: "GET",
    clearOnUnauthorized: true,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function logoutUser(token) {
  return request("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function requestPasswordReset(email) {
  return request("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(payload) {
  return request("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
