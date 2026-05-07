import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "../Navbar";
import { logoutUser } from "../../api/authApi";
import {
  clearAuthSession,
  getAuthToken,
  getStoredUser,
  isAuthenticated,
} from "../../utils/authStorage";

vi.mock("../../api/authApi", () => ({ logoutUser: vi.fn() }));

vi.mock("../../utils/authStorage", () => ({
  clearAuthSession: vi.fn(),
  getAuthToken: vi.fn(() => "token"),
  getStoredUser: vi.fn(() => ({ name: "Reader" })),
  isAuthenticated: vi.fn(() => true),
}));

function renderNavbar(path = "/library") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar />
    </MemoryRouter>
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue("token");
    getStoredUser.mockReturnValue({ name: "Reader" });
    isAuthenticated.mockReturnValue(true);
    logoutUser.mockResolvedValue({});
  });

  it("shows authenticated navigation links", () => {
    renderNavbar();

    expect(screen.getByText("BookScape")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("Idea Nexus")).toBeInTheDocument();
    expect(screen.getByText(/hi, reader/i)).toBeInTheDocument();
  });

  it("shows public navigation when logged out", () => {
    isAuthenticated.mockReturnValue(false);
    getStoredUser.mockReturnValue(null);

    renderNavbar("/login");

    expect(screen.getByRole("link", { name: /login/i })).toHaveClass("active");
    expect(screen.getByRole("link", { name: /register/i })).toBeInTheDocument();
    expect(screen.queryByText("Library")).not.toBeInTheDocument();
  });

  it("clears the local session after logout", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(logoutUser).toHaveBeenCalledWith("token");
    expect(clearAuthSession).toHaveBeenCalled();
  });

  it("still clears the local session when remote logout fails", async () => {
    const user = userEvent.setup();
    logoutUser.mockRejectedValue(new Error("Server gone"));
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(clearAuthSession).toHaveBeenCalled();
  });

  it("clears local state without calling the backend when no token exists", async () => {
    const user = userEvent.setup();
    getAuthToken.mockReturnValue(null);
    renderNavbar();

    await user.click(screen.getByRole("button", { name: /logout/i }));

    expect(logoutUser).not.toHaveBeenCalled();
    expect(clearAuthSession).toHaveBeenCalled();
  });
});
