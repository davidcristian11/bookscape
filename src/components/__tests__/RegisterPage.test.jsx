import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RegisterPage from "../RegisterPage";

vi.mock("../../api/authApi", () => ({
  registerUser: vi.fn(),
}));

vi.mock("../../utils/authStorage", () => ({
  saveAuthSession: vi.fn(),
}));

describe("RegisterPage", () => {
  it("validates name, email, and password before submitting", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><RegisterPage /></MemoryRouter>);

    await user.type(screen.getByPlaceholderText("Your Name"), "A");
    await user.type(screen.getByPlaceholderText("your@email.com"), "reader");
    await user.type(screen.getByPlaceholderText("Choose a password"), "123");
    await user.click(screen.getByRole("button", { name: /register/i }));

    expect(screen.getByText(/name must contain/i)).toBeInTheDocument();
  });
});
