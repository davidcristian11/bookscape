import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import WelcomePage from "./components/WelcomePage";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import Navbar from "./components/Navbar";
import LibraryPage from "./components/LibraryPage";
import BookDetailPage from "./components/BookDetailPage";
import InsightsPage from "./components/InsightsPage";
import IdeaNexus from "./components/IdeaNexus";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicOnlyRoute from "./components/PublicOnlyRoute";
import { recordVisit } from "./utils/activityCookies";

function ActivityMonitor() {
  const location = useLocation();

  useEffect(() => {
    recordVisit(location.pathname);
  }, [location.pathname]);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.main
        key={location.pathname}
        className="app-page"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<WelcomePage />} />

          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/book/:id" element={<BookDetailPage />} />
            <Route path="/nexus" element={<IdeaNexus />} />
          </Route>
        </Routes>
      </motion.main>
    </AnimatePresence>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ActivityMonitor />
      <Navbar />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

export default App;
