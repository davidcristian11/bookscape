import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookDetailPage from "../BookDetailPage";

const updateBook = vi.fn();
const getBookById = vi.fn();
const deleteBook = vi.fn();
const getQuotesByBook = vi.fn();
const createQuote = vi.fn();
const updateQuote = vi.fn();
const deleteQuote = vi.fn();

const hookState = vi.hoisted(() => ({
  offlineSync: {
    isOfflineMode: false,
    offlineQueueCount: 0,
    isSyncingQueue: false,
    connectionMessage: "Online",
    queueText: "",
  },
  realtime: {
    isRealtimeConnected: true,
  },
}));

const baseBook = {
  id: "book-1",
  title: "Dune",
  author: "Frank Herbert",
  genre: "Sci-Fi",
  publication_year: 1965,
  source: "Goodreads",
  source_url: "",
  synopsis: "A desert planet.",
  review: "Original review",
  rating: 5,
  cover_url: null,
};

vi.mock("../../api/booksApi", () => ({
  getBookById: (...args) => getBookById(...args),
  updateBook: (...args) => updateBook(...args),
  deleteBook: (...args) => deleteBook(...args),
}));

vi.mock("../../api/quotesApi", () => ({
  getQuotesByBook: (...args) => getQuotesByBook(...args),
  createQuote: (...args) => createQuote(...args),
  updateQuote: (...args) => updateQuote(...args),
  deleteQuote: (...args) => deleteQuote(...args),
}));

vi.mock("../../hooks/useBooksOfflineSync", () => ({
  default: () => hookState.offlineSync,
}));

vi.mock("../../hooks/useBooksRealtime", () => ({
  default: () => hookState.realtime,
}));

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/book/book-1"]}>
      <Routes>
        <Route path="/book/:id" element={<BookDetailPage />} />
        <Route path="/library" element={<h1>Library</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BookDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBookById.mockResolvedValue(baseBook);
    getQuotesByBook.mockResolvedValue([]);
    updateBook.mockResolvedValue(baseBook);
    deleteBook.mockResolvedValue(null);
    createQuote.mockResolvedValue({});
    updateQuote.mockResolvedValue({});
    deleteQuote.mockResolvedValue(null);
    hookState.offlineSync = {
      isOfflineMode: false,
      offlineQueueCount: 0,
      isSyncingQueue: false,
      connectionMessage: "Online",
      queueText: "",
    };
    hookState.realtime = { isRealtimeConnected: true };
    window.confirm = vi.fn(() => true);
  });

  it("updates the review/details form", async () => {
    const user = userEvent.setup();
    updateBook.mockResolvedValue({ ...baseBook, review: "Updated review" });

    renderDetail();

    const review = await screen.findByPlaceholderText(/your review/i);
    await user.clear(review);
    await user.type(review, "Updated review");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateBook).toHaveBeenCalledWith(
      "book-1",
      expect.objectContaining({ review: "Updated review" })
    );
    expect(await screen.findByText(/changes saved/i)).toBeInTheDocument();
  });

  it("validates invalid book edits before saving", async () => {
    const user = userEvent.setup();
    renderDetail();

    const title = await screen.findByPlaceholderText("Title");
    await user.clear(title);
    const rating = document.querySelector('input[name="rating"]');
    await user.clear(rating);
    await user.type(rating, "9");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/rating must be between/i)).toBeInTheDocument();
    expect(updateBook).not.toHaveBeenCalled();
  });

  it("shows update failures without leaving the page", async () => {
    const user = userEvent.setup();
    updateBook.mockRejectedValue(new Error("Save failed"));
    renderDetail();

    await user.click(await screen.findByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();
  });

  it("creates quote cards and validates missing quote text", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole("button", { name: /create quote/i }));
    expect(screen.getByText(/quote text is required/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Quote text"), "Fear is the mind-killer.");
    await user.type(screen.getByPlaceholderText("Optional note"), "Theme");
    await user.type(screen.getByPlaceholderText("Relationship label"), "Resilience");
    await user.click(screen.getByRole("button", { name: /create quote/i }));

    expect(createQuote).toHaveBeenCalledWith(
      "book-1",
      expect.objectContaining({
        quote: "Fear is the mind-killer.",
        note: "Theme",
        relationship_label: "Resilience",
      })
    );
    expect(getQuotesByBook).toHaveBeenCalledTimes(2);
  });

  it("edits and deletes existing quote cards", async () => {
    const user = userEvent.setup();
    getQuotesByBook.mockResolvedValue([
      {
        id: "quote-1",
        quote: "A quote",
        note: "Note",
        relationship_label: "Identity",
      },
    ]);
    renderDetail();

    expect(await screen.findByText(/a quote/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.clear(screen.getByPlaceholderText("Quote text"));
    await user.type(screen.getByPlaceholderText("Quote text"), "Edited quote");
    await user.click(screen.getByRole("button", { name: /update quote/i }));

    expect(updateQuote).toHaveBeenCalledWith(
      "quote-1",
      expect.objectContaining({ quote: "Edited quote" })
    );

    const quoteCard = screen.getByText(/a quote/i).closest(".detail-quote-card");
    await user.click(within(quoteCard).getByRole("button", { name: /delete/i }));
    expect(deleteQuote).toHaveBeenCalledWith("quote-1");
  });

  it("does not delete quote cards when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);
    getQuotesByBook.mockResolvedValue([{ id: "quote-1", quote: "A quote" }]);
    renderDetail();

    const quoteCard = (await screen.findByText(/a quote/i)).closest(".detail-quote-card");
    await user.click(within(quoteCard).getByRole("button", { name: /delete/i }));

    expect(deleteQuote).not.toHaveBeenCalled();
  });

  it("deletes the book after confirmation", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole("button", { name: /delete book/i }));

    expect(deleteBook).toHaveBeenCalledWith("book-1");
    expect(await screen.findByText("Library")).toBeInTheDocument();
  });

  it("renders load errors and missing books", async () => {
    getBookById.mockRejectedValueOnce(new Error("Not available"));
    renderDetail();
    expect(await screen.findByText(/not available/i)).toBeInTheDocument();
  });

  it("shows sync banner when realtime is disconnected", async () => {
    hookState.realtime = { isRealtimeConnected: false };
    renderDetail();

    expect(await screen.findByText(/realtime updates disconnected/i)).toBeInTheDocument();
  });
});
