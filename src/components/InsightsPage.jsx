import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getStats } from "../api/booksApi";
import { getQuoteStats } from "../api/quotesApi";
import useBooksOfflineSync from "../hooks/useBooksOfflineSync";
import useBooksRealtime from "../hooks/useBooksRealtime";
import { getBooksChangedEventName } from "../utils/localBooksStore";
import "./Library.css";

const PIE_COLORS = ["#10b981", "#f59e0b", "#6366f1", "#ef4444", "#8b5cf6"];

export default function InsightsPage() {
  const [stats, setStats] = useState(null);
  const [quoteStats, setQuoteStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAllStats = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [bookStats, nextQuoteStats] = await Promise.all([
        getStats(),
        getQuoteStats(),
      ]);

      setStats(bookStats);
      setQuoteStats(nextQuoteStats);
    } catch (err) {
      setError(err.message || "Failed to load stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  const {
    isOfflineMode,
    offlineQueueCount,
    isSyncingQueue,
  } = useBooksOfflineSync(loadAllStats);

  const { isRealtimeConnected } = useBooksRealtime(
    useCallback(
      (event) => {
        if (
          event.type === "book_created" ||
          event.type === "book_updated" ||
          event.type === "book_deleted"
        ) {
          loadAllStats();
        }
      },
      [loadAllStats]
    )
  );

  useEffect(() => {
    loadAllStats();
  }, [loadAllStats]);

  useEffect(() => {
    const handleBooksChanged = () => {
      loadAllStats();
    };

    window.addEventListener(getBooksChangedEventName(), handleBooksChanged);

    return () => {
      window.removeEventListener(getBooksChangedEventName(), handleBooksChanged);
    };
  }, [loadAllStats]);

  const statusData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.books_by_status).map(([name, value]) => ({
      name,
      value,
    }));
  }, [stats]);

  const genreData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.books_by_genre).map(([name, value]) => ({
      name,
      value,
    }));
  }, [stats]);

  const quoteTagData = useMemo(() => {
    if (!quoteStats) return [];
    return Object.entries(quoteStats.quotes_by_tag).map(([name, value]) => ({
      name,
      value,
    }));
  }, [quoteStats]);

  if (loading) {
    return (
      <div className="library-container">
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="library-container">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!stats || !quoteStats) {
    return (
      <div className="library-container">
        <p>No statistics available.</p>
      </div>
    );
  }

  return (
    <div className="library-container">
      <header className="library-header">
        <h1>Reading Insights</h1>
      </header>

      <div
        className="review-card"
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ marginBottom: "0.5rem" }}>Realtime updates</h3>
          <p style={{ margin: 0, color: "var(--text-gray)" }}>
            WebSocket status:{" "}
            <strong>{isRealtimeConnected ? "Connected" : "Disconnected"}</strong>
          </p>
        </div>
      </div>

      {(isOfflineMode || offlineQueueCount > 0 || isSyncingQueue) && (
        <div
          className="review-card"
          style={{
            marginBottom: "1.5rem",
            background: "#fff7ed",
            border: "1px solid #fdba74",
          }}
        >
          <h3 style={{ marginBottom: "0.75rem" }}>
            {isSyncingQueue
              ? "Synchronizing offline changes..."
              : isOfflineMode
              ? "Offline mode active"
              : "Pending changes waiting to sync"}
          </h3>

          <p style={{ margin: 0, color: "var(--text-gray)" }}>
            {isOfflineMode
              ? "Book charts are currently rendered from locally cached books. Quote stats remain online-backed."
              : "The app is online again and queued changes are being synchronized."}
          </p>

          <p style={{ margin: "0.75rem 0 0 0", fontWeight: "bold" }}>
            Queued operations: {offlineQueueCount}
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <div className="review-card">
          <h3>Total Books</h3>
          <p
            style={{
              fontSize: "2.2rem",
              fontWeight: "bold",
              margin: "0.5rem 0 0 0",
            }}
          >
            {stats.total_books}
          </p>
        </div>

        <div className="review-card">
          <h3>Average Rating</h3>
          <p
            style={{
              fontSize: "2.2rem",
              fontWeight: "bold",
              margin: "0.5rem 0 0 0",
            }}
          >
            {stats.average_rating ?? "N/A"}
          </p>
        </div>

        <div className="review-card">
          <h3>Total Quote Cards</h3>
          <p
            style={{
              fontSize: "2.2rem",
              fontWeight: "bold",
              margin: "0.5rem 0 0 0",
            }}
          >
            {quoteStats.total_quotes}
          </p>
        </div>
      </div>

      {stats.total_books === 0 ? (
        <div className="review-card">
          <h3>No data yet</h3>
          <p style={{ color: "var(--text-gray)" }}>
            Add books and quote cards to see statistics here.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: "1.5rem",
          }}
        >
          <div className="review-card">
            <h3>Books by Status</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    label
                  >
                    {statusData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="review-card">
            <h3>Books by Genre</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={genreData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Books" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="review-card">
            <h3>Quote Cards by Tag</h3>
            {quoteTagData.length === 0 ? (
              <p style={{ color: "var(--text-gray)" }}>
                No tagged quote cards yet.
              </p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={quoteTagData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name="Quotes" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}