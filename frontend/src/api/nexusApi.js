import { clearAuthSession, getAuthToken } from "../utils/authStorage";
import { API_BASE_URL } from "./config";

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

  if (response.status === 204) {
    return null;
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

export async function getNexusGraph() {
  return request("/nexus", {
    method: "GET",
  });
}

export async function createNexusNode(payload) {
  return request("/nexus/nodes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateNexusNode(id, payload) {
  return request(`/nexus/nodes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteNexusNode(id) {
  return request(`/nexus/nodes/${id}`, {
    method: "DELETE",
  });
}

export async function createNexusEdge(payload) {
  return request("/nexus/edges", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteNexusEdge(id) {
  return request(`/nexus/edges/${id}`, {
    method: "DELETE",
  });
}
