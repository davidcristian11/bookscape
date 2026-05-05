import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Navbar from "../Navbar";

vi.mock("../../api/authApi", () => ({ logoutUser: vi.fn() }));

vi.mock("../../utils/authStorage", () => ({
  clearAuthSession: vi.fn(),
  getAuthToken: vi.fn(() => "token"),
  getStoredUser: vi.fn(() => ({ name: "Reader" })),
  isAuthenticated: vi.fn(() => true),
}));

describe("Navbar", () => {
  it("shows authenticated navigation links", () => {
    render(<MemoryRouter initialEntries={["/library"]}><Navbar /></MemoryRouter>);

    expect(screen.getByText("BookScape")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("Idea Nexus")).toBeInTheDocument();
    expect(screen.getByText(/hi, reader/i)).toBeInTheDocument();
  });
});
