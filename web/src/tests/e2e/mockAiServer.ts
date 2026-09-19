// A stand-in for ai/server/ during e2e — see mockAiServerConfig.ts for why.
// Run as its own Playwright `webServer` entry (playwright.config.ts), never
// imported directly by a spec file: specs only import the shared constants.
import { createServer } from "node:http";
import { MOCK_AI_REPLY, MOCK_AI_SERVER_PORT } from "./mockAiServerConfig";

const server = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/chat") {
    res.writeHead(404).end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ reply: MOCK_AI_REPLY }));
  });
});

server.listen(MOCK_AI_SERVER_PORT, "127.0.0.1", () => {
  console.log(`[mockAiServer] listening on ${MOCK_AI_SERVER_PORT}`);
});
