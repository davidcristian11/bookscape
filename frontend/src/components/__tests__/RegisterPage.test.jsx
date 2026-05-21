import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "../RegisterPage";
import { registerUser } from "../../api/authApi";
import {
  getAuthRecoveryMessage,
  getLastKnownUser,
  saveAuthSession,
} from "../../utils/authStorage";

vi.mock("../../api/authApi", () => ({
  registerUser: vi.fn(),
}));

vi.mock("../../utils/authStorage", () => ({
  getAuthRecoveryMessage: vi.fn(() => null),
  getLastKnownUser: vi.fn(() => null),
  saveAuthSession: vi.fn(),
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthRecoveryMessage.mockReturnValue(null);
    getLastKnownUser.mockReturnValue(null);
  });

  it("validates name, email, and password before submitting", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("Your Name"), "A");
    await user.type(screen.getByPlaceholderText("your@email.com"), "reader");
    await user.type(screen.getByPlaceholderText("Choose a password"), "123");
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(screen.getByText(/name must contain/i)).toBeInTheDocument();
  });

  it("saves the session after successful registration", async () => {
    const user = userEvent.setup();
    const authData = {
      token: "token-1",
      user: { id: "user-1", name: "Reader", email: "reader@example.com", role: "user" },
    };
    registerUser.mockResolvedValue(authData);
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("Your Name"), "Reader");
    await user.type(screen.getByPlaceholderText("your@email.com"), "reader@example.com");
    await user.type(screen.getByPlaceholderText("Choose a password"), "secret123");
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(registerUser).toHaveBeenCalledWith({
      name: "Reader",
      email: "reader@example.com",
      password: "secret123",
    });
    expect(saveAuthSession).toHaveBeenCalledWith(authData);
  });

  it("shows backend registration errors", async () => {
    const user = userEvent.setup();
    registerUser.mockRejectedValue(new Error("Email already registered"));
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("Your Name"), "Reader");
    await user.type(screen.getByPlaceholderText("your@email.com"), "reader@example.com");
    await user.type(screen.getByPlaceholderText("Choose a password"), "secret123");
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(await screen.findByText(/email already registered/i)).toBeInTheDocument();
  });

  it("prefills safe profile details for session recovery", () => {
    getAuthRecoveryMessage.mockReturnValue(
      "Your server session expired."
    );
    getLastKnownUser.mockReturnValue({
      name: "Reader",
      email: "reader@example.com",
    });

    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    expect(screen.getByDisplayValue("Reader")).toBeInTheDocument();
    expect(screen.getByDisplayValue("reader@example.com")).toBeInTheDocument();
    expect(screen.getByText(/same email/i)).toBeInTheDocument();
  });
});
