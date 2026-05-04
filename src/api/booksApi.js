import { clearAuthSession, getAuthToken } from "../utils/authStorage";
import {
  computeLocalBookStats,
  getLocalBookById,
  getLocalPaginatedBooks,
  mergeLocalBooks,
  removeLocalBook,
  upsertLocalBook,
} from "../utils/localBooksStore";
import {
  clearOfflineQueue,
  enqueueCreateOperation,
  enqueueDeleteOperation,
  enqueueUpdateOperation,
  getOfflineQueue,
  getOfflineQueueCount,
  setOfflineQueue,
} from "../hooks/offlineQueue.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

class ApiUnavailableError extends Error {
  constructor(message = "Network or server unavailable.") {
    super(message);
    this.name = "ApiUnavailableError";
    this.isUnavailable = true;
  }
}

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

function generateTemporaryId() {
  if (globalThis.crypto?.randomUUID) {
    return `offline-${globalThis.crypto.randomUUID()}`;
  }

  return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildTemporaryBook(payload) {
  return {
    id: generateTemporaryId(),
    title: payload.title,
    author: payload.author,
    genre: payload.genre,
    year: payload.year,
    status: payload.status,
    rating: payload.rating,
    cover_url: payload.cover_url ?? null,
    _offline: true,
  };
}

export function isApiUnavailableError(error) {
  return Boolean(error?.isUnavailable);
}

async function requestWithAuth(path, options = {}) {
  const token = getAuthToken();

  const {
    timeoutMs = 5000,
    headers: optionHeaders = {},
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...optionHeaders,
      },
      signal: controller.signal,
      ...fetchOptions,
    });

    if (response.status === 401) {
      clearAuthSession();
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }

    if ([502, 503, 504].includes(response.status)) {
      throw new ApiUnavailableError("Server unavailable.");
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
  } catch (error) {
    if (
      error?.name === "AbortError" ||
      error instanceof TypeError ||
      error?.isUnavailable
    ) {
      throw new ApiUnavailableError("Network or server unavailable.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function checkBooksServerAvailability() {
  if (!navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(`${API_BASE_URL}/`, {
      method: "GET",
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export { getOfflineQueueCount };

export async function getBooks(page = 1, pageSize = 10) {
  try {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });

    const data = await requestWithAuth(`/books?${params.toString()}`, {
      method: "GET",
    });

    mergeLocalBooks(data.items);
    return data;
  } catch (error) {
    if (!isApiUnavailableError(error)) {
      throw error;
    }

    return getLocalPaginatedBooks(page, pageSize);
  }
}

export async function getBookById(id) {
  try {
    const data = await requestWithAuth(`/books/${id}`, {
      method: "GET",
    });

    upsertLocalBook(data);
    return data;
  } catch (error) {
    if (!isApiUnavailableError(error)) {
      throw error;
    }

    const localBook = getLocalBookById(id);

    if (!localBook) {
      throw new Error("This book is not available offline yet.");
    }

    return localBook;
  }
}

export async function createBook(payload) {
  try {
    const createdBook = await requestWithAuth("/books", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    upsertLocalBook(createdBook);
    return createdBook;
  } catch (error) {
    if (!isApiUnavailableError(error)) {
      throw error;
    }

    const temporaryBook = buildTemporaryBook(payload);

    upsertLocalBook(temporaryBook);
    enqueueCreateOperation(temporaryBook.id, payload);

    return temporaryBook;
  }
}

export async function updateBook(id, payload) {
  try {
    const updatedBook = await requestWithAuth(`/books/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    upsertLocalBook(updatedBook);
    return updatedBook;
  } catch (error) {
    if (!isApiUnavailableError(error)) {
      throw error;
    }

    const existingLocalBook = getLocalBookById(id);

    if (!existingLocalBook) {
      throw new Error("This book is not available offline yet.");
    }

    const updatedLocalBook = {
      ...existingLocalBook,
      ...payload,
      cover_url:
        payload.cover_url !== undefined
          ? payload.cover_url
          : existingLocalBook.cover_url,
      _offline: true,
    };

    upsertLocalBook(updatedLocalBook);
    enqueueUpdateOperation(id, payload);

    return updatedLocalBook;
  }
}

export async function deleteBook(id) {
  try {
    await requestWithAuth(`/books/${id}`, {
      method: "DELETE",
    });

    removeLocalBook(id);
    return null;
  } catch (error) {
    if (!isApiUnavailableError(error)) {
      throw error;
    }

    removeLocalBook(id);
    enqueueDeleteOperation(id);

    return null;
  }
}

export async function getStats() {
  try {
    return await requestWithAuth("/stats", {
      method: "GET",
    });
  } catch (error) {
    if (!isApiUnavailableError(error)) {
      throw error;
    }

    return computeLocalBookStats();
  }
}

export async function syncQueuedBookOperations() {
  const queue = [...getOfflineQueue()];

  if (queue.length === 0) {
    return { synced: true, count: 0 };
  }

  const serverAvailable = await checkBooksServerAvailability();

  if (!serverAvailable) {
    return { synced: false, count: queue.length };
  }

  const idMap = new Map();

  for (let index = 0; index < queue.length; index += 1) {
    const operation = queue[index];

    try {
      if (operation.type === "create") {
        const createdBook = await requestWithAuth("/books", {
          method: "POST",
          body: JSON.stringify(operation.payload),
        });

        removeLocalBook(operation.tempId);
        upsertLocalBook(createdBook);
        idMap.set(operation.tempId, createdBook.id);
        continue;
      }

      if (operation.type === "update") {
        const resolvedId = idMap.get(operation.bookId) ?? operation.bookId;

        const updatedBook = await requestWithAuth(`/books/${resolvedId}`, {
          method: "PUT",
          body: JSON.stringify(operation.payload),
        });

        if (resolvedId !== operation.bookId) {
          removeLocalBook(operation.bookId);
        }

        upsertLocalBook(updatedBook);
        continue;
      }

      if (operation.type === "delete") {
        const resolvedId = idMap.get(operation.bookId) ?? operation.bookId;

        try {
          await requestWithAuth(`/books/${resolvedId}`, {
            method: "DELETE",
          });
        } catch (error) {
          if (!String(error.message).includes("Book not found")) {
            throw error;
          }
        }

        removeLocalBook(resolvedId);

        if (resolvedId !== operation.bookId) {
          removeLocalBook(operation.bookId);
        }
      }
    } catch (error) {
      if (isApiUnavailableError(error)) {
        setOfflineQueue(queue.slice(index));
        return {
          synced: false,
          count: queue.length - index,
        };
      }

      if (operation.type === "create") {
        removeLocalBook(operation.tempId);
      }

      if (operation.type === "delete") {
        removeLocalBook(operation.bookId);
      }
    }
  }

  clearOfflineQueue();
  return { synced: true, count: 0 };
}