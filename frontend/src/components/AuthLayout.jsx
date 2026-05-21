import { motion, useReducedMotion } from "framer-motion";
import "./AuthLayout.css";

export default function AuthLayout({ children, quote, author }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="auth-container">
      <motion.div
        className="auth-card"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.34, ease: "easeOut" }}
      >
        <aside className="auth-quote-panel">
          <div className="quote-book-stack" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p className="auth-quote-text">&quot;{quote}&quot;</p>
          <p className="quote-author">&mdash; {author}</p>
        </aside>

        <section className="auth-form-panel">{children}</section>
      </motion.div>
    </div>
  );
}
