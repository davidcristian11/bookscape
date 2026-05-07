import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../LoginPage";
import { loginUser } from "../../api/authApi";
import {
  getAuthRecoveryMessage,
  getLastKnownUser,
  saveAuthSession,
} from "../../utils/authStorage";

vi.mock("../../api/authApi", () => ({
  loginUser: vi.fn(),
}));

vi.mock("../../utils/authStorage", () => ({
  getAuthRecoveryMessage: vi.fn(() => null),
  getLastKnownUser: vi.fn(() => null),
  saveAuthSession: vi.fn(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthRecoveryMessage.mockReturnValue(null);
    getLastKnownUser.mockReturnValue(null);
  });

  it("shows client-side validation for invalid email", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("your@email.com"), "bad-email");
    await user.type(screen.getByPlaceholderText("Enter your password"), "secret");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });

  it("validates a missing password", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("your@email.com"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(loginUser).not.toHaveBeenCalled();
  });

  it("saves the session after a successful login", async () => {
    const user = userEvent.setup();
    const authData = {
      token: "token-1",
      user: { id: "user-1", name: "Reader", email: "reader@example.com" },
    };
    loginUser.mockResolvedValue(authData);
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("your@email.com"), "reader@example.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "secret123");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(loginUser).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "secret123",
    });
    expect(saveAuthSession).toHaveBeenCalledWith(authData);
  });

  it("shows backend login errors", async () => {
    const user = userEvent.setup();
    loginUser.mockRejectedValue(new Error("Invalid credentials"));
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("your@email.com"), "reader@example.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "wrong");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });

  it("prefills recovery email and offers re-registration after backend restart", () => {
    getAuthRecoveryMessage.mockReturnValue(
      "The backend restarted and your in-memory session expired."
    );
    getLastKnownUser.mockReturnValue({
      name: "Reader",
      email: "reader@example.com",
    });

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    expect(screen.getByDisplayValue("reader@example.com")).toBeInTheDocument();
    expect(screen.getByText(/re-register with the same email/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /re-register/i })).toBeInTheDocument();
  });
});
