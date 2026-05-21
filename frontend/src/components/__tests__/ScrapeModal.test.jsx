import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScrapeModal from "../ScrapeModal";

const scrapeBook = vi.fn();

vi.mock("../../api/booksApi", () => ({
  scrapeBook: (...args) => scrapeBook(...args),
}));

describe("ScrapeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    render(<ScrapeModal isOpen={false} onClose={vi.fn()} onAddBook={vi.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("validates scrape URL before calling the backend", async () => {
    const user = userEvent.setup();
    render(<ScrapeModal isOpen onClose={vi.fn()} onAddBook={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/goodreads/i), "not-a-url");
    await user.click(screen.getByRole("button", { name: /start scraping now/i }));

    expect(screen.getByText(/valid http or https/i)).toBeInTheDocument();
    expect(scrapeBook).not.toHaveBeenCalled();
  });

  it("submits supported scrape URLs", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    scrapeBook.mockResolvedValue({ id: "book-1" });
    render(<ScrapeModal isOpen onClose={onClose} onAddBook={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText(/goodreads/i),
      "https://www.goodreads.com/book/show/1"
    );
    await user.click(screen.getByRole("button", { name: /start scraping now/i }));

    expect(scrapeBook).toHaveBeenCalledWith("https://www.goodreads.com/book/show/1");
  });

  it("validates required manual fields before submission", async () => {
    const user = userEvent.setup();
    const onAddBook = vi.fn();
    render(<ScrapeModal isOpen onClose={vi.fn()} onAddBook={onAddBook} />);

    await user.click(screen.getByRole("button", { name: /manual/i }));
    await user.click(screen.getByRole("button", { name: /save book/i }));

    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
    expect(screen.getByText(/author is required/i)).toBeInTheDocument();
    expect(onAddBook).not.toHaveBeenCalled();
  });

  it("submits manual books with normalized optional fields", async () => {
    const user = userEvent.setup();
    const onAddBook = vi.fn(() => Promise.resolve({ id: "book-2" }));
    const onBookCreated = vi.fn();
    const onClose = vi.fn();
    render(
      <ScrapeModal
        isOpen
        onClose={onClose}
        onAddBook={onAddBook}
        onBookCreated={onBookCreated}
      />
    );

    await user.click(screen.getByRole("button", { name: /manual/i }));
    await user.type(screen.getByPlaceholderText("Title"), "Manual Title");
    await user.type(screen.getByPlaceholderText("Author"), "Manual Author");
    await user.type(screen.getByPlaceholderText("Genre"), "Essays");
    await user.clear(screen.getByPlaceholderText("Publication year"));
    await user.type(screen.getByPlaceholderText("Publication year"), "2026");
    await user.type(screen.getByPlaceholderText("Synopsis"), "A synopsis.");
    await user.clear(screen.getByPlaceholderText("Rating (0-5)"));
    await user.type(screen.getByPlaceholderText("Rating (0-5)"), "3");
    await user.click(screen.getByRole("button", { name: /save book/i }));

    expect(onAddBook).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Manual Title",
        source: "Manual",
        source_url: null,
        cover_url: null,
        rating: 3,
      })
    );
    expect(onBookCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows submit errors without closing", async () => {
    const user = userEvent.setup();
    scrapeBook.mockRejectedValue(new Error("Scraper unavailable"));
    const onClose = vi.fn();
    render(<ScrapeModal isOpen onClose={onClose} onAddBook={vi.fn()} />);

    await user.type(
      screen.getByPlaceholderText(/goodreads/i),
      "https://www.goodreads.com/book/show/1"
    );
    await user.click(screen.getByRole("button", { name: /start scraping now/i }));

    expect(await screen.findByText(/scraper unavailable/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from the cancel and close controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<ScrapeModal isOpen onClose={onClose} onAddBook={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ScrapeModal isOpen onClose={onClose} onAddBook={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /close modal/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
