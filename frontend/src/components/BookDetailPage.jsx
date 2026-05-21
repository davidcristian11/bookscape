import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

function DetailLoading() {
  return (
    <div className="library-container">
      <div className="loading-state" role="status">
        <p>Loading book...</p>
        <div className="skeleton-stack" aria-hidden="true">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
    </div>
  );
}

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
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
  const [saveNotice, setSaveNotice] = useState("");
  const [quoteNotice, setQuoteNotice] = useState("");

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

  const {
    isOfflineMode,
    offlineQueueCount,
    isSyncingQueue,
    connectionMessage,
    queueText,
  } = useBooksOfflineSync(refreshAll);

  const { isRealtimeConnected } = useBooksRealtime(
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
    setSaveNotice("");
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuoteChange = (event) => {
    const { name, value } = event.target;
    setQuoteNotice("");
    setQuoteForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const nextErrors = validateBook(form);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      setSaving(true);
      setError("");
      setSaveNotice("");
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
      setSaveNotice("Changes saved.");
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
    setQuoteNotice("");
  };

  const handleQuoteSubmit = async () => {
    if (!quoteForm.quote.trim()) {
      setQuoteError("Quote text is required.");
      return;
    }

    try {
      setQuoteSaving(true);
      setQuoteError("");
      setQuoteNotice("");
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
      setQuoteNotice(editingQuoteId ? "Quote updated." : "Quote card created.");
    } catch (err) {
      setQuoteError(err.message || "Failed to save quote card.");
    } finally {
      setQuoteSaving(false);
    }
  };

  const handleEditQuote = (quote) => {
    setEditingQuoteId(quote.id);
    setQuoteNotice("");
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

  if (loading) return <DetailLoading />;
  if (error && !book) {
    return (
      <div className="library-container">
        <Link to="/library" className="back-link">Back to Library</Link>
        <p className="error-text">{error}</p>
      </div>
    );
  }
  if (!book) return <div className="library-container"><h2>Book not found.</h2></div>;

  const realtimeNeedsAttention = navigator.onLine && !isRealtimeConnected;
  const authSyncRequired = (connectionMessage || "").includes("server session expired");
  const showConnectionBanner =
    !navigator.onLine ||
    isOfflineMode ||
    offlineQueueCount > 0 ||
    isSyncingQueue ||
    authSyncRequired ||
    realtimeNeedsAttention ||
    ["Server unreachable", "Syncing...", "Sync failed", "Synced successfully"].includes(connectionMessage);
  const cardMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <div className="library-container detail-page">
      <Link to="/library" className="back-link">Back to Library</Link>

      <AnimatePresence>
        {showConnectionBanner && (
          <motion.div
            className={`review-card connection-banner detail-connection-banner ${isSyncingQueue ? "syncing" : ""}`}
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
              {isSyncingQueue
                ? "Queued changes are being synchronized."
                : authSyncRequired
                  ? "Your offline queue is preserved. Re-authenticate to sync queued changes."
                  : !navigator.onLine || isOfflineMode
                    ? "Book edits and quote cards will sync when BookScape reconnects."
                    : realtimeNeedsAttention
                      ? "Live updates are reconnecting in the background."
                      : "Your queued changes are now reflected here."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="detail-cards-layout">
        <motion.section
          className="book-info-card detail-summary-card"
          {...cardMotion}
          transition={{ duration: 0.24 }}
        >
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title} className="detail-cover-large" />
          ) : (
            <div className="detail-cover-large" aria-hidden="true" />
          )}
          <div className="detail-text-content">
            <span className="section-kicker">Book details</span>
            <h1>{book.title}</h1>
            <p className="detail-author">
              by {book.author}
              {book._offline && <span className="pending-chip">pending sync</span>}
            </p>
            <div className="detail-meta">
              <span className="meta-pill">Publication Year: {book.publication_year}</span>
              <span className="genre-badge">{book.genre}</span>
              <span className="meta-pill">Source: {book.source}</span>
              <span className="meta-pill">Rating: {"*".repeat(book.rating)}{"-".repeat(5 - book.rating)}</span>
            </div>
            <div className="synopsis-section">
              <h4>Synopsis</h4>
              <p>{book.synopsis || "No synopsis yet."}</p>
              <h4>Your Review</h4>
              <p>{book.review || "No review yet."}</p>
            </div>
          </div>
        </motion.section>

        <motion.section className="review-card" {...cardMotion} transition={{ duration: 0.24, delay: 0.04 }}>
          <h3>Edit Book</h3>
          <div className="detail-form-grid">
            <label className="field-group">
              <span className="field-label">Title</span>
              <input name="title" placeholder="Title" value={form.title} onChange={handleChange} aria-invalid={Boolean(formErrors.title)} />
            </label>
            {formErrors.title && <p className="error-text full-span">{formErrors.title}</p>}
            <label className="field-group">
              <span className="field-label">Author</span>
              <input name="author" placeholder="Author" value={form.author} onChange={handleChange} aria-invalid={Boolean(formErrors.author)} />
            </label>
            <label className="field-group">
              <span className="field-label">Genre</span>
              <input name="genre" placeholder="Genre" value={form.genre} onChange={handleChange} aria-invalid={Boolean(formErrors.genre)} />
            </label>
            <label className="field-group">
              <span className="field-label">Publication year</span>
              <input name="publication_year" type="number" placeholder="Publication year" value={form.publication_year} onChange={handleChange} aria-invalid={Boolean(formErrors.publication_year)} />
            </label>
            <label className="field-group">
              <span className="field-label">Source</span>
              <input name="source" placeholder="Source" value={form.source} onChange={handleChange} />
            </label>
            {formErrors.publication_year && <p className="error-text full-span">{formErrors.publication_year}</p>}
            <label className="field-group full-span">
              <span className="field-label">Source URL</span>
              <input name="source_url" placeholder="Source URL" value={form.source_url} onChange={handleChange} aria-invalid={Boolean(formErrors.source_url)} />
            </label>
            {formErrors.source_url && <p className="error-text full-span">{formErrors.source_url}</p>}
            <label className="field-group full-span">
              <span className="field-label">Synopsis</span>
              <textarea name="synopsis" className="review-textarea" placeholder="Synopsis" value={form.synopsis} onChange={handleChange} />
            </label>
            <label className="field-group full-span">
              <span className="field-label">Your review</span>
              <textarea name="review" className="review-textarea" placeholder="Your review" value={form.review} onChange={handleChange} />
            </label>
            <label className="field-group">
              <span className="field-label">Rating</span>
              <input name="rating" type="number" min="0" max="5" value={form.rating} onChange={handleChange} aria-invalid={Boolean(formErrors.rating)} />
            </label>
            <label className="field-group">
              <span className="field-label">Cover URL</span>
              <input name="cover_url" placeholder="Cover URL" value={form.cover_url} onChange={handleChange} aria-invalid={Boolean(formErrors.cover_url)} />
            </label>
            {formErrors.rating && <p className="error-text full-span">{formErrors.rating}</p>}
            {formErrors.cover_url && <p className="error-text full-span">{formErrors.cover_url}</p>}
            {error && <p className="error-text full-span">{error}</p>}
          </div>
          <div className="review-actions">
            <button onClick={handleDelete} className="text-delete-btn" type="button">Delete Book</button>
            <div className="review-actions" style={{ marginTop: 0 }}>
              <AnimatePresence>
                {saveNotice && (
                  <motion.span
                    className="save-state"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {saveNotice}
                  </motion.span>
                )}
              </AnimatePresence>
              <button onClick={handleSave} className="scrape-submit-btn" disabled={saving} type="button">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </motion.section>

        <motion.section className="review-card" {...cardMotion} transition={{ duration: 0.24, delay: 0.08 }}>
          <h3>{editingQuoteId ? "Edit Quote Card" : "Add Quote Card"}</h3>
          <div className="detail-form-grid">
            <label className="field-group full-span">
              <span className="field-label">Quote text</span>
              <textarea name="quote" className="review-textarea" placeholder="Quote text" value={quoteForm.quote} onChange={handleQuoteChange} />
            </label>
            <label className="field-group">
              <span className="field-label">Optional note</span>
              <input name="note" placeholder="Optional note" value={quoteForm.note} onChange={handleQuoteChange} />
            </label>
            <label className="field-group">
              <span className="field-label">Relationship label</span>
              <input name="relationship_label" placeholder="Relationship label" value={quoteForm.relationship_label} onChange={handleQuoteChange} />
            </label>
            {quoteError && <p className="error-text full-span">{quoteError}</p>}
          </div>
          <div className="review-actions">
            <button onClick={resetQuoteForm} className="cancel-btn" disabled={quoteSaving} type="button">Clear</button>
            <div className="review-actions" style={{ marginTop: 0 }}>
              <AnimatePresence>
                {quoteNotice && (
                  <motion.span className="save-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    {quoteNotice}
                  </motion.span>
                )}
              </AnimatePresence>
              <button onClick={handleQuoteSubmit} className="scrape-submit-btn" disabled={quoteSaving} type="button">
                {quoteSaving ? "Saving..." : editingQuoteId ? "Update Quote" : "Create Quote"}
              </button>
            </div>
          </div>
        </motion.section>

        <motion.section className="review-card detail-summary-card" {...cardMotion} transition={{ duration: 0.24, delay: 0.12 }}>
          <h3>Quote Cards</h3>
          {quotesLoading ? <p>Loading quote cards...</p> : quotes.length === 0 ? (
            <p className="author-text">No quote cards yet for this book.</p>
          ) : (
            <div className="quote-card-list">
              {quotes.map((quote) => (
                <motion.article
                  key={quote.id}
                  className="detail-quote-card"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <blockquote>&quot;{quote.quote}&quot;</blockquote>
                  <div className="quote-card-badges">
                    {quote.note && <span className="genre-badge">Note: {quote.note}</span>}
                    {quote.relationship_label && <span className="genre-badge">Link: {quote.relationship_label}</span>}
                  </div>
                  <div className="quote-card-actions">
                    <button className="cancel-btn" onClick={() => handleEditQuote(quote)} type="button">Edit</button>
                    <button className="text-delete-btn" onClick={() => handleDeleteQuote(quote.id)} type="button">Delete</button>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
