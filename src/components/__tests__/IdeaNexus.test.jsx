import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IdeaNexus from "../IdeaNexus";

const apiMocks = vi.hoisted(() => ({
  getBooks: vi.fn(),
  getQuotesByBook: vi.fn(),
}));

function setOnline(value) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

vi.mock("reactflow", () => ({
  default: ({ nodes }) => (
    <div>
      {nodes.map((node) => (
        <div key={node.id}>{node.data.quote}</div>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
  addEdge: (edge, edges) => [...edges, edge],
  applyEdgeChanges: (_changes, edges) => edges,
  applyNodeChanges: (_changes, nodes) => nodes,
}));

vi.mock("../../api/booksApi", () => ({
  getBooks: apiMocks.getBooks,
  checkBooksServerAvailability: vi.fn(() => Promise.resolve(true)),
  getOfflineQueueCount: vi.fn(() => 0),
  syncQueuedBookOperations: vi.fn(() => Promise.resolve({ synced: true, count: 0 })),
}));

vi.mock("../../api/quotesApi", () => ({
  getQuotesByBook: apiMocks.getQuotesByBook,
  createQuote: vi.fn(),
  deleteQuote: vi.fn(),
  updateQuote: vi.fn(),
}));

describe("IdeaNexus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnline(true);
    apiMocks.getBooks.mockResolvedValue({
      items: [{ id: "book-1", title: "Dune" }],
      total: 1,
      page: 1,
      page_size: 100,
      total_pages: 1,
    });
    apiMocks.getQuotesByBook.mockResolvedValue([
      {
        id: "quote-1",
        book_id: "book-1",
        quote: "Survival begins with attention.",
        relationship_label: "Resilience",
        position_x: 80,
        position_y: 80,
      },
    ]);
  });

  it("renders predefined quote cards from Book -> QuoteCards data", async () => {
    render(<IdeaNexus />);

    expect(await screen.findByText("Survival begins with attention.")).toBeInTheDocument();
  });

  it("offers retry and recovers after an offline fetch failure", async () => {
    const user = userEvent.setup();
    apiMocks.getBooks
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        items: [{ id: "book-1", title: "Dune" }],
        total: 1,
        page: 1,
        page_size: 100,
        total_pages: 1,
      });

    render(<IdeaNexus />);

    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Survival begins with attention.")).toBeInTheDocument();
  });

  it("automatically retries after the browser comes back online", async () => {
    apiMocks.getBooks
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        items: [{ id: "book-1", title: "Dune" }],
        total: 1,
        page: 1,
        page_size: 100,
        total_pages: 1,
      });

    render(<IdeaNexus />);

    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();

    window.dispatchEvent(new Event("online"));

    expect(await screen.findByText("Survival begins with attention.")).toBeInTheDocument();
  });

  it("suppresses the generic server error while the browser is offline", async () => {
    setOnline(false);
    apiMocks.getBooks.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<IdeaNexus />);

    expect(await screen.findByText(/offline mode active/i)).toBeInTheDocument();
    expect(screen.getByText(/will refresh when BookScape can reach the server/i)).toBeInTheDocument();
    expect(screen.queryByText(/could not reach the server/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
