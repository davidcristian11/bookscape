import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibraryPage from "../LibraryPage";

const refreshFromStart = vi.fn();
const deleteBook = vi.fn();
const createBook = vi.fn();
const getFakerLoopStatus = vi.fn();
const startFakerLoop = vi.fn();
const stopFakerLoop = vi.fn();
const loadNextPage = vi.fn();

const defaultBook = {
  id: "book-1",
  title: "Dune",
  author: "Frank Herbert",
  genre: "Sci-Fi",
  rating: 5,
  source: "Goodreads",
  cover_url: null,
};

const hookState = vi.hoisted(() => ({
  infinite: {
    books: [
      {
        id: "book-1",
        title: "Dune",
        author: "Frank Herbert",
        genre: "Sci-Fi",
        rating: 5,
        source: "Goodreads",
        cover_url: null,
      },
    ],
    totalBooks: 1,
    loadingInitial: false,
    loadingMore: false,
    error: "",
    hasMore: false,
  },
  offlineSync: {
    isOfflineMode: false,
    offlineQueueCount: 0,
    isSyncingQueue: false,
    connectionMessage: "Online",
    queueText: "",
  },
  realtime: {
    isRealtimeConnected: true,
    realtimeMessage: "Realtime updates connected",
  },
}));

vi.mock("../../api/booksApi", () => ({
  createBook: (...args) => createBook(...args),
  deleteBook: (...args) => deleteBook(...args),
  scrapeBook: vi.fn(),
}));

vi.mock("../../api/automationApi", () => ({
  getFakerLoopStatus: (...args) => getFakerLoopStatus(...args),
  startFakerLoop: (...args) => startFakerLoop(...args),
  stopFakerLoop: (...args) => stopFakerLoop(...args),
}));

vi.mock("../../hooks/useInfiniteBooks", () => ({
  default: () => ({
    ...hookState.infinite,
    loadNextPage,
    refreshFromStart,
  }),
}));

vi.mock("../../hooks/useBooksOfflineSync", () => ({
  default: () => hookState.offlineSync,
}));

vi.mock("../../hooks/useBooksRealtime", () => ({
  default: () => hookState.realtime,
}));

function renderLibrary() {
  return render(
    <MemoryRouter>
      <LibraryPage />
    </MemoryRouter>
  );
}

describe("LibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "bookscape_view_mode=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.cookie = "libraryViewPreference=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    hookState.infinite = {
      books: [defaultBook],
      totalBooks: 1,
      loadingInitial: false,
      loadingMore: false,
      error: "",
      hasMore: false,
    };
    hookState.offlineSync = {
      isOfflineMode: false,
      offlineQueueCount: 0,
      isSyncingQueue: false,
      connectionMessage: "Online",
      queueText: "",
    };
    hookState.realtime = {
      isRealtimeConnected: true,
      realtimeMessage: "Realtime updates connected",
    };
    getFakerLoopStatus.mockResolvedValue({ running: false });
    startFakerLoop.mockResolvedValue({ running: true });
    stopFakerLoop.mockResolvedValue({ running: false });
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
  });

  it("renders the library and only loop faker controls", () => {
    renderLibrary();

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start faker loop/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /stop faker loop/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate faker/i })).not.toBeInTheDocument();
  });

  it("keeps actions inside the same table row with an inner flex group", () => {
    renderLibrary();

    const row = screen.getByRole("row", { name: /dune/i });
    const cells = within(row).getAllByRole("cell");
    expect(cells).toHaveLength(6);
    expect(cells[5]).toHaveClass("actions-cell");
    expect(cells[5].querySelector(".actions-group")).toContainElement(
      screen.getByRole("link", { name: /view/i })
    );
  });

  it("switches to grid view and persists the preference", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await user.click(screen.getByRole("button", { name: /grid/i }));

    expect(screen.getByText(/Sci-Fi - Goodreads/i)).toBeInTheDocument();
    expect(document.cookie).toContain("bookscape_view_mode=grid");
  });

  it("marks offline books without breaking row content", () => {
    hookState.infinite.books = [{ ...defaultBook, _offline: true }];

    renderLibrary();

    expect(screen.getByText(/pending sync/i)).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /pending sync/i })).toHaveClass("is-pending");
  });

  it("confirms before deleting a book", async () => {
    const user = userEvent.setup();
    deleteBook.mockResolvedValue(null);
    renderLibrary();

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteBook).toHaveBeenCalledWith("book-1");
    expect(refreshFromStart).toHaveBeenCalled();
  });

  it("does not delete when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);
    renderLibrary();

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(deleteBook).not.toHaveBeenCalled();
  });

  it("alerts if delete fails", async () => {
    const user = userEvent.setup();
    deleteBook.mockRejectedValue(new Error("Delete failed"));
    renderLibrary();

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(window.alert).toHaveBeenCalledWith("Delete failed");
  });

  it("starts and stops the Faker loop", async () => {
    const user = userEvent.setup();
    renderLibrary();

    await user.click(screen.getByRole("button", { name: /start faker loop/i }));
    expect(startFakerLoop).toHaveBeenCalledWith(2);

    await user.click(await screen.findByRole("button", { name: /stop faker loop/i }));
    expect(stopFakerLoop).toHaveBeenCalled();
  });

  it("alerts when the Faker toggle fails", async () => {
    const user = userEvent.setup();
    startFakerLoop.mockRejectedValue(new Error("Loop failed"));
    renderLibrary();

    await user.click(screen.getByRole("button", { name: /start faker loop/i }));

    expect(window.alert).toHaveBeenCalledWith("Loop failed");
  });

  it("shows an empty state and can open the manual add modal", async () => {
    const user = userEvent.setup();
    hookState.infinite.books = [];
    hookState.infinite.totalBooks = 0;

    renderLibrary();

    expect(screen.getByText(/your library is empty/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add manually/i }));
    expect(screen.getByRole("heading", { name: /scrape book data/i })).toBeInTheDocument();
  });

  it("submits manual books through the modal", async () => {
    const user = userEvent.setup();
    createBook.mockResolvedValue({ id: "book-2" });
    renderLibrary();

    await user.click(screen.getByRole("button", { name: /\+ add new book/i }));
    await user.click(screen.getByRole("button", { name: /manual/i }));
    await user.type(screen.getByPlaceholderText("Title"), "A Manual Book");
    await user.type(screen.getByPlaceholderText("Author"), "Ada Reader");
    await user.type(screen.getByPlaceholderText("Genre"), "Memoir");
    await user.clear(screen.getByPlaceholderText("Publication year"));
    await user.type(screen.getByPlaceholderText("Publication year"), "2026");
    await user.type(screen.getByPlaceholderText("Synopsis"), "A careful test.");
    await user.type(screen.getByPlaceholderText("Your review"), "Worth reading.");
    await user.clear(screen.getByPlaceholderText("Rating (0-5)"));
    await user.type(screen.getByPlaceholderText("Rating (0-5)"), "4");
    await user.click(screen.getByRole("button", { name: /save book/i }));

    expect(createBook).toHaveBeenCalledWith(expect.objectContaining({ title: "A Manual Book" }));
    expect(refreshFromStart).toHaveBeenCalled();
  });

  it("renders loading, error, and pagination copy", () => {
    hookState.infinite = {
      ...hookState.infinite,
      loadingInitial: true,
      error: "Could not load",
      loadingMore: true,
    };

    renderLibrary();

    expect(screen.getByText(/loading books/i)).toBeInTheDocument();
    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
  });

  it("shows a re-authentication banner when sync is paused after backend restart", () => {
    hookState.offlineSync = {
      isOfflineMode: false,
      offlineQueueCount: 1,
      isSyncingQueue: false,
      connectionMessage:
        "The backend restarted and your in-memory session expired. Please re-authenticate to sync your offline changes.",
      queueText: "1 change queued",
    };

    renderLibrary();

    expect(screen.getByText(/sync paused/i)).toBeInTheDocument();
    expect(screen.getByText(/offline queue is preserved/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /re-register account/i })).toBeInTheDocument();
  });

  it("shows only one realtime retry banner when realtime is disconnected", () => {
    hookState.realtime = {
      isRealtimeConnected: false,
      realtimeMessage: "Realtime updates disconnected, retrying...",
    };

    renderLibrary();

    expect(screen.getAllByText(/realtime updates disconnected, retrying/i)).toHaveLength(1);
  });
});
