import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { scrapeBook } from "../api/booksApi";
import "./Library.css";

const currentYear = new Date().getFullYear();

const initialForm = {
  scrapeUrl: "",
  title: "",
  author: "",
  genre: "",
  publication_year: currentYear,
  source: "Manual",
  source_url: "",
  synopsis: "",
  review: "",
  rating: 0,
  cover_url: "",
};

function validateUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ScrapeModal({ isOpen, onClose, onAddBook, onBookCreated }) {
  const shouldReduceMotion = useReducedMotion();
  const [mode, setMode] = useState("scrape");
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode("scrape");
      setForm(initialForm);
      setErrors({});
      setSubmitError("");
      setSuccessMessage("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const validateManualBook = () => {
    const nextErrors = {};
    const yearNumber = Number(form.publication_year);
    const ratingNumber = Number(form.rating);

    if (!form.title.trim()) nextErrors.title = "Title is required.";
    if (!form.author.trim()) nextErrors.author = "Author is required.";
    if (!form.genre.trim()) nextErrors.genre = "Genre is required.";
    if (!yearNumber || yearNumber < 0 || yearNumber > currentYear) {
      nextErrors.publication_year = `Publication year must be between 0 and ${currentYear}.`;
    }
    if (Number.isNaN(ratingNumber) || ratingNumber < 0 || ratingNumber > 5) {
      nextErrors.rating = "Rating must be between 0 and 5.";
    }
    for (const key of ["source_url", "cover_url"]) {
      if (form[key].trim() && !/^https?:\/\/.+/i.test(form[key].trim())) {
        nextErrors[key] = "URL must start with http:// or https://";
      }
    }

    return nextErrors;
  };

  const validateScrape = () => {
    if (!validateUrl(form.scrapeUrl.trim())) {
      return {
        scrapeUrl: "Enter a valid http or https book page URL.",
      };
    }
    return {};
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = mode === "scrape" ? validateScrape() : validateManualBook();
    setErrors(nextErrors);
    setSubmitError("");
    setSuccessMessage("");

    if (Object.keys(nextErrors).length > 0) return;

    try {
      setIsSubmitting(true);

      if (mode === "scrape") {
        await scrapeBook(form.scrapeUrl.trim());
      } else {
        await onAddBook({
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
      }

      if (typeof onBookCreated === "function") {
        await onBookCreated();
      }

      setSuccessMessage(
        mode === "scrape"
          ? "Book metadata captured and added to your library."
          : "Book added to your library."
      );
      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to create book.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scrape-modal-title"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="modal-header">
              <div>
                <span className="section-kicker">Add to shelf</span>
                <h2 id="scrape-modal-title">
                  {mode === "scrape" ? "Scrape Book Data" : "Add Book Manually"}
                </h2>
              </div>
              <button className="close-btn" onClick={onClose} type="button" aria-label="Close modal">
                &times;
              </button>
            </div>

            <div className="view-toggle modal-mode-toggle">
              <button
                type="button"
                className={`toggle-btn ${mode === "scrape" ? "active" : ""}`}
                onClick={() => setMode("scrape")}
                aria-pressed={mode === "scrape"}
              >
                Scrape URL
              </button>
              <button
                type="button"
                className={`toggle-btn ${mode === "manual" ? "active" : ""}`}
                onClick={() => setMode("manual")}
                aria-pressed={mode === "manual"}
              >
                Manual
              </button>
            </div>

            <form className="scrape-form" onSubmit={handleSubmit}>
              <div className="modal-body">
                {mode === "scrape" ? (
                  <>
                    <p className="scrape-intro">
                      Supported sources: Goodreads, Amazon, Barnes & Noble, Open Library.
                    </p>
                    <input
                      name="scrapeUrl"
                      placeholder="https://www.goodreads.com/book/show/..."
                      value={form.scrapeUrl}
                      onChange={handleChange}
                      className={errors.scrapeUrl ? "input-error" : ""}
                      aria-invalid={Boolean(errors.scrapeUrl)}
                    />
                    {errors.scrapeUrl && <p className="error-text">{errors.scrapeUrl}</p>}
                  </>
                ) : (
                  <>
                    <input name="title" placeholder="Title" value={form.title} onChange={handleChange} aria-invalid={Boolean(errors.title)} />
                    {errors.title && <p className="error-text">{errors.title}</p>}
                    <input name="author" placeholder="Author" value={form.author} onChange={handleChange} aria-invalid={Boolean(errors.author)} />
                    {errors.author && <p className="error-text">{errors.author}</p>}
                    <input name="genre" placeholder="Genre" value={form.genre} onChange={handleChange} aria-invalid={Boolean(errors.genre)} />
                    {errors.genre && <p className="error-text">{errors.genre}</p>}
                    <input
                      name="publication_year"
                      type="number"
                      placeholder="Publication year"
                      value={form.publication_year}
                      onChange={handleChange}
                      aria-invalid={Boolean(errors.publication_year)}
                    />
                    {errors.publication_year && <p className="error-text">{errors.publication_year}</p>}
                    <input name="source" placeholder="Source" value={form.source} onChange={handleChange} />
                    <input name="source_url" placeholder="Source URL (optional)" value={form.source_url} onChange={handleChange} aria-invalid={Boolean(errors.source_url)} />
                    {errors.source_url && <p className="error-text">{errors.source_url}</p>}
                    <textarea name="synopsis" className="review-textarea" placeholder="Synopsis" value={form.synopsis} onChange={handleChange} />
                    <textarea name="review" className="review-textarea" placeholder="Your review" value={form.review} onChange={handleChange} />
                    <input name="rating" type="number" min="0" max="5" placeholder="Rating (0-5)" value={form.rating} onChange={handleChange} aria-invalid={Boolean(errors.rating)} />
                    {errors.rating && <p className="error-text">{errors.rating}</p>}
                    <input name="cover_url" placeholder="Cover URL (optional)" value={form.cover_url} onChange={handleChange} aria-invalid={Boolean(errors.cover_url)} />
                    {errors.cover_url && <p className="error-text">{errors.cover_url}</p>}
                  </>
                )}

                {submitError && <p className="error-text">{submitError}</p>}
                {successMessage && <p className="success-text">{successMessage}</p>}
              </div>

              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="scrape-submit-btn" disabled={isSubmitting}>
                  {isSubmitting && <span className="button-spinner" aria-hidden="true" />}
                  {isSubmitting ? "Saving..." : mode === "scrape" ? "Start Scraping Now" : "Save Book"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
