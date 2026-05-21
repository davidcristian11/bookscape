import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import "./Insights.css";

const PIE_COLORS = ["#2c4a3e", "#c75b33", "#d9a441", "#8f3f38", "#5f7f6f"];

function InsightsLoading() {
  return (
    <div className="library-container insights-page">
      <header className="library-header page-header">
        <div>
          <span className="section-kicker">Reading patterns</span>
          <h1>Loading insights</h1>
        </div>
      </header>
      <div className="loading-state" role="status">
        <p>Loading statistics...</p>
        <div className="insights-summary-grid" aria-hidden="true">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const shouldReduceMotion = useReducedMotion();
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

  const { isRealtimeConnected } = useBooksRealtime(
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

  const realtimeNeedsAttention = navigator.onLine && !isRealtimeConnected;
  const authSyncRequired = (connectionMessage || "").includes("server session expired");
  const showConnectionBanner =
    !navigator.onLine ||
    isOfflineMode ||
    offlineQueueCount > 0 ||
    isSyncingQueue ||
    authSyncRequired ||
    ["Server unreachable", "Syncing...", "Sync failed", "Synced successfully"].includes(connectionMessage) ||
    realtimeNeedsAttention;

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
    return <InsightsLoading />;
  }

  if (error && !stats) {
    return (
      <div className="library-container insights-page">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!stats || !quoteStats) {
    return (
      <div className="library-container insights-page">
        <p>No statistics available.</p>
      </div>
    );
  }

  const metricCards = [
    { label: "Total Books", value: stats.total_books },
    { label: "Average Rating", value: stats.average_rating ?? "N/A" },
    { label: "Total Quote Cards", value: quoteStats.total_quotes },
  ];
  const reveal = shouldReduceMotion ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="library-container insights-page">
      <header className="library-header page-header">
        <div>
          <span className="section-kicker">Reading patterns</span>
          <h1>Reading Insights</h1>
          <p className="page-subtitle">
            A quick pulse on sources, genres, reading momentum, and quote relationships.
          </p>
        </div>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div
            className="review-card inline-alert"
            role="status"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <p className="author-text">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showConnectionBanner && (
          <motion.div
            className={`review-card connection-banner ${isSyncingQueue ? "syncing" : ""}`}
            role="status"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h3>
              {!navigator.onLine
                ? "Offline mode active"
                : authSyncRequired
                  ? "Sync paused: re-authentication required"
                  : realtimeNeedsAttention
                    ? "Realtime updates disconnected, retrying..."
                    : offlineQueueCount > 0
                      ? queueText || `${offlineQueueCount} changes queued`
                      : connectionMessage}
            </h3>

            <p>
              {!navigator.onLine || isOfflineMode
                ? "Offline mode active. Changes will sync when the server is reachable."
                : authSyncRequired
                  ? "Your cached insights remain visible. Re-authenticate to sync queued offline changes."
                  : realtimeNeedsAttention
                    ? "Live updates are reconnecting in the background."
                    : isSyncingQueue
                      ? "The app is online again and queued changes are being synchronized."
                      : "Insights will refresh from the canonical server state."}
            </p>

            {(queueText || offlineQueueCount > 0) && (
              <p style={{ marginTop: "0.75rem", fontWeight: "bold" }}>
                {queueText || `Queued operations: ${offlineQueueCount}`}
              </p>
            )}

            {authSyncRequired && (
              <div className="recovery-actions">
                <Link className="view-details-btn" to="/login">
                  Log in to sync
                </Link>
                <Link className="scrape-submit-btn" to="/register">
                  Re-register account
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div className="insights-summary-grid" {...(shouldReduceMotion ? {} : { initial: "hidden", animate: "visible" })}>
        {metricCards.map((metric, index) => (
          <motion.section
            key={metric.label}
            className="review-card insight-metric-card"
            variants={shouldReduceMotion ? undefined : { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.22, delay: index * 0.04 }}
          >
            <span className="metric-label">{metric.label}</span>
            <p className="metric-value">{metric.value}</p>
          </motion.section>
        ))}
      </motion.div>

      {stats.total_books === 0 ? (
        <motion.div className="review-card empty-state" {...reveal} transition={{ duration: 0.24 }}>
          <h3>No data yet</h3>
          <p>Add books and quote cards to see statistics here.</p>
        </motion.div>
      ) : (
        <div className="insights-charts-grid">
          <motion.section className="review-card chart-card" {...reveal} transition={{ duration: 0.24 }}>
            <h3>Books by Source</h3>
            <div className="chart-frame">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" outerRadius={100} label>
                    {sourceData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          <motion.section className="review-card chart-card" {...reveal} transition={{ duration: 0.24, delay: 0.04 }}>
            <h3>Books by Genre</h3>
            <div className="chart-frame">
              <ResponsiveContainer>
                <BarChart data={genreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(102, 115, 107, 0.22)" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Books" fill="#2c4a3e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          <motion.section className="review-card chart-card" {...reveal} transition={{ duration: 0.24, delay: 0.08 }}>
            <h3>Books by Month</h3>
            <div className="chart-frame">
              <ResponsiveContainer>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(102, 115, 107, 0.22)" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Books" fill="#c75b33" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.section>

          <motion.section className="review-card chart-card" {...reveal} transition={{ duration: 0.24, delay: 0.12 }}>
            <h3>Quote Cards by Relationship</h3>
            {quoteRelationshipData.length === 0 ? (
              <p className="empty-chart-state">No connected quote cards yet.</p>
            ) : (
              <div className="chart-frame">
                <ResponsiveContainer>
                  <BarChart data={quoteRelationshipData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(102, 115, 107, 0.22)" />
                    <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name="Quotes" fill="#8f3f38" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.section>
        </div>
      )}
    </div>
  );
}
