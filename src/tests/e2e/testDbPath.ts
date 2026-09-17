// Shared between playwright.config.ts (passes it to the spawned dev server's
// env) and global-setup.ts (migrates + seeds it before any test runs), so a
// full e2e run never touches the real ./dev.db a person might be using.
export const E2E_DB_PATH = "./e2e-test.db";
