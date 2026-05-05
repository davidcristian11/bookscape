import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteBook, getBookById, updateBook } from "../api/booksApi";
import { createQuote, deleteQuote, getQuotesByBook, updateQuote } from "../api/quotesApi";
import useBooksOfflineSync from "../hooks/useBooksOfflineSync";
import useBooksRealtime from "../hooks/useBooksRealtime";
import "./Library.css";

const currentYear = new Date().getFullYear();
const initialQuoteForm = { quote: "", note: "", relationship_label: "" };

function validateBook(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.author.trim()) errors.author = "Author is required.";
  if (!form.genre.trim()) errors.genre = "Genre is required.";
  const year = Number(form.publication_year);
  if (Number.isNaN(year) || year < 0 || year > currentYear) {
    errors.publication_year = `Publication year must be between 0 and ${currentYear}.`;
  }
  const rating = Number(form.rating);
  if (Number.isNaN(rating) || rating < 0 || rating > 5) {
    errors.rating = "Rating must be between 0 and 5.";
  }
  for (const key of ["source_url", "cover_url"]) {
    if (form[key].trim() && !/^https?:\/\/.+/i.test(form[key].trim())) {
      errors[key] = "URL must start with http:// or https://";
    }
  }
  return errors;
}

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [form, setForm] = useState({
    title: "",
    author: "",
    genre: "",
    publication_year: "",
    source: "Manual",
    source_url: "",
    synopsis: "",
    review: "",
    rating: 0,
    cover_url: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [quoteForm, setQuoteForm] = useState(initialQuoteForm);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [error, setError] = useState("");
  const [quoteError, setQuoteError] = useState("");

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
        publication_year: data.publication_year,
        source: data.source || "Manual",
        source_url: data.source_url || "",
        synopsis: data.synopsis || "",
        review: data.review || "",
        rating: data.rating,
        cover_url: data.cover_url || "",
      });
    } catch (err) {
      setError(err.message || "Failed to load book.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadQuotes = useCallback(async () => {
    try {
      setQuotesLoading(true);
      setQuoteError("");
      setQuotes(await getQuotesByBook(id));
    } catch (err) {
      setQuoteError(err.message || "Failed to load quote cards.");
    } finally {
      setQuotesLoading(false);
    }
  }, [id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadBook(), loadQuotes()]);
  }, [loadBook, loadQuotes]);

  const { isOfflineMode, offlineQueueCount, isSyncingQueue, connectionMessage, queueText } = useBooksOfflineSync(refreshAll);
  const { isRealtimeConnected, realtimeMessage } = useBooksRealtime(
    useCallback(
      (event) => {
        if (event.type === "book_updated" && event.book?.id === id) loadBook();
        if (event.type === "book_deleted" && event.book_id === id) navigate("/library");
        if (event.type === "ws_reconnected") refreshAll();
      },
      [id, loadBook, navigate, refreshAll]
    )
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuoteChange = (event) => {
    const { name, value } = event.target;
    setQuoteForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const nextErrors = validateBook(form);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSaving(true);
      setError("");
      const updated = await updateBook(id, {
        title: form.title.trim(),
        author: form.author.trim(),
        genre: form.genre.trim(),
        publication_year: Number(form.publication_year),
        source: form.source.trim() || "Manual",
        source_url: form.source_url.trim() || null,
        synopsis: form.synopsis.trim(),
        review: form.review.trim(),
        rating: Number(form.rating),
        cover_url: form.cover_url.trim() || null,
      });
      setBook(updated);
    } catch (err) {
      setError(err.message || "Failed to update book.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this book and its quote cards?")) return;
    await deleteBook(id);
    navigate("/library");
  };

  const resetQuoteForm = () => {
    setQuoteForm(initialQuoteForm);
    setEditingQuoteId(null);
  };

  const handleQuoteSubmit = async () => {
    if (!quoteForm.quote.trim()) {
      setQuoteError("Quote text is required.");
      return;
    }

    try {
      setQuoteSaving(true);
      setQuoteError("");
      const payload = {
        quote: quoteForm.quote.trim(),
        note: quoteForm.note.trim() || null,
        relationship_label: quoteForm.relationship_label.trim() || null,
      };
      if (editingQuoteId) {
        await updateQuote(editingQuoteId, payload);
      } else {
        await createQuote(id, payload);
      }
      await loadQuotes();
      resetQuoteForm();
    } catch (err) {
      setQuoteError(err.message || "Failed to save quote card.");
    } finally {
      setQuoteSaving(false);
    }
  };

  const handleEditQuote = (quote) => {
    setEditingQuoteId(quote.id);
    setQuoteForm({
      quote: quote.quote,
      note: quote.note || "",
      relationship_label: quote.relationship_label || "",
    });
  };

  const handleDeleteQuote = async (quoteId) => {
    if (!window.confirm("Delete this quote card?")) return;
    await deleteQuote(quoteId);
    await loadQuotes();
    if (editingQuoteId === quoteId) resetQuoteForm();
  };

  if (loading) return <div className="library-container"><p>Loading book...</p></div>;
  if (error && !book) {
    return (
      <div className="library-container">
        <Link to="/library" className="back-link">Back to Library</Link>
        <p className="error-text">{error}</p>
      </div>
    );
  }
  if (!book) return <div className="library-container"><h2>Book not found.</h2></div>;

  return (
    <div className="library-container detail-page">
      <Link to="/library" className="back-link">Back to Library</Link>

      <div className="review-card" style={{ marginBottom: "1.5rem" }}>
        <strong>{!navigator.onLine ? "Offline mode active" : connectionMessage}</strong>
        <p className="author-text">
          {navigator.onLine && isRealtimeConnected
            ? realtimeMessage
            : "Realtime updates disconnected, retrying..."}
        </p>
        {(isOfflineMode || offlineQueueCount > 0 || isSyncingQueue) && (
          <p className="author-text">
            {isSyncingQueue ? "Syncing..." : queueText || "Offline changes are queued"}
          </p>
        )}
      </div>

      <div className="detail-cards-layout">
        <div className="book-info-card">
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title} className="detail-cover-large" />
          ) : (
            <div className="detail-cover-large"></div>
          )}
          <div className="detail-text-content">
            <h1>{book.title}</h1>
            <p className="detail-author">by {book.author}{book._offline ? " - pending sync" : ""}</p>
            <div className="detail-meta">
              <span>Publication Year: {book.publication_year}</span>
              <span className="genre-badge">{book.genre}</span>
              <span>Source: {book.source}</span>
              <span>Rating: {"*".repeat(book.rating)}{"-".repeat(5 - book.rating)}</span>
            </div>
            <div className="synopsis-section">
              <h4>Synopsis</h4>
              <p>{book.synopsis || "No synopsis yet."}</p>
              <h4>Your Review</h4>
              <p>{book.review || "No review yet."}</p>
            </div>
          </div>
        </div>

        <div className="review-card">
          <h3>Edit Book</h3>
          <div className="modal-body">
            <input name="title" placeholder="Title" value={form.title} onChange={handleChange} />
            {formErrors.title && <p className="error-text">{formErrors.title}</p>}
            <input name="author" placeholder="Author" value={form.author} onChange={handleChange} />
            <input name="genre" placeholder="Genre" value={form.genre} onChange={handleChange} />
            <input name="publication_year" type="number" placeholder="Publication year" value={form.publication_year} onChange={handleChange} />
            {formErrors.publication_year && <p className="error-text">{formErrors.publication_year}</p>}
            <input name="source" placeholder="Source" value={form.source} onChange={handleChange} />
            <input name="source_url" placeholder="Source URL" value={form.source_url} onChange={handleChange} />
            {formErrors.source_url && <p className="error-text">{formErrors.source_url}</p>}
            <textarea name="synopsis" className="review-textarea" placeholder="Synopsis" value={form.synopsis} onChange={handleChange} />
            <textarea name="review" className="review-textarea" placeholder="Your review" value={form.review} onChange={handleChange} />
            <input name="rating" type="number" min="0" max="5" value={form.rating} onChange={handleChange} />
            {formErrors.rating && <p className="error-text">{formErrors.rating}</p>}
            <input name="cover_url" placeholder="Cover URL" value={form.cover_url} onChange={handleChange} />
            {formErrors.cover_url && <p className="error-text">{formErrors.cover_url}</p>}
            {error && <p className="error-text">{error}</p>}
          </div>
          <div className="review-actions">
            <button onClick={handleDelete} className="text-delete-btn">Delete Book</button>
            <button onClick={handleSave} className="scrape-submit-btn" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="review-card">
          <h3>{editingQuoteId ? "Edit Quote Card" : "Add Quote Card"}</h3>
          <div className="modal-body">
            <textarea name="quote" className="review-textarea" placeholder="Quote text" value={quoteForm.quote} onChange={handleQuoteChange} />
            <input name="note" placeholder="Optional note" value={quoteForm.note} onChange={handleQuoteChange} />
            <input name="relationship_label" placeholder="Relationship label" value={quoteForm.relationship_label} onChange={handleQuoteChange} />
            {quoteError && <p className="error-text">{quoteError}</p>}
          </div>
          <div className="review-actions">
            <button onClick={resetQuoteForm} className="cancel-btn" disabled={quoteSaving}>Clear</button>
            <button onClick={handleQuoteSubmit} className="scrape-submit-btn" disabled={quoteSaving}>
              {quoteSaving ? "Saving..." : editingQuoteId ? "Update Quote" : "Create Quote"}
            </button>
          </div>
        </div>

        <div className="review-card">
          <h3>Quote Cards</h3>
          {quotesLoading ? <p>Loading quote cards...</p> : quotes.length === 0 ? (
            <p className="author-text">No quote cards yet for this book.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {quotes.map((quote) => (
                <div key={quote.id} style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "1rem", background: "#fafafa" }}>
                  <p style={{ margin: "0 0 0.75rem 0", lineHeight: 1.6 }}>"{quote.quote}"</p>
                  {quote.note && <span className="genre-badge">Note: {quote.note}</span>}
                  {quote.relationship_label && <span className="genre-badge">Link: {quote.relationship_label}</span>}
                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                    <button className="cancel-btn" onClick={() => handleEditQuote(quote)}>Edit</button>
                    <button className="text-delete-btn" onClick={() => handleDeleteQuote(quote.id)}>Delete</button>
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
