import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InsightsPage from "../InsightsPage";

const apiMocks = vi.hoisted(() => ({
  getStats: vi.fn(),
  getQuoteStats: vi.fn(),
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

const statsPayload = {
  total_books: 3,
  average_rating: 4.33,
  books_by_genre: { "Sci-Fi": 2, Dystopian: 1 },
  books_by_source: { Goodreads: 2, Amazon: 1 },
  books_by_month: { "2026-05": 3 },
  top_rated_sources: { Goodreads: 4.5 },
  quotes_per_book: { Dune: 2 },
};

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
  getStats: (...args) => apiMocks.getStats(...args),
}));

vi.mock("../../api/quotesApi", () => ({
  getQuoteStats: (...args) => apiMocks.getQuoteStats(...args),
}));

vi.mock("../../hooks/useBooksOfflineSync", () => ({
  default: () => apiMocks.offlineSync,
}));

vi.mock("../../hooks/useBooksRealtime", () => ({
  default: () => apiMocks.realtime,
}));

function setOnline(value) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

function renderInsights() {
  return render(
    <MemoryRouter>
      <InsightsPage />
    </MemoryRouter>
  );
}

describe("InsightsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setOnline(true);
    apiMocks.getStats.mockResolvedValue(statsPayload);
    apiMocks.getQuoteStats.mockResolvedValue({
      total_quotes: 5,
      quotes_by_book: { Dune: 2 },
      quotes_by_relationship: { Resilience: 2 },
    });
    apiMocks.offlineSync = {
      isOfflineMode: false,
      offlineQueueCount: 0,
      isSyncingQueue: false,
      connectionMessage: "Online",
      queueText: "",
    };
    apiMocks.realtime = { isRealtimeConnected: true };
  });

  it("renders reading insights summary cards", async () => {
    renderInsights();

    expect(await screen.findByText("Reading Insights")).toBeInTheDocument();
    expect(screen.getByText("Total Books")).toBeInTheDocument();
    expect(screen.getByText("Total Quote Cards")).toBeInTheDocument();
    expect(screen.getByText("Books by Source")).toBeInTheDocument();
  });

  it("shows an empty state when there are no books", async () => {
    apiMocks.getStats.mockResolvedValue({
      ...statsPayload,
      total_books: 0,
      average_rating: null,
      books_by_genre: {},
      books_by_source: {},
      books_by_month: {},
    });
    apiMocks.getQuoteStats.mockResolvedValue({
      total_quotes: 0,
      quotes_by_book: {},
      quotes_by_relationship: {},
    });

    renderInsights();

    expect(await screen.findByText(/no data yet/i)).toBeInTheDocument();
  });

  it("shows quote relationship empty state independently of book stats", async () => {
    apiMocks.getQuoteStats.mockResolvedValue({
      total_quotes: 0,
      quotes_by_book: {},
      quotes_by_relationship: {},
    });

    renderInsights();

    expect(await screen.findByText(/no connected quote cards yet/i)).toBeInTheDocument();
  });

  it("shows a full error when book stats cannot load", async () => {
    apiMocks.getStats.mockRejectedValue(new Error("Stats failed"));

    renderInsights();

    expect(await screen.findByText(/stats failed/i)).toBeInTheDocument();
  });

  it("keeps book stats visible when quote stats fail offline", async () => {
    setOnline(false);
    apiMocks.getQuoteStats.mockRejectedValue(new Error("offline"));

    renderInsights();

    expect(await screen.findByText("Reading Insights")).toBeInTheDocument();
    expect(screen.getByText(/insights will refresh/i)).toBeInTheDocument();
    expect(screen.getAllByText(/offline mode active/i).length).toBeGreaterThan(0);
  });

  it("shows sync recovery actions when auth is required", async () => {
    apiMocks.offlineSync = {
      isOfflineMode: false,
      offlineQueueCount: 1,
      isSyncingQueue: false,
      connectionMessage:
        "Your server session expired. Please sign in again to sync your offline changes.",
      queueText: "1 change queued",
    };

    renderInsights();

    expect(await screen.findByText(/sync paused/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in to sync/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /re-register account/i })).toBeInTheDocument();
  });
});
