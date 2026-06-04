import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { requestPasswordReset } from "../api/authApi";
import "./FormStyles.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await requestPasswordReset(email.trim());
      setResult(response);
    } catch (err) {
      setError(err.message || "Password reset request failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetLink = result?.reset_token
    ? `/reset-password?token=${encodeURIComponent(result.reset_token)}`
    : null;

  return (
    <AuthLayout quote="Not all those who wander are lost." author="J.R.R. Tolkien">
      <h2 className="form-title">Reset Access</h2>
      <p className="form-intro">Request a one-time token for your BookScape account.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label htmlFor="reset-email">Email</label>
          <input
            id="reset-email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(error)}
          />
        </div>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="success-text" role="status">
            <p>{result.message}</p>
            {resetLink && <Link to={resetLink}>Continue to reset password</Link>}
          </div>
        )}

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send Reset Token"}
        </button>
      </form>

      <p className="form-footer">
        Remembered it? <Link to="/login">Log In</Link>
      </p>
    </AuthLayout>
  );
}
