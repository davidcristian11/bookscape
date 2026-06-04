import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { resetPassword } from "../api/authApi";
import "./FormStyles.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [form, setForm] = useState({
    token: tokenFromUrl,
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.token.trim().length < 20) {
      setError("Enter the reset token.");
      return;
    }

    if (form.password.length < 4) {
      setError("Password must contain at least 4 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords must match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await resetPassword({
        token: form.token.trim(),
        new_password: form.password,
      });
      window.sessionStorage.setItem(
        "bookscape_session_message",
        "Password reset successfully. Sign in with your new password."
      );
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message || "Password reset failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout quote="A room without books is like a body without a soul." author="Cicero">
      <h2 className="form-title">Choose New Password</h2>
      <p className="form-intro">Use the one-time token before it expires.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label htmlFor="reset-token">Reset token</label>
          <input
            id="reset-token"
            name="token"
            value={form.token}
            onChange={handleChange}
            placeholder="Paste reset token"
            aria-invalid={Boolean(error && error.toLowerCase().includes("token"))}
          />
        </div>

        <div className="input-group">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="New password"
            aria-invalid={Boolean(error && error.toLowerCase().includes("password"))}
          />
        </div>

        <div className="input-group">
          <label htmlFor="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm password"
            aria-invalid={Boolean(error && error.toLowerCase().includes("match"))}
          />
        </div>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "Resetting..." : "Reset Password"}
        </button>
      </form>

      <p className="form-footer">
        Need a token? <Link to="/forgot-password">Request one</Link>
      </p>
    </AuthLayout>
  );
}
