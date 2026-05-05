import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "../LoginPage";

vi.mock("../../api/authApi", () => ({
  loginUser: vi.fn(),
}));

vi.mock("../../utils/authStorage", () => ({
  saveAuthSession: vi.fn(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows client-side validation for invalid email", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("your@email.com"), "bad-email");
    await user.type(screen.getByPlaceholderText("Enter your password"), "secret");
    await user.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });
});
