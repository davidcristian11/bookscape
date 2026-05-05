import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ScrapeModal from "./ScrapeModal";
import { deleteBook, createBook } from "../api/booksApi";
import { getFakerLoopStatus, startFakerLoop, stopFakerLoop } from "../api/automationApi";
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
  return "*".repeat(rating) + "-".repeat(5 - rating);
}

export default function LibraryPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState(
    getCookie("bookscape_view_mode") || getCookie("libraryViewPreference") || "list"
  );

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
    connectionMessage,
    queueText,
  } = useBooksOfflineSync(refreshFromStart);

  const { isRealtimeConnected, realtimeMessage } = useBooksRealtime(
    useCallback(
      (event) => {
        if (
          event.type === "book_created" ||
          event.type === "book_updated" ||
          event.type === "book_deleted" ||
          event.type === "ws_reconnected"
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
    getFakerLoopStatus()
      .then((status) => setIsFakerRunning(status.running))
      .catch(() => setIsFakerRunning(false));
  }, []);

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
    setCookie("bookscape_view_mode", mode, 30);
    setCookie("bookscape_page_size", mode === "grid" ? "6" : "3", 30);
  };

  const handleDeleteBook = async (id) => {
    if (!window.confirm("Delete this book and its quote cards?")) {
      return;
    }

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

  const handleToggleFakerLoop = async () => {
    try {
      setAutomationLoading(true);
      if (isFakerRunning) {
        await stopFakerLoop();
        setIsFakerRunning(false);
      } else {
        await startFakerLoop(2);
        setIsFakerRunning(true);
      }
    } catch (err) {
      alert(err.message || "Failed to update faker loop.");
    } finally {
      setAutomationLoading(false);
    }
  };

  const showEmptyState = !loadingInitial && !error && books.length === 0;
  const realtimeNeedsAttention = navigator.onLine && !isRealtimeConnected;
  const messageNeedsAttention = [
    "Offline mode active",
    "Server unreachable",
    "Syncing...",
    "Sync failed",
    "Synced successfully",
  ].includes(connectionMessage) || (connectionMessage || "").includes("server session expired");
  const showConnectionBanner =
    !navigator.onLine ||
    isOfflineMode ||
    offlineQueueCount > 0 ||
    isSyncingQueue ||
    messageNeedsAttention ||
    realtimeNeedsAttention;
  const fakerButtonLabel = automationLoading
    ? "Working..."
    : isFakerRunning
      ? "Stop Faker Loop"
      : "Start Faker Loop";

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
            className={`scrape-btn faker-toggle-btn ${isFakerRunning ? "danger" : ""}`}
            onClick={handleToggleFakerLoop}
            disabled={automationLoading}
          >
            {fakerButtonLabel}
          </button>

          <button
            className="scrape-btn"
            onClick={() => setIsModalOpen(true)}
          >
            + Add New Book
          </button>
        </div>
      </header>

      {showConnectionBanner && (
        <div
          className={`review-card connection-banner ${isSyncingQueue ? "syncing" : ""}`}
          role="status"
        >
          <h3 style={{ marginBottom: "0.75rem" }}>
            {!navigator.onLine
              ? "Offline mode active"
              : realtimeNeedsAttention
                ? "Realtime updates disconnected, retrying..."
                : offlineQueueCount > 0
                  ? queueText || `${offlineQueueCount} changes queued`
                  : connectionMessage}
          </h3>

          <p style={{ margin: 0, color: "var(--text-gray)" }}>
            {!navigator.onLine || isOfflineMode
              ? "CRUD actions are stored locally and will sync when the connection comes back."
              : realtimeNeedsAttention
                ? realtimeMessage || "Live updates are reconnecting in the background."
                : connectionMessage.includes("server session expired")
                  ? "Your offline queue is preserved. Log in or register again when ready, then BookScape will retry syncing."
                : connectionMessage === "Synced successfully"
                  ? "Your queued changes are now reflected in the library."
                : isSyncingQueue
                  ? "The app is online again and queued changes are being synchronized."
                  : "Queued changes will sync automatically when the server is reachable."}
          </p>

          {(queueText || offlineQueueCount > 0) && (
            <p style={{ margin: "0.75rem 0 0 0", fontWeight: "bold" }}>
              {queueText || `Queued operations: ${offlineQueueCount}`}
            </p>
          )}
        </div>
      )}

      {loadingInitial && <p>Loading books...</p>}
      {error && <p className="error-text">{error}</p>}

      {showEmptyState && (
        <div className="review-card">
          <h3>Your library is empty</h3>
          <p style={{ marginBottom: "1.5rem", color: "var(--text-gray)" }}>
            Start the backend Faker loop to watch live books arrive, or add and scrape one manually.
          </p>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button
              className="scrape-submit-btn"
              onClick={handleToggleFakerLoop}
              disabled={automationLoading}
            >
              {fakerButtonLabel}
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
                <th>Source</th>
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
                      {book._offline ? " - pending sync" : ""}
                    </p>
                  </td>

                  <td>
                    <span className="genre-badge">{book.genre}</span>
                  </td>

                  <td className="rating-stars">{renderStars(book.rating)}</td>

                  <td className="source-text">{book.source}</td>

                  <td className="actions-cell">
                    <Link
                      to={`/book/${book.id}`}
                      className="action-icon"
                      title="View details"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDeleteBook(book.id)}
                      className="action-icon delete"
                      title="Delete book"
                    >
                      Delete
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
                  {book._offline ? " - pending sync" : ""}
                </p>
                <p className="author-text">
                  {book.genre} - {book.source}
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
        onBookCreated={refreshFromStart}
      />
    </div>
  );
}


