import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getBookById, deleteBook, updateBook } from "../api/booksApi";
import {
  createQuote,
  deleteQuote,
  getQuotesByBook,
  updateQuote,
} from "../api/quotesApi";
import useBooksOfflineSync from "../hooks/useBooksOfflineSync";
import useBooksRealtime from "../hooks/useBooksRealtime";
import "./Library.css";

const initialQuoteForm = {
  text: "",
  note: "",
  tag: "",
};

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [form, setForm] = useState({
    title: "",
    author: "",
    genre: "",
    year: "",
    status: "to-read",
    rating: 0,
    cover_url: "",
  });
  const [quoteForm, setQuoteForm] = useState(initialQuoteForm);
  const [editingQuoteId, setEditingQuoteId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");

  const loadQuotes = useCallback(async () => {
    try {
      setQuotesLoading(true);
      setQuoteError("");

      const data = await getQuotesByBook(id);
      setQuotes(data);
    } catch (err) {
      setQuoteError(err.message || "Failed to load quotes.");
    } finally {
      setQuotesLoading(false);
    }
  }, [id]);

  const loadBook = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getBookById(id);

      setBook(data);
      setForm({
        title: data.title,
        author: data.author,
        genre: data.genre,
        year: data.year,
        status: data.status,
        rating: data.rating,
        cover_url: data.cover_url || "",
      });
    } catch (err) {
      setError(err.message || "Failed to load book.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadBook(), loadQuotes()]);
  }, [loadBook, loadQuotes]);

  const {
    isOfflineMode,
    offlineQueueCount,
    isSyncingQueue,
  } = useBooksOfflineSync(refreshAll);

  const { isRealtimeConnected } = useBooksRealtime(
    useCallback(
      (event) => {
        if (event.type === "book_updated" && event.book?.id === id) {
          loadBook();
        }

        if (event.type === "book_deleted" && event.book_id === id) {
          navigate("/library");
        }
      },
      [id, loadBook, navigate]
    )
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleQuoteChange = (event) => {
    const { name, value } = event.target;
    setQuoteForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this book?"
    );

    if (!confirmed) return;

    try {
      await deleteBook(id);
      navigate("/library");
    } catch (err) {
      alert(err.message || "Failed to delete book.");
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");

      const payload = {
        title: form.title.trim(),
        author: form.author.trim(),
        genre: form.genre.trim(),
        year: Number(form.year),
        status: form.status,
        rating: Number(form.rating),
        cover_url: form.cover_url.trim() || null,
      };

      const updated = await updateBook(id, payload);

      setBook(updated);
      setForm({
        title: updated.title,
        author: updated.author,
        genre: updated.genre,
        year: updated.year,
        status: updated.status,
        rating: updated.rating,
        cover_url: updated.cover_url || "",
      });

      alert(
        updated._offline
          ? "Book updated locally. It will sync when the connection returns."
          : "Book updated successfully!"
      );
    } catch (err) {
      setError(err.message || "Failed to update book.");
    } finally {
      setSaving(false);
    }
  };

  const resetQuoteForm = () => {
    setQuoteForm(initialQuoteForm);
    setEditingQuoteId(null);
  };

  const handleQuoteSubmit = async () => {
    try {
      setQuoteSaving(true);
      setQuoteError("");

      const payload = {
        text: quoteForm.text.trim(),
        note: quoteForm.note.trim() || null,
        tag: quoteForm.tag.trim() || null,
      };

      if (editingQuoteId) {
        await updateQuote(editingQuoteId, payload);
      } else {
        await createQuote(id, payload);
      }

      await loadQuotes();
      resetQuoteForm();
    } catch (err) {
      setQuoteError(err.message || "Failed to save quote.");
    } finally {
      setQuoteSaving(false);
    }
  };

  const handleEditQuote = (quote) => {
    setEditingQuoteId(quote.id);
    setQuoteForm({
      text: quote.text,
      note: quote.note || "",
      tag: quote.tag || "",
    });
  };

  const handleDeleteQuote = async (quoteId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this quote?"
    );

    if (!confirmed) return;

    try {
      await deleteQuote(quoteId);
      await loadQuotes();

      if (editingQuoteId === quoteId) {
        resetQuoteForm();
      }
    } catch (err) {
      setQuoteError(err.message || "Failed to delete quote.");
    }
  };

  if (loading) {
    return (
      <div className="library-container">
        <p>Loading book...</p>
      </div>
    );
  }

  if (error && !book) {
    return (
      <div className="library-container">
        <Link to="/library" className="back-link">
          ← Back to Library
        </Link>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="library-container">
        <h2>Book not found.</h2>
      </div>
    );
  }

  return (
    <div className="library-container detail-page">
      <Link to="/library" className="back-link">
        ← Back to Library
      </Link>

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
              ? "Book editing supports offline mode. Quote CRUD stays online-only for now."
              : "The app is online again and queued changes are being synchronized."}
          </p>

          <p style={{ margin: "0.75rem 0 0 0", fontWeight: "bold" }}>
            Queued operations: {offlineQueueCount}
          </p>
        </div>
      )}

      <div className="detail-cards-layout">
        <div className="book-info-card">
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="detail-cover-large"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className="detail-cover-large"></div>
          )}

          <div className="detail-text-content">
            <h1>{book.title}</h1>
            <p className="detail-author">
              by {book.author}
              {book._offline ? " • pending sync" : ""}
            </p>

            <div className="detail-meta">
              <span>Publication Year: {book.year}</span>
              <span className="genre-badge">{book.genre}</span>
              <span>Status: {book.status}</span>
              <span>
                Rating: {"★".repeat(book.rating)}
                {"☆".repeat(5 - book.rating)}
              </span>
            </div>

            <div className="synopsis-section">
              <h4>Book Information</h4>
              <p>
                This page now also supports QuoteCards. One book can have many
                quote cards, each with text, optional note, and optional tag.
              </p>
            </div>
          </div>
        </div>

        <div className="review-card">
          <h3>Edit Book</h3>

          <div className="modal-body">
            <input
              name="title"
              placeholder="Title"
              value={form.title}
              onChange={handleChange}
            />

            <input
              name="author"
              placeholder="Author"
              value={form.author}
              onChange={handleChange}
            />

            <input
              name="genre"
              placeholder="Genre"
              value={form.genre}
              onChange={handleChange}
            />

            <input
              name="year"
              type="number"
              placeholder="Year"
              value={form.year}
              onChange={handleChange}
            />

            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              style={{
                padding: "0.8rem",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                fontSize: "1rem",
              }}
            >
              <option value="to-read">to-read</option>
              <option value="reading">reading</option>
              <option value="finished">finished</option>
            </select>

            <input
              name="rating"
              type="number"
              min="0"
              max="5"
              placeholder="Rating"
              value={form.rating}
              onChange={handleChange}
            />

            <input
              name="cover_url"
              placeholder="Cover URL (optional)"
              value={form.cover_url}
              onChange={handleChange}
            />

            {error && <p className="error-text">{error}</p>}
          </div>

          <div className="review-actions">
            <button onClick={handleDelete} className="text-delete-btn">
              Delete Book
            </button>

            <button
              onClick={handleSave}
              className="scrape-submit-btn"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="review-card">
          <h3>{editingQuoteId ? "Edit Quote Card" : "Add Quote Card"}</h3>

          <div className="modal-body">
            <textarea
              name="text"
              className="review-textarea"
              placeholder="Quote text"
              value={quoteForm.text}
              onChange={handleQuoteChange}
            />
            <input
              name="note"
              placeholder="Optional note"
              value={quoteForm.note}
              onChange={handleQuoteChange}
            />
            <input
              name="tag"
              placeholder="Optional tag"
              value={quoteForm.tag}
              onChange={handleQuoteChange}
            />

            {quoteError && <p className="error-text">{quoteError}</p>}
          </div>

          <div className="review-actions">
            <button
              onClick={resetQuoteForm}
              className="cancel-btn"
              disabled={quoteSaving}
            >
              Clear
            </button>

            <button
              onClick={handleQuoteSubmit}
              className="scrape-submit-btn"
              disabled={quoteSaving}
            >
              {quoteSaving
                ? "Saving..."
                : editingQuoteId
                ? "Update Quote"
                : "Create Quote"}
            </button>
          </div>
        </div>

        <div className="review-card">
          <h3>Quote Cards for this Book</h3>

          {quotesLoading ? (
            <p>Loading quotes...</p>
          ) : quotes.length === 0 ? (
            <p style={{ color: "var(--text-gray)" }}>
              No quote cards yet for this book.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "1rem",
                    background: "#fafafa",
                  }}
                >
                  <p style={{ margin: "0 0 0.75rem 0", lineHeight: 1.6 }}>
                    “{quote.text}”
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {quote.note && (
                      <span className="genre-badge">Note: {quote.note}</span>
                    )}
                    {quote.tag && (
                      <span className="genre-badge">Tag: {quote.tag}</span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button
                      className="cancel-btn"
                      onClick={() => handleEditQuote(quote)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-delete-btn"
                      onClick={() => handleDeleteQuote(quote.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}