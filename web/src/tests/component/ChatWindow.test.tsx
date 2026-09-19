import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatWindow } from "../../components/chat/ChatWindow";
import { mockFetchSequence } from "./mockFetch";

describe("ChatWindow", () => {
  it("shows a welcome message before any input", () => {
    render(<ChatWindow />);
    expect(screen.getByText(/Chào bạn!/)).toBeInTheDocument();
  });

  it("sends the typed message, shows it immediately, then shows the reply once it arrives", async () => {
    const user = userEvent.setup();
    const { fetchMock } = mockFetchSequence([{ json: { reply: "Đây là câu trả lời từ chatbot." } }]);

    render(<ChatWindow />);

    await user.type(screen.getByLabelText("Nhập câu hỏi"), "App này tính Band thế nào?");
    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(screen.getByText("App này tính Band thế nào?")).toBeInTheDocument();
    expect(await screen.findByText("Đây là câu trả lời từ chatbot.")).toBeInTheDocument();

    // History sent to the API excludes the just-typed message (it's the request's
    // own `message` field) but includes the earlier welcome turn.
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.message).toBe("App này tính Band thế nào?");
    expect(body.history).toHaveLength(1);
    expect(body.history[0].role).toBe("assistant");
  });

  it("sends on Enter without needing the Gửi button", async () => {
    const user = userEvent.setup();
    mockFetchSequence([{ json: { reply: "ok" } }]);

    render(<ChatWindow />);
    await user.type(screen.getByLabelText("Nhập câu hỏi"), "Câu hỏi test{Enter}");

    expect(screen.getByText("Câu hỏi test")).toBeInTheDocument();
    expect(await screen.findByText("ok")).toBeInTheDocument();
  });

  it("does not send an empty/whitespace-only message", async () => {
    const user = userEvent.setup();
    const { fetchMock } = mockFetchSequence([{ json: { reply: "ok" } }]);

    render(<ChatWindow />);
    await user.type(screen.getByLabelText("Nhập câu hỏi"), "   ");
    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a friendly error and keeps the typed exchange visible when the API fails", async () => {
    const user = userEvent.setup();
    mockFetchSequence([{ status: 503, json: { error: "Chatbot chưa sẵn sàng — kiểm tra server AI (ai/server/) đã chạy chưa." } }]);

    render(<ChatWindow />);
    await user.type(screen.getByLabelText("Nhập câu hỏi"), "Xin chào");
    await user.click(screen.getByRole("button", { name: "Gửi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Chatbot chưa sẵn sàng");
    expect(screen.getByText("Xin chào")).toBeInTheDocument();
  });
});
