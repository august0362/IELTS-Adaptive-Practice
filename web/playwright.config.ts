import { defineConfig, devices } from "@playwright/test";
import { E2E_DB_PATH } from "./src/tests/e2e/testDbPath";
import { MOCK_AI_SERVER_PORT, MOCK_AI_SERVER_URL } from "./src/tests/e2e/mockAiServerConfig";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./src/tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false, // tests share one seeded DB and assert on its evolving state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Array form: Playwright starts both before any test runs and tears both
  // down after. The mock AI server has to be listening *before* `next start`
  // boots, since AI_SERVER_URL is read once at that process's startup (a
  // route handler can't be handed it after the fact) — see
  // mockAiServerConfig.ts for why e2e never talks to the real ai/server/.
  webServer: [
    {
      command: "npx tsx src/tests/e2e/mockAiServer.ts",
      port: MOCK_AI_SERVER_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // `next dev` refuses to start a 2nd instance for the same project directory
      // even on a different port (Next 16's dev-server singleton lock) — since a
      // manually-run `npm run dev` on :3000 is common during this project's own
      // development, e2e runs against a production build on a separate port
      // instead, which has no such restriction and is also more representative
      // of real behavior anyway.
      command: `npx tsx src/tests/e2e/setupDb.ts && npx next build && npx next start -p ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        DATABASE_PATH: E2E_DB_PATH,
        AI_SERVER_URL: MOCK_AI_SERVER_URL,
      },
    },
  ],
});
