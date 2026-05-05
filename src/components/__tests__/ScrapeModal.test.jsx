import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ScrapeModal from "../ScrapeModal";

const scrapeBook = vi.fn();

vi.mock("../../api/booksApi", () => ({
  scrapeBook: (...args) => scrapeBook(...args),
}));

describe("ScrapeModal", () => {
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
});
