import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IdeaNexus from "../IdeaNexus";

const apiMocks = vi.hoisted(() => ({
  getBooks: vi.fn(),
  getQuotesByBook: vi.fn(),
  createQuote: vi.fn(),
  deleteQuote: vi.fn(),
  updateQuote: vi.fn(),
}));

function setOnline(value) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

vi.mock("reactflow", () => ({
  default: ({ nodes, nodeTypes, onNodeDragStop }) => (
    <div>
      {nodes.map((node) => {
        const Node = nodeTypes[node.type];
        return <Node key={node.id} data={node.data} />;
      })}
      {nodes[0] && (
        <button
          type="button"
          onClick={() => onNodeDragStop(null, { ...nodes[0], position: { x: 44, y: 55 } })}
        >
          Drag first node
        </button>
      )}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => <span data-testid="handle" />,
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
  createQuote: apiMocks.createQuote,
  deleteQuote: apiMocks.deleteQuote,
  updateQuote: apiMocks.updateQuote,
}));

describe("IdeaNexus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnline(true);
    window.confirm = vi.fn(() => true);
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
    apiMocks.createQuote.mockResolvedValue({
      id: "quote-2",
      book_id: "book-1",
      quote: "New idea",
      relationship_label: "Related",
      position_x: 120,
      position_y: 140,
    });
    apiMocks.deleteQuote.mockResolvedValue(null);
    apiMocks.updateQuote.mockResolvedValue({});
  });

  it("renders predefined quote cards from Book -> QuoteCards data", async () => {
    render(<IdeaNexus />);

    expect(await screen.findByText(/survival begins with attention/i)).toBeInTheDocument();
    expect(screen.getByText("Resilience")).toBeInTheDocument();
  });

  it("adds quote cards through the board form", async () => {
    const user = userEvent.setup();
    render(<IdeaNexus />);

    await screen.findByText(/survival begins/i);
    await user.type(screen.getByPlaceholderText("Quote text"), "New idea");
    await user.click(screen.getByRole("button", { name: /add quote card/i }));

    expect(apiMocks.createQuote).toHaveBeenCalledWith(
      "book-1",
      expect.objectContaining({ quote: "New idea", relationship_label: "Related" })
    );
    expect(await screen.findByText(/new idea/i)).toBeInTheDocument();
  });

  it("validates the add quote form", async () => {
    const user = userEvent.setup();
    render(<IdeaNexus />);

    await screen.findByText(/survival begins/i);
    await user.click(screen.getByRole("button", { name: /add quote card/i }));

    expect(screen.getByText(/choose a book and enter quote text/i)).toBeInTheDocument();
    expect(apiMocks.createQuote).not.toHaveBeenCalled();
  });

  it("deletes quote cards from nodes after confirmation", async () => {
    const user = userEvent.setup();
    render(<IdeaNexus />);

    await user.click(await screen.findByRole("button", { name: /delete/i }));

    expect(apiMocks.deleteQuote).toHaveBeenCalledWith("quote-1");
    await waitFor(() => {
      expect(screen.queryByText(/survival begins/i)).not.toBeInTheDocument();
    });
  });

  it("does not delete nodes when confirmation is cancelled", async () => {
    const user = userEvent.setup();
    window.confirm = vi.fn(() => false);
    render(<IdeaNexus />);

    await user.click(await screen.findByRole("button", { name: /delete/i }));

    expect(apiMocks.deleteQuote).not.toHaveBeenCalled();
    expect(screen.getByText(/survival begins/i)).toBeInTheDocument();
  });

  it("persists node positions after drag", async () => {
    const user = userEvent.setup();
    render(<IdeaNexus />);

    await user.click(await screen.findByRole("button", { name: /drag first node/i }));

    expect(apiMocks.updateQuote).toHaveBeenCalledWith("quote-1", {
      position_x: 44,
      position_y: 55,
    });
  });

  it("shows an intentional empty board when there are no quote cards", async () => {
    apiMocks.getQuotesByBook.mockResolvedValue([]);
    render(<IdeaNexus />);

    expect(await screen.findByText(/no quote cards yet/i)).toBeInTheDocument();
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

    expect(await screen.findByText(/survival begins with attention/i)).toBeInTheDocument();
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

    expect(await screen.findByText(/survival begins with attention/i)).toBeInTheDocument();
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
