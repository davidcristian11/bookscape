import { clearAuthSession, getAuthToken } from "../utils/authStorage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

function extractErrorMessage(data) {
  if (!data) {
    return "Request failed";
  }

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

  if (typeof data.message === "string") {
    return data.message;
  }

  return "Request failed";
}

async function request(path, options = {}) {
  const token = getAuthToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 401) {
    clearAuthSession();
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }

  return data;
}

export async function startFakerLoop(intervalSeconds = 3) {
  return request("/automation/faker/start", {
    method: "POST",
    body: JSON.stringify({
      interval_seconds: intervalSeconds,
    }),
  });
}

export async function stopFakerLoop() {
  return request("/automation/faker/stop", {
    method: "POST",
  });
}

export async function getFakerLoopStatus() {
  return request("/automation/faker/status", {
    method: "GET",
  });
}
