import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "../AdminPage";
import { getAdminLogs, getObservationList } from "../../api/adminApi";
import { getStoredUser } from "../../utils/authStorage";

vi.mock("../../api/adminApi", () => ({
  getAdminLogs: vi.fn(),
  getObservationList: vi.fn(),
}));

vi.mock("../../utils/authStorage", () => ({
  getStoredUser: vi.fn(),
}));

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStoredUser.mockReturnValue({
      id: "admin-1",
      name: "Admin",
      email: "admin@bookscape.test",
      role: "admin",
      roles: ["admin"],
      is_admin: true,
    });
    getObservationList.mockResolvedValue([
      {
        id: "obs-1",
        user_id: "user-1",
        user_email: "reader@example.com",
        role_name: "user",
        reason: "Repeated failed login attempts",
        score: 3,
        last_action_at: "2026-05-12T10:00:00Z",
        created_at: "2026-05-12T10:00:00Z",
        updated_at: "2026-05-12T10:00:00Z",
      },
    ]);
    getAdminLogs.mockResolvedValue([
      {
        id: "log-1",
        user_id: "user-1",
        user_email: "reader@example.com",
        role_name: "user",
        action: "failed_login",
        details: "Failed login",
        timestamp: "2026-05-12T10:00:00Z",
      },
    ]);
  });

  it("renders observation list and logs for admins", async () => {
    render(<AdminPage />);

    expect(await screen.findByText("Observation Desk")).toBeInTheDocument();
    expect(await screen.findByText("reader@example.com")).toBeInTheDocument();
    expect(screen.getByText("Repeated failed login attempts")).toBeInTheDocument();
    expect(screen.getByText("failed_login")).toBeInTheDocument();
  });

  it("blocks normal users in the UI", () => {
    getStoredUser.mockReturnValue({ name: "Reader", role: "user", roles: ["user"] });

    render(<AdminPage />);

    expect(screen.getByText(/admin access required/i)).toBeInTheDocument();
    expect(getObservationList).not.toHaveBeenCalled();
  });
});
