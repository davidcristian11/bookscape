import { getAuthToken } from "../utils/authStorage";

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

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Your in-memory server session expired after the backend restart. Please log in again to sync your offline changes."
    );
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

export async function getQuotesByBook(bookId) {
  return request(`/books/${bookId}/quotes`, {
    method: "GET",
  });
}

export async function createQuote(bookId, payload) {
  return request(`/books/${bookId}/quotes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateQuote(quoteId, payload) {
  return request(`/quotes/${quoteId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteQuote(quoteId) {
  return request(`/quotes/${quoteId}`, {
    method: "DELETE",
  });
}

export async function getQuoteStats() {
  return request("/stats/quotes", {
    method: "GET",
  });
}
