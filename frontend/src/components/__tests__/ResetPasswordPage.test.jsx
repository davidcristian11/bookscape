import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "../ResetPasswordPage";
import { resetPassword } from "../../api/authApi";

vi.mock("../../api/authApi", () => ({
  resetPassword: vi.fn(),
}));

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  it("validates reset token and matching passwords", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("Paste reset token"), "short");
    await user.type(screen.getByPlaceholderText("New password"), "secret123");
    await user.type(screen.getByPlaceholderText("Confirm password"), "different123");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    expect(screen.getByText(/enter the reset token/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("submits the token and new password", async () => {
    const user = userEvent.setup();
    resetPassword.mockResolvedValue({ message: "Password reset successfully." });
    render(
      <MemoryRouter initialEntries={["/reset-password?token=reset-token-value-1234567890"]}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText("New password"), "newsecret123");
    await user.type(screen.getByPlaceholderText("Confirm password"), "newsecret123");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        token: "reset-token-value-1234567890",
        new_password: "newsecret123",
      });
    });
    expect(window.sessionStorage.getItem("bookscape_session_message")).toMatch(/password reset/i);
  });
});
