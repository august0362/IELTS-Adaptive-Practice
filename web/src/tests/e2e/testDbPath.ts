// Shared between playwright.config.ts (passes it to the spawned dev server's
// env) and setupDb.ts (migrates + seeds it before the build/start chain
// runs), so a full e2e run never touches the real ./dev.db a person might be
// using.
export const E2E_DB_PATH = "./e2e-test.db";
