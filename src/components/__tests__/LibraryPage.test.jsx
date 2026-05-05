import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibraryPage from "../LibraryPage";

const refreshFromStart = vi.fn();
const deleteBook = vi.fn();

vi.mock("../../api/booksApi", () => ({
  createBook: vi.fn(),
  deleteBook: (...args) => deleteBook(...args),
  scrapeBook: vi.fn(),
}));

vi.mock("../../api/automationApi", () => ({
  getFakerLoopStatus: vi.fn(() => Promise.resolve({ running: false })),
  startFakerLoop: vi.fn(() => Promise.resolve({ running: true })),
  stopFakerLoop: vi.fn(() => Promise.resolve({ running: false })),
}));

vi.mock("../../hooks/useInfiniteBooks", () => ({
  default: () => ({
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
    loadNextPage: vi.fn(),
    refreshFromStart,
  }),
}));

vi.mock("../../hooks/useBooksOfflineSync", () => ({
  default: () => ({
    isOfflineMode: false,
    offlineQueueCount: 0,
    isSyncingQueue: false,
  }),
}));

vi.mock("../../hooks/useBooksRealtime", () => ({
  default: () => ({ isRealtimeConnected: true }),
}));

describe("LibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  it("renders the library and only loop faker controls", () => {
    render(<MemoryRouter><LibraryPage /></MemoryRouter>);

    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start faker loop/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /stop faker loop/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate faker/i })).not.toBeInTheDocument();
  });

  it("confirms before deleting a book", async () => {
    const user = userEvent.setup();
    deleteBook.mockResolvedValue(null);
    render(<MemoryRouter><LibraryPage /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteBook).toHaveBeenCalledWith("book-1");
  });
});
