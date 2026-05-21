import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { loginUser } from "../api/authApi";
import {
  getAuthRecoveryMessage,
  getLastKnownUser,
  saveAuthSession,
} from "../utils/authStorage";
import "./FormStyles.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const lastKnownUser = getLastKnownUser();
  const recoveryMessage = getAuthRecoveryMessage();
  const recoveryState = location.state?.recovery || {};
  const recoveryEmail = recoveryState.email || lastKnownUser?.email || "";
  const recoveryName = recoveryState.name || lastKnownUser?.name || "";

  const [form, setForm] = useState({
    email: recoveryEmail,
    password: "",
  });

  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const sessionMessage = window.sessionStorage.getItem("bookscape_session_message");
    if (sessionMessage) {
      setError(sessionMessage);
      window.sessionStorage.removeItem("bookscape_session_message");
    }
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setValidationError("");

    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setValidationError("Enter a valid email address.");
      return;
    }

    if (!form.password.trim()) {
      setValidationError("Password is required.");
      return;
    }

    try {
      setIsSubmitting(true);

      const authData = await loginUser({
        email: form.email.trim(),
        password: form.password,
      });

      saveAuthSession(authData);

      const redirectTo = location.state?.from?.pathname || "/library";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      quote="A reader lives a thousand lives before he dies. The man who never reads lives only one."
      author="George R.R. Martin"
    >
      <h2 className="form-title">Welcome Back</h2>
      <p className="form-intro">Pick up your shelves, reviews, and quote cards where you left them.</p>

      <form className="auth-form" onSubmit={handleLogin} noValidate>
        <div className="input-group">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            name="email"
            placeholder="your@email.com"
            required
            value={form.email}
            onChange={handleChange}
            aria-invalid={Boolean(validationError && validationError.toLowerCase().includes("email"))}
          />
        </div>

        <div className="input-group">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            name="password"
            placeholder="Enter your password"
            required
            value={form.password}
            onChange={handleChange}
            aria-invalid={Boolean(validationError && validationError.toLowerCase().includes("password"))}
          />
        </div>

        {validationError && (
          <p className="error-text" role="alert">
            {validationError}
          </p>
        )}

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        {(recoveryMessage || recoveryEmail) && (
          <div className="helper-text" role="status">
            <p>
              Your server session expired. Sign in again to sync any queued offline changes.
            </p>
            <Link
              to="/register"
              state={{ recovery: { email: form.email || recoveryEmail, name: recoveryName } }}
            >
              Register a new account
            </Link>
          </div>
        )}

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p className="form-footer">
        Don&apos;t have an account? <Link to="/register">Register</Link>
      </p>
    </AuthLayout>
  );
}
