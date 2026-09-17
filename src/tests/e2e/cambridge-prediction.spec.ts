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

  // mean(6.5, 7, 6, 6.5) = 6.5 -> ieltsRound(6.5) = 6.5 (frac 0.5 rounds to +0.5, not +1)
  await expect(page.getByText("Chưa đủ dữ liệu")).toHaveCount(0);
  await expect(page.getByText("Cần đủ dữ liệu cả 4 kỹ năng")).not.toBeVisible();
});
