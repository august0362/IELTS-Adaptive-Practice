import { existsSync, unlinkSync } from "node:fs";
import { E2E_DB_PATH } from "./testDbPath";

/**
 * Run as the first step of playwright.config.ts's webServer command chain
 * (`tsx setupDb.ts && next build && next start`), NOT as Playwright's
 * `globalSetup` hook — that hook's ordering relative to webServer startup
 * turned out not to be the "always finishes first" guarantee it reads as:
 * an earlier attempt using globalSetup left e2e-test.db with zero tables
 * (SQLITE_ERROR: no such table at runtime), consistent with the server
 * having already opened/created the file before or during migration.
 * Chaining this into the same shell command as build+start via `&&`
 * removes the ambiguity — it's one sequential process, not two racing ones.
 */
async function main() {
  process.env.DATABASE_PATH = E2E_DB_PATH;

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const path = `${E2E_DB_PATH}${suffix}`;
    if (existsSync(path)) unlinkSync(path);
  }

  const { db } = await import("../../lib/db/client");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const { seedDatabase } = await import("../../lib/db/seed");

  migrate(db, { migrationsFolder: "./drizzle/migrations" });
  const { skillCount, partCount, configCount } = await seedDatabase(db);
  console.log(`[e2e setupDb] seeded ${E2E_DB_PATH}: ${skillCount} skills, ${partCount} parts, ${configCount} config defaults.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
