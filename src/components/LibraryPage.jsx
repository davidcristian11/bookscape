import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ScrapeModal from "./ScrapeModal";
import { deleteBook, createBook } from "../api/booksApi";
import { startFakerLoop, stopFakerLoop } from "../api/automationApi";
import { getStarterBooks } from "../utils/demoBooks";
import { buildFakeBooks } from "../utils/fakerBooks";
import useBooksOfflineSync from "../hooks/useBooksOfflineSync";
import useBooksRealtime from "../hooks/useBooksRealtime";
import useInfiniteBooks from "../hooks/useInfiniteBooks";
import "./Library.css";

const setCookie = (name, value, days) => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
};

const getCookie = (name) => {
  const match = document.cookie.match(
    new RegExp("(^| )" + name + "=([^;]+)")
  );
  return match ? match[2] : null;
};

function renderStars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export default function LibraryPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(
    getCookie("libraryViewPreference") || "list"
  );

  const [bulkLoading, setBulkLoading] = useState(false);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [isFakerRunning, setIsFakerRunning] = useState(false);

  const loadMoreTriggerRef = useRef(null);

  const itemsPerPage = viewMode === "grid" ? 6 : 3;

  const {
    books,
    totalBooks,
    loadingInitial,
    loadingMore,
    error,
    hasMore,
    loadNextPage,
    refreshFromStart,
  } = useInfiniteBooks(itemsPerPage);

  const {
    isOfflineMode,
    offlineQueueCount,
    isSyncingQueue,
  } = useBooksOfflineSync(refreshFromStart);

  const { isRealtimeConnected } = useBooksRealtime(
    useCallback(
      (event) => {
        if (
          event.type === "book_created" ||
          event.type === "book_updated" ||
          event.type === "book_deleted"
        ) {
          refreshFromStart();
        }

        if (event.type === "faker_started") {
          setIsFakerRunning(true);
        }

        if (event.type === "faker_stopped") {
          setIsFakerRunning(false);
        }
      },
      [refreshFromStart]
    )
  );

  useEffect(() => {
    const sentinel = loadMoreTriggerRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (
          firstEntry.isIntersecting &&
          hasMore &&
          !loadingInitial &&
          !loadingMore
        ) {
          loadNextPage();
        }
      },
      {
        root: null,
        rootMargin: "300px 0px",
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadingInitial, loadingMore, loadNextPage, books.length]);

  const handleViewChange = (mode) => {
    setViewMode(mode);
    setCookie("libraryViewPreference", mode, 7);
  };

  const handleDeleteBook = async (id) => {
    try {
      await deleteBook(id);
      await refreshFromStart();
    } catch (err) {
      alert(err.message || "Failed to delete book.");
    }
  };

  const handleAddBook = async (newBookPayload) => {
    await createBook(newBookPayload);
    await refreshFromStart();
  };

  const handleAddMultipleBooks = async (bookPayloads) => {
    try {
      setBulkLoading(true);

      await Promise.all(bookPayloads.map((payload) => createBook(payload)));
      await refreshFromStart();
    } catch (err) {
      alert(err.message || "Failed to create demo books.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleLoadStarterBooks = async () => {
    await handleAddMultipleBooks(getStarterBooks());
  };

  const handleGenerateFakerBooks = async () => {
    await handleAddMultipleBooks(buildFakeBooks(5));
  };

  const handleStartFakerLoop = async () => {
    try {
      setAutomationLoading(true);
      await startFakerLoop(2);
      setIsFakerRunning(true);
    } catch (err) {
      alert(err.message || "Failed to start faker loop.");
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleStopFakerLoop = async () => {
    try {
      setAutomationLoading(true);
      await stopFakerLoop();
      setIsFakerRunning(false);
    } catch (err) {
      alert(err.message || "Failed to stop faker loop.");
    } finally {
      setAutomationLoading(false);
    }
  };

  const showEmptyState = !loadingInitial && !error && books.length === 0;

  return (
    <div className="library-container">
      <header className="library-header">
        <h1>My Library</h1>

        <div className="library-controls" style={{ flexWrap: "wrap" }}>
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => handleViewChange("list")}
            >
              List
            </button>
            <button
              className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => handleViewChange("grid")}
            >
              Grid
            </button>
          </div>

          <button
            className="scrape-btn"
            onClick={handleLoadStarterBooks}
            disabled={bulkLoading}
          >
            {bulkLoading ? "Loading..." : "Load Starter Books"}
          </button>

          <button
            className="scrape-btn"
            onClick={handleGenerateFakerBooks}
            disabled={bulkLoading}
            style={{ backgroundColor: "#4f46e5" }}
          >
            {bulkLoading ? "Generating..." : "Generate Faker Books"}
          </button>

          <button
            className="scrape-btn"
            onClick={handleStartFakerLoop}
            disabled={automationLoading}
            style={{ backgroundColor: "#0ea5e9" }}
          >
            {automationLoading ? "Working..." : "Start Faker Loop"}
          </button>

          <button
            className="scrape-btn"
            onClick={handleStopFakerLoop}
            disabled={automationLoading}
            style={{ backgroundColor: "#ef4444" }}
          >
            {automationLoading ? "Working..." : "Stop Faker Loop"}
          </button>

          <button
            className="scrape-btn"
            onClick={() => setIsModalOpen(true)}
          >
            + Add New Book
          </button>
        </div>
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

        <div>
          <h3 style={{ marginBottom: "0.5rem" }}>Faker automation</h3>
          <p style={{ margin: 0, color: "var(--text-gray)" }}>
            Loop status:{" "}
            <strong>{isFakerRunning ? "Running" : "Stopped"}</strong>
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
              ? "The network or server is unavailable. CRUD actions are stored locally and will sync when the connection comes back."
              : "The app is online again and queued changes are being synchronized."}
          </p>

          <p style={{ margin: "0.75rem 0 0 0", fontWeight: "bold" }}>
            Queued operations: {offlineQueueCount}
          </p>
        </div>
      )}

      {loadingInitial && <p>Loading books...</p>}
      {error && <p className="error-text">{error}</p>}

      {showEmptyState && (
        <div className="review-card">
          <h3>Your library is empty</h3>
          <p style={{ marginBottom: "1.5rem", color: "var(--text-gray)" }}>
            Start by adding your 3 starter books, generate random demo books with
            Faker, start the backend faker loop, or add one manually.
          </p>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button
              className="scrape-submit-btn"
              onClick={handleLoadStarterBooks}
              disabled={bulkLoading}
            >
              Load 3 Starter Books
            </button>

            <button
              className="scrape-submit-btn"
              onClick={handleGenerateFakerBooks}
              disabled={bulkLoading}
              style={{ backgroundColor: "#4f46e5" }}
            >
              Generate 5 Faker Books
            </button>

            <button
              className="scrape-submit-btn"
              onClick={handleStartFakerLoop}
              disabled={automationLoading}
              style={{ backgroundColor: "#0ea5e9" }}
            >
              Start Faker Loop
            </button>

            <button
              className="cancel-btn"
              onClick={() => setIsModalOpen(true)}
            >
              Add Manually
            </button>
          </div>
        </div>
      )}

      {!loadingInitial && !error && books.length > 0 && viewMode === "list" && (
        <div className="table-container">
          <table className="books-table">
            <thead>
              <tr>
                <th>Cover</th>
                <th>Title & Author</th>
                <th>Genre</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {books.map((book) => (
                <tr key={book.id}>
                  <td>
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        style={{
                          width: "40px",
                          height: "60px",
                          objectFit: "cover",
                          borderRadius: "2px",
                        }}
                      />
                    ) : (
                      <div className="mock-cover"></div>
                    )}
                  </td>

                  <td>
                    <strong>{book.title}</strong>
                    <p className="author-text">
                      {book.author}
                      {book._offline ? " • pending sync" : ""}
                    </p>
                  </td>

                  <td>
                    <span className="genre-badge">{book.genre}</span>
                  </td>

                  <td className="rating-stars">{renderStars(book.rating)}</td>

                  <td className="source-text">{book.status}</td>

                  <td className="actions-cell">
                    <Link
                      to={`/book/${book.id}`}
                      className="action-icon"
                      title="View details"
                    >
                      👁️
                    </Link>
                    <button
                      onClick={() => handleDeleteBook(book.id)}
                      className="action-icon delete"
                      title="Delete book"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loadingInitial && !error && books.length > 0 && viewMode === "grid" && (
        <div className="grid-container">
          {books.map((book) => (
            <div key={book.id} className="book-grid-card">
              {book.cover_url ? (
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="grid-cover"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div className="grid-cover"></div>
              )}

              <div className="grid-card-content">
                <strong>{book.title}</strong>
                <p className="author-text">
                  {book.author}
                  {book._offline ? " • pending sync" : ""}
                </p>
                <p className="author-text">
                  {book.genre} • {book.status}
                </p>

                <div className="grid-card-footer">
                  <span className="rating-stars">
                    {renderStars(book.rating)}
                  </span>
                  <Link
                    to={`/book/${book.id}`}
                    className="view-details-btn"
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loadingInitial && books.length > 0 && (
        <div className="pagination">
          <span>
            Loaded {books.length} of {totalBooks} books
          </span>

          <div className="page-controls">
            {loadingMore ? (
              <span>Loading more...</span>
            ) : hasMore ? (
              <span>Scroll for more</span>
            ) : (
              <span>All books loaded</span>
            )}
          </div>
        </div>
      )}

      <div
        ref={loadMoreTriggerRef}
        style={{ height: "1px", width: "100%" }}
      />

      <ScrapeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddBook={handleAddBook}
      />
    </div>
  );
}