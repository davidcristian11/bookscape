import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatPage from "../ChatPage";
import { buildChatWebSocketUrl, getChatMessages } from "../../api/chatApi";
import { getAuthToken, getStoredUser } from "../../utils/authStorage";

vi.mock("../../api/chatApi", () => ({
  buildChatWebSocketUrl: vi.fn(() => "ws://localhost:8000/ws/chat?token=token-1"),
  getChatMessages: vi.fn(),
}));

vi.mock("../../utils/authStorage", () => ({
  getAuthToken: vi.fn(() => "token-1"),
  getStoredUser: vi.fn(() => ({ id: "user-1", name: "Reader", role: "user" })),
}));

class MockWebSocket {
  static OPEN = 1;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    MockWebSocket.instance = this;
    setTimeout(() => this.onopen?.(), 0);
  }

  send = vi.fn((message) => {
    this.onmessage?.({
      data: JSON.stringify({
        type: "chat_message",
        message: {
          id: "message-new",
          user_id: "user-1",
          user_name: "Reader",
          role_name: "user",
          message,
          created_at: "2026-05-12T10:00:00Z",
        },
      }),
    });
  });

  close = vi.fn();
}

describe("ChatPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.WebSocket = MockWebSocket;
    getAuthToken.mockReturnValue("token-1");
    getStoredUser.mockReturnValue({ id: "user-1", name: "Reader", role: "user" });
    getChatMessages.mockResolvedValue([
      {
        id: "message-1",
        user_id: "user-2",
        user_name: "Admin",
        role_name: "admin",
        message: "Welcome",
        created_at: "2026-05-12T09:00:00Z",
      },
    ]);
  });

  it("loads persisted messages and sends over WebSocket", async () => {
    const user = userEvent.setup();
    render(<ChatPage />);

    expect(await screen.findByText("Welcome")).toBeInTheDocument();
    await waitFor(() => expect(buildChatWebSocketUrl).toHaveBeenCalledWith("token-1"));

    await user.type(screen.getByPlaceholderText(/share a thought/i), "Hello");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(MockWebSocket.instance.send).toHaveBeenCalledWith("Hello");
    expect(await screen.findByText("Hello")).toBeInTheDocument();
  });
});
