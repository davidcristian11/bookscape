import { getAuthToken, markAuthSessionExpired } from "../utils/authStorage";
import { API_BASE_URL } from "./config";

function extractErrorMessage(data) {
  if (!data) return "Request failed";
  if (typeof data.detail === "string") return data.detail;
  return data.message || "Request failed";
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
    const message = "Your server session expired. Please sign in again.";
    markAuthSessionExpired(message);
    throw new Error(message);
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

export function getObservationList() {
  return request("/admin/observation-list");
}

export function getAdminLogs(limit = 50) {
  return request(`/admin/logs?limit=${limit}`);
}
