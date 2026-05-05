import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InsightsPage from "../InsightsPage";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  Bar: () => <div>bar</div>,
  CartesianGrid: () => null,
  Legend: () => null,
  PieChart: ({ children }) => <div>{children}</div>,
  Pie: ({ children }) => <div>{children}</div>,
  Cell: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

vi.mock("../../api/booksApi", () => ({
  getStats: vi.fn(() =>
    Promise.resolve({
      total_books: 3,
      average_rating: 4.33,
      books_by_genre: { "Sci-Fi": 2, Dystopian: 1 },
      books_by_source: { Goodreads: 2, Amazon: 1 },
      books_by_month: { "2026-05": 3 },
      top_rated_sources: { Goodreads: 4.5 },
      quotes_per_book: { Dune: 2 },
    })
  ),
}));

vi.mock("../../api/quotesApi", () => ({
  getQuoteStats: vi.fn(() =>
    Promise.resolve({
      total_quotes: 5,
      quotes_by_book: { Dune: 2 },
      quotes_by_relationship: { Resilience: 2 },
    })
  ),
}));

vi.mock("../../hooks/useBooksOfflineSync", () => ({
  default: () => ({ isOfflineMode: false, offlineQueueCount: 0, isSyncingQueue: false }),
}));

vi.mock("../../hooks/useBooksRealtime", () => ({
  default: () => ({ isRealtimeConnected: true }),
}));

describe("InsightsPage", () => {
  it("renders reading insights summary cards", async () => {
    render(<InsightsPage />);

    expect(await screen.findByText("Reading Insights")).toBeInTheDocument();
    expect(screen.getByText("Total Books")).toBeInTheDocument();
    expect(screen.getByText("Total Quote Cards")).toBeInTheDocument();
    expect(screen.getByText("Books by Source")).toBeInTheDocument();
  });
});
