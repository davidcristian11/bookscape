import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout";
import { registerUser } from "../api/authApi";
import { saveAuthSession } from "../utils/authStorage";
import "./FormStyles.css";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setValidationErrors([]);

    const nextValidationErrors = [];
    if (form.name.trim().length < 2) {
      nextValidationErrors.push("Name must contain at least 2 characters.");
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextValidationErrors.push("Enter a valid email address.");
    }

    if (form.password.length < 4) {
      nextValidationErrors.push("Password must contain at least 4 characters.");
    }

    if (nextValidationErrors.length > 0) {
      setValidationErrors(nextValidationErrors);
      return;
    }

    try {
      setIsSubmitting(true);

      const authData = await registerUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      saveAuthSession(authData);
      navigate("/library");
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      quote="There is no friend as loyal as a book."
      author="Ernest Hemingway"
    >
      <h2 className="form-title">Create Your Account</h2>

      <form className="auth-form" onSubmit={handleRegister} noValidate>
        <div className="input-group">
          <label>Name</label>
          <input
            type="text"
            name="name"
            placeholder="Your Name"
            required
            value={form.name}
            onChange={handleChange}
          />
        </div>

        <div className="input-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            placeholder="your@email.com"
            required
            value={form.email}
            onChange={handleChange}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            placeholder="Choose a password"
            required
            value={form.password}
            onChange={handleChange}
          />
        </div>

        {validationErrors.length > 0 && (
          <div className="error-text" role="alert">
            {validationErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "Registering..." : "Register"}
        </button>
      </form>

      <p className="form-footer">
        Already have an account? <Link to="/login">Log In</Link>
      </p>
    </AuthLayout>
  );
}
