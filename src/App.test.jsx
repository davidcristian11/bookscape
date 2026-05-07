import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  authenticated: false,
  token: null,
  offlineSession: false,
  user: null,
}));

vi.mock("./api/authApi", () => ({
  logoutUser: vi.fn(),
}));

vi.mock("./utils/activityCookies", () => ({
  recordVisit: vi.fn(),
}));

vi.mock("./utils/authStorage", () => ({
  clearAuthSession: vi.fn(),
  getAuthToken: vi.fn(() => authState.token),
  getStoredUser: vi.fn(() => authState.user),
  hasOfflineSession: vi.fn(() => authState.offlineSession),
  isAuthenticated: vi.fn(() => authState.authenticated),
}));

vi.mock("framer-motion", () => {
  const passthrough = (Tag) => ({ children, ...props }) => {
    const safeProps = { ...props };
    delete safeProps.initial;
    delete safeProps.animate;
    delete safeProps.exit;
    delete safeProps.transition;
    delete safeProps.whileHover;
    delete safeProps.whileTap;
    return <Tag {...safeProps}>{children}</Tag>;
  };

  return {
    AnimatePresence: ({ children }) => <>{children}</>,
    motion: {
      button: passthrough("button"),
      div: passthrough("div"),
      main: passthrough("main"),
      nav: passthrough("nav"),
    },
    useReducedMotion: () => true,
  };
});

vi.mock("./components/WelcomePage", () => ({
  default: () => <h1>Welcome Mock</h1>,
}));

vi.mock("./components/LoginPage", () => ({
  default: () => <h1>Login Mock</h1>,
}));

vi.mock("./components/RegisterPage", () => ({
  default: () => <h1>Register Mock</h1>,
}));

vi.mock("./components/LibraryPage", () => ({
  default: () => <h1>Library Mock</h1>,
}));

vi.mock("./components/InsightsPage", () => ({
  default: () => <h1>Insights Mock</h1>,
}));

vi.mock("./components/BookDetailPage", () => ({
  default: () => <h1>Book Detail Mock</h1>,
}));

vi.mock("./components/IdeaNexus", () => ({
  default: () => <h1>Idea Nexus Mock</h1>,
}));

const { default: App } = await import("./App.jsx");

function push(path) {
  window.history.pushState({}, "", path);
}

describe("App routing", () => {
  beforeEach(() => {
    authState.authenticated = false;
    authState.token = null;
    authState.offlineSession = false;
    authState.user = null;
    push("/");
  });

  it("renders the public welcome route", () => {
    render(<App />);

    expect(screen.getByText("Welcome Mock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /login/i })).toBeInTheDocument();
  });

  it("redirects protected routes to login when there is no session", async () => {
    push("/library");

    render(<App />);

    expect(await screen.findByText("Login Mock")).toBeInTheDocument();
  });

  it("allows protected routes with an offline session", async () => {
    authState.offlineSession = true;
    authState.user = { name: "Reader" };
    push("/library");

    render(<App />);

    expect(await screen.findByText("Library Mock")).toBeInTheDocument();
  });

  it("redirects authenticated users away from public-only routes", async () => {
    authState.authenticated = true;
    authState.token = "token-1";
    authState.user = { name: "Reader" };
    push("/login");

    render(<App />);

    await waitFor(() => expect(screen.getByText("Library Mock")).toBeInTheDocument());
  });
});
