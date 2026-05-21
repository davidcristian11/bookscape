import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import "./WelcomePage.css";

const bookSpines = [
  "var(--primary-green)",
  "var(--accent-orange)",
  "var(--accent-gold)",
  "var(--accent-burgundy)",
  "#5f7f6f",
  "#b98555",
  "var(--primary-green-hover)",
];

export default function WelcomePage() {
  const shouldReduceMotion = useReducedMotion();
  const entrance = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <div className="welcome-container">
      <motion.section
        className="welcome-text-section"
        {...entrance}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <span className="hero-kicker">Personal digital library</span>
        <h1 className="welcome-title">Curate your digital library.</h1>
        <p className="welcome-description">
          Instantly scrape book data from around the web, write comprehensive reviews,
          and organize your reading list in one elegant space.
        </p>

        <motion.div
          className="welcome-actions"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.12, ease: "easeOut" }}
        >
          <motion.div whileHover={shouldReduceMotion ? undefined : { y: -2 }} whileTap={{ scale: 0.98 }}>
            <Link to="/register" className="start-btn">
              Start Scraping Now
            </Link>
          </motion.div>
          <Link to="/login" className="start-secondary">
            Log In
          </Link>
        </motion.div>

        <div className="hero-proof" aria-label="BookScape highlights">
          <span>Warm shelves</span>
          <span>Smart metadata</span>
          <span>Quote cards</span>
        </div>
      </motion.section>

      <motion.section
        className="welcome-visual-section"
        aria-hidden="true"
        initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96, x: 22 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
      >
        <div className="library-scene">
          <div className="shelf shelf-top">
            {bookSpines.slice(0, 5).map((color, index) => (
              <motion.span
                key={`${color}-${index}`}
                className="book-spine"
                style={{
                  background: color,
                  height: `${116 + (index % 3) * 18}px`,
                }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.14 + index * 0.04 }}
              />
            ))}
          </div>
          <div className="reading-card">
            <span className="card-line wide" />
            <span className="card-line" />
            <span className="card-line short" />
          </div>
          <div className="shelf shelf-bottom">
            {bookSpines.map((color, index) => (
              <motion.span
                key={`${color}-bottom-${index}`}
                className="book-spine slim"
                style={{
                  background: color,
                  height: `${84 + (index % 4) * 15}px`,
                }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + index * 0.035 }}
              />
            ))}
          </div>
          <div className="catalog-chip">BookScape</div>
        </div>
      </motion.section>
    </div>
  );
}
