import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import BookDetailPage from "../BookDetailPage";

const updateBook = vi.fn();

vi.mock("../../api/booksApi", () => ({
  getBookById: vi.fn(() =>
    Promise.resolve({
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
    })
  ),
  updateBook: (...args) => updateBook(...args),
  deleteBook: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../api/quotesApi", () => ({
  getQuotesByBook: vi.fn(() => Promise.resolve([])),
  createQuote: vi.fn(),
  updateQuote: vi.fn(),
  deleteQuote: vi.fn(),
}));

vi.mock("../../hooks/useBooksOfflineSync", () => ({
  default: () => ({ isOfflineMode: false, offlineQueueCount: 0, isSyncingQueue: false }),
}));

vi.mock("../../hooks/useBooksRealtime", () => ({
  default: () => ({ isRealtimeConnected: true }),
}));

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={["/book/book-1"]}>
      <Routes>
        <Route path="/book/:id" element={<BookDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("BookDetailPage", () => {
  it("updates the review/details form", async () => {
    const user = userEvent.setup();
    updateBook.mockResolvedValue({
      id: "book-1",
      title: "Dune",
      author: "Frank Herbert",
      genre: "Sci-Fi",
      publication_year: 1965,
      source: "Goodreads",
      source_url: "",
      synopsis: "A desert planet.",
      review: "Updated review",
      rating: 5,
      cover_url: null,
    });

    renderDetail();

    const review = await screen.findByPlaceholderText(/your review/i);
    await user.clear(review);
    await user.type(review, "Updated review");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(updateBook).toHaveBeenCalledWith(
      "book-1",
      expect.objectContaining({ review: "Updated review" })
    );
  });
});
