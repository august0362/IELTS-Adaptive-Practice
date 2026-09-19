import { test, expect } from "@playwright/test";
import { MOCK_AI_REPLY } from "./mockAiServerConfig";

// Proves web/'s own wiring (page -> POST /api/chat -> AI_SERVER_URL -> render
// reply) end to end against a real running Next server. Does NOT exercise the
// real model/RAG pipeline in ai/server/ — that's covered by ai/server/'s own
// pytest suite (pure logic) plus manual checks (I/O boundary, real Ollama
// calls). See PROJECT_CONTEXT.md section 11.4.
test("chat: sending a message shows it immediately, then shows the AI server's reply", async ({ page }) => {
  await page.goto("/chat");

  await expect(page.getByText(/Chào bạn!/)).toBeVisible();

  const question = `Câu hỏi e2e ${Date.now()}`;
  await page.getByLabel("Nhập câu hỏi").fill(question);
  await page.getByRole("button", { name: "Gửi" }).click();

  await expect(page.getByText(question)).toBeVisible();
  await expect(page.getByText(MOCK_AI_REPLY)).toBeVisible();
});
