import { test, expect } from "@playwright/test";

test("adding a Cambridge result makes it appear and updates the prediction dashboard", async ({ page }) => {
  await page.goto("/prediction");

  await expect(page.getByText("Chưa đủ dữ liệu")).toHaveCount(4);
  await expect(page.getByText("Cần đủ dữ liệu cả 4 kỹ năng")).toBeVisible();

  const testName = `Cambridge E2E ${Date.now()}`;
  await page.getByLabel("Tên đề thi").fill(testName);
  await page.getByLabel("Reading", { exact: true }).fill("6.5");
  await page.getByLabel("Listening", { exact: true }).fill("7");
  await page.getByLabel("Writing", { exact: true }).fill("6");
  await page.getByLabel("Speaking", { exact: true }).fill("6.5");
  await page.getByRole("button", { name: "Thêm kết quả" }).click();

  await expect(page.getByText(testName)).toBeVisible();

  await expect(page.getByText("Chưa đủ dữ liệu")).toHaveCount(0);
  await expect(page.getByText("Cần đủ dữ liệu cả 4 kỹ năng")).not.toBeVisible();

  // Not pinning an exact overall value here on purpose: Formula 3 v2 (EWMA +
  // an accuracy component + a frequency nudge, PROJECT_CONTEXT.md 5.4) blends
  // in each skill's practice-frequency/accuracy history, and the e2e suite's
  // specs share one persistent DB (src/tests/e2e/setupDb.ts seeds it once,
  // not per-spec) and run in a fixed order — another spec (e.g.
  // accuracy-entry.spec.ts) may have already logged Reading practice by the
  // time this one runs, which shifts the frequency nudge. The unit tests in
  // bandPrediction.test.ts already pin the exact arithmetic; this e2e spec's
  // job is just confirming the flow (submit -> dashboard updates with a real
  // number), so assert a plausible band value showed up, not a specific one.
  const overallCard = page.getByText("Overall dự đoán").locator("..");
  await expect(overallCard.getByText(/^\d(\.\d)?$/)).toBeVisible();
});
