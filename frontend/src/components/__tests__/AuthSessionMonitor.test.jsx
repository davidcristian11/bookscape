import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthSessionMonitor from "../AuthSessionMonitor";
import { logoutUser } from "../../api/authApi";
import { markAuthSessionExpired } from "../../utils/authStorage";

const authState = vi.hoisted(() => ({
  token: "token-1",
}));

vi.mock("../../api/authApi", () => ({
  logoutUser: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("../../utils/authStorage", () => ({
  getAuthChangedEventName: vi.fn(() => "bookscape:auth-session-changed"),
  getAuthToken: vi.fn(() => authState.token),
  getRefreshToken: vi.fn(() => null),
  getTokenExpiresAt: vi.fn(() => null),
  markAuthSessionExpired: vi.fn(() => {
    authState.token = null;
  }),
  saveAuthSession: vi.fn(),
}));

describe("AuthSessionMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    authState.token = "token-1";
    window.__BOOKSCAPE_INACTIVITY_TIMEOUT_MS__ = 25;
    logoutUser.mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.__BOOKSCAPE_INACTIVITY_TIMEOUT_MS__;
  });

  it("logs out after the configured inactivity timeout", async () => {
    render(
      <MemoryRouter>
        <AuthSessionMonitor />
      </MemoryRouter>
    );

    await act(async () => {
      vi.advanceTimersByTime(25);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(logoutUser).toHaveBeenCalledWith("token-1");
    expect(markAuthSessionExpired).toHaveBeenCalledWith(
      "You were logged out after inactivity."
    );
  });
});
