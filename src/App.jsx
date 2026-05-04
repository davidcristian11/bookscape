import { BrowserRouter, Routes, Route } from "react-router-dom";
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

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
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
    </BrowserRouter>
  );
}

export default App;