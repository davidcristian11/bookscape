import { beforeEach, describe, expect, it, vi } from "vitest";

function setOnline(value) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

function saveTestSession() {
  localStorage.setItem("bookscape_auth_token", "token-1");
  localStorage.setItem(
    "bookscape_auth_user",
    JSON.stringify({ id: "user-1", name: "Reader", email: "reader@example.com" })
  );
}

const payload = {
  title: "Offline Book",
  author: "Ada Reader",
  genre: "Fiction",
  publication_year: 2026,
  source: "Manual",
  source_url: null,
  synopsis: "Queued offline.",
  review: "",
  rating: 4,
  cover_url: null,
};

describe("booksApi offline queue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
    saveTestSession();
    setOnline(true);
  });

  it("offline create queues one optimistic book and one queue item", async () => {
    setOnline(false);
    global.fetch = vi.fn(() => Promise.reject(new TypeError("offline")));

    const { createBook, getOfflineQueueCount } = await import("../booksApi.js");
    const { getLocalBooksCache } = await import("../../utils/localBooksStore.js");

    const created = await createBook(payload);

    expect(created._offline).toBe(true);
    expect(getOfflineQueueCount()).toBe(1);
    expect(getLocalBooksCache()).toHaveLength(1);
    expect(getLocalBooksCache()[0].id).toBe(created.id);
  });

  it("concurrent reconnect syncs do not create duplicate server books", async () => {
    setOnline(false);
    global.fetch = vi.fn(() => Promise.reject(new TypeError("offline")));

    const { createBook } = await import("../booksApi.js");
    const { getLocalBooksCache } = await import("../../utils/localBooksStore.js");
    await createBook(payload);

    setOnline(true);
    let postCount = 0;
    global.fetch = vi.fn(async (url, options = {}) => {
      if (String(url).endsWith("/") && options.method === "GET") {
        return { ok: true };
      }

      if (String(url).endsWith("/books") && options.method === "POST") {
        postCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...payload,
            id: `server-${postCount}`,
            created_at: "2026-05-05T00:00:00Z",
            updated_at: "2026-05-05T00:00:00Z",
          }),
        };
      }

      throw new Error(`Unexpected request ${url}`);
    });

    const { syncQueuedBookOperations, getOfflineQueueCount } = await import("../booksApi.js");

    await Promise.all([
      syncQueuedBookOperations(),
      syncQueuedBookOperations(),
      syncQueuedBookOperations(),
    ]);

    expect(postCount).toBe(1);
    expect(getOfflineQueueCount()).toBe(0);
    const books = getLocalBooksCache();
    expect(books).toHaveLength(1);
    expect(books[0].id).toBe("server-1");
    expect(books[0]._offline).not.toBe(true);
  });

  it("server unreachable keeps auth state and queues offline create", async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError("server down")));

    const { createBook, getOfflineQueueCount } = await import("../booksApi.js");
    const { getLocalBooksCache } = await import("../../utils/localBooksStore.js");

    await createBook(payload);

    expect(localStorage.getItem("bookscape_auth_token")).toBe("token-1");
    expect(getOfflineQueueCount()).toBe(1);
    expect(getLocalBooksCache()).toHaveLength(1);
  });

  it("401 during sync pauses sync and preserves queue plus optimistic book", async () => {
    setOnline(false);
    global.fetch = vi.fn(() => Promise.reject(new TypeError("offline")));

    const { createBook } = await import("../booksApi.js");
    const { getLocalBooksCache } = await import("../../utils/localBooksStore.js");
    const { getOfflineQueue } = await import("../../hooks/offlineQueue.js");
    await createBook(payload);

    setOnline(true);
    global.fetch = vi.fn(async (url, options = {}) => {
      if (String(url).endsWith("/") && options.method === "GET") {
        return { ok: true };
      }

      if (String(url).endsWith("/books") && options.method === "POST") {
        return {
          ok: false,
          status: 401,
          json: async () => ({ detail: "Invalid or expired session" }),
        };
      }

      throw new Error(`Unexpected request ${url}`);
    });

    const { syncQueuedBookOperations, getOfflineQueueCount } = await import("../booksApi.js");
    const result = await syncQueuedBookOperations();

    expect(result.authExpired).toBe(true);
    expect(getOfflineQueueCount()).toBe(1);
    expect(getOfflineQueue()[0].status).toBe("paused-auth");
    expect(getLocalBooksCache()).toHaveLength(1);
    expect(getLocalBooksCache()[0]._syncStatus).toBe("auth-required");
    expect(localStorage.getItem("bookscape_auth_token")).toBe("token-1");
  });

  it("after re-login with the same email, queued operations sync with the new token", async () => {
    setOnline(false);
    global.fetch = vi.fn(() => Promise.reject(new TypeError("offline")));

    const { createBook } = await import("../booksApi.js");
    const { getLocalBooksCache } = await import("../../utils/localBooksStore.js");
    await createBook(payload);

    localStorage.setItem("bookscape_auth_token", "token-2");
    localStorage.setItem(
      "bookscape_auth_user",
      JSON.stringify({ id: "user-after-restart", name: "Reader", email: "reader@example.com" })
    );

    setOnline(true);
    global.fetch = vi.fn(async (url, options = {}) => {
      if (String(url).endsWith("/") && options.method === "GET") {
        return { ok: true };
      }

      if (String(url).endsWith("/books") && options.method === "POST") {
        expect(options.headers.Authorization).toBe("Bearer token-2");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ...payload,
            id: "server-after-login",
            created_at: "2026-05-05T00:00:00Z",
            updated_at: "2026-05-05T00:00:00Z",
          }),
        };
      }

      throw new Error(`Unexpected request ${url}`);
    });

    const { syncQueuedBookOperations, getOfflineQueueCount } = await import("../booksApi.js");
    const result = await syncQueuedBookOperations();

    expect(result.synced).toBe(true);
    expect(getOfflineQueueCount()).toBe(0);
    expect(getLocalBooksCache()).toHaveLength(1);
    expect(getLocalBooksCache()[0].id).toBe("server-after-login");
  });
});
