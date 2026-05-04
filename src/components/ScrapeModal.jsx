import { useEffect, useState } from "react";
import "./Library.css";

const initialForm = {
  title: "",
  author: "",
  genre: "",
  year: "",
  status: "to-read",
  rating: 0,
  cover_url: "",
};

export default function ScrapeModal({ isOpen, onClose, onAddBook }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm);
      setErrors({});
      setSubmitError("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const validate = () => {
    const nextErrors = {};

    if (!form.title.trim()) nextErrors.title = "Title is required.";
    if (!form.author.trim()) nextErrors.author = "Author is required.";
    if (!form.genre.trim()) nextErrors.genre = "Genre is required.";

    const yearNumber = Number(form.year);
    if (!form.year || Number.isNaN(yearNumber) || yearNumber < 0) {
      nextErrors.year = "Year must be a valid non-negative number.";
    }

    const ratingNumber = Number(form.rating);
    if (
      Number.isNaN(ratingNumber) ||
      ratingNumber < 0 ||
      ratingNumber > 5
    ) {
      nextErrors.rating = "Rating must be between 0 and 5.";
    }

    if (
      form.cover_url.trim() &&
      !/^https?:\/\/.+/i.test(form.cover_url.trim())
    ) {
      nextErrors.cover_url = "Cover URL must start with http:// or https://";
    }

    return nextErrors;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitError("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);

      await onAddBook({
        title: form.title.trim(),
        author: form.author.trim(),
        genre: form.genre.trim(),
        year: Number(form.year),
        status: form.status,
        rating: Number(form.rating),
        cover_url: form.cover_url.trim() || null,
      });

      onClose();
    } catch (err) {
      setSubmitError(err.message || "Failed to create book.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Add New Book</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <input
              name="title"
              placeholder="Title"
              value={form.title}
              onChange={handleChange}
              className={errors.title ? "input-error" : ""}
            />
            {errors.title && <p className="error-text">{errors.title}</p>}

            <input
              name="author"
              placeholder="Author"
              value={form.author}
              onChange={handleChange}
              className={errors.author ? "input-error" : ""}
            />
            {errors.author && <p className="error-text">{errors.author}</p>}

            <input
              name="genre"
              placeholder="Genre"
              value={form.genre}
              onChange={handleChange}
              className={errors.genre ? "input-error" : ""}
            />
            {errors.genre && <p className="error-text">{errors.genre}</p>}

            <input
              name="year"
              type="number"
              placeholder="Year"
              value={form.year}
              onChange={handleChange}
              className={errors.year ? "input-error" : ""}
            />
            {errors.year && <p className="error-text">{errors.year}</p>}

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
              placeholder="Rating (0-5)"
              value={form.rating}
              onChange={handleChange}
              className={errors.rating ? "input-error" : ""}
            />
            {errors.rating && <p className="error-text">{errors.rating}</p>}

            <input
              name="cover_url"
              placeholder="Cover URL (optional)"
              value={form.cover_url}
              onChange={handleChange}
              className={errors.cover_url ? "input-error" : ""}
            />
            {errors.cover_url && (
              <p className="error-text">{errors.cover_url}</p>
            )}

            {submitError && <p className="error-text">{submitError}</p>}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="scrape-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Book"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}