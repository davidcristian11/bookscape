import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "../ForgotPasswordPage";
import { requestPasswordReset } from "../../api/authApi";

vi.mock("../../api/authApi", () => ({
  requestPasswordReset: vi.fn(),
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates email before requesting a reset token", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("your@email.com"), "bad-email");
    await user.click(screen.getByRole("button", { name: /send reset token/i }));

    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("calls the reset request API and shows the demo reset link", async () => {
    const user = userEvent.setup();
    requestPasswordReset.mockResolvedValue({
      message: "If the email exists, a reset token has been created.",
      reset_token: "reset-token-value-1234567890",
    });
    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("your@email.com"), "reader@example.com");
    await user.click(screen.getByRole("button", { name: /send reset token/i }));

    expect(requestPasswordReset).toHaveBeenCalledWith("reader@example.com");
    expect(await screen.findByText(/reset token has been created/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue to reset password/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/reset-password?token=")
    );
  });
});
