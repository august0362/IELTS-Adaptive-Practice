// Shared between playwright.config.ts (passes AI_SERVER_URL pointing here to
// the Next server's env) and mockAiServer.ts + chat.spec.ts, so the e2e run
// never depends on Ollama/ai/server actually being installed and running —
// that pairing has its own real coverage via manual checks (see
// PROJECT_CONTEXT.md section 11.4), not the automated e2e suite. e2e only
// needs to prove web/'s own wiring (page -> /api/chat -> AI_SERVER_URL ->
// render reply) works, which a fixed canned reply is enough to prove.
export const MOCK_AI_SERVER_PORT = 8799;
export const MOCK_AI_SERVER_URL = `http://127.0.0.1:${MOCK_AI_SERVER_PORT}`;
export const MOCK_AI_REPLY = "Đây là câu trả lời giả lập từ mock AI server (e2e).";
