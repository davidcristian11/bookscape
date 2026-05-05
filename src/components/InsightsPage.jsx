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

      const bookStats = await getStats();
      let nextQuoteStats = null;

      try {
        nextQuoteStats = await getQuoteStats();
      } catch {
        nextQuoteStats = {
          total_quotes: 0,
          quotes_by_book: {},
          quotes_by_relationship: {},
        };
        if (!navigator.onLine) {
          setError("Insights will refresh when you are back online.");
        }
      }

      setStats(bookStats);
      setQuoteStats(nextQuoteStats);
    } catch (err) {
      setError(
        !navigator.onLine
          ? "Insights will refresh when you are back online."
          : err.message || "Failed to load stats."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const {
    isOfflineMode,
    offlineQueueCount,
    isSyncingQueue,
    connectionMessage,
    queueText,
  } = useBooksOfflineSync(loadAllStats);

  const { isRealtimeConnected, realtimeMessage } = useBooksRealtime(
    useCallback(
      (event) => {
        if (
          event.type === "book_created" ||
          event.type === "book_updated" ||
          event.type === "book_deleted" ||
          event.type === "ws_reconnected"
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

  const genreData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.books_by_genre).map(([name, value]) => ({
      name,
      value,
    }));
  }, [stats]);

  const sourceData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.books_by_source).map(([name, value]) => ({
      name,
      value,
    }));
  }, [stats]);

  const monthlyData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.books_by_month).map(([name, value]) => ({
      name,
      value,
    }));
  }, [stats]);

  const quoteRelationshipData = useMemo(() => {
    if (!quoteStats) return [];
    return Object.entries(quoteStats.quotes_by_relationship).map(([name, value]) => ({
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

  if (error && !stats) {
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
            <strong>{!navigator.onLine ? "Offline mode active" : connectionMessage}</strong>
            {queueText ? ` - ${queueText}` : ""}
          </p>
          <p style={{ margin: "0.35rem 0 0 0", color: "var(--text-gray)" }}>
            {navigator.onLine && isRealtimeConnected
              ? realtimeMessage
              : "Realtime updates disconnected, retrying..."}
          </p>
        </div>
      </div>

      {error && (
        <div className="review-card" style={{ marginBottom: "1.5rem" }}>
          <p className="author-text" role="status">{error}</p>
        </div>
      )}

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
            {connectionMessage}
          </h3>

          <p style={{ margin: 0, color: "var(--text-gray)" }}>
            {isOfflineMode
              ? "Book charts are currently rendered from locally cached books. Quote stats remain online-backed."
              : "The app is online again and queued changes are being synchronized."}
          </p>

          <p style={{ margin: "0.75rem 0 0 0", fontWeight: "bold" }}>
            {queueText || `Queued operations: ${offlineQueueCount}`}
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
            <h3>Books by Source</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={sourceData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                    label
                  >
                    {sourceData.map((entry, index) => (
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
            <h3>Books by Month</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Books" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="review-card">
            <h3>Quote Cards by Relationship</h3>
            {quoteRelationshipData.length === 0 ? (
              <p style={{ color: "var(--text-gray)" }}>
                No connected quote cards yet.
              </p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={quoteRelationshipData}>
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
