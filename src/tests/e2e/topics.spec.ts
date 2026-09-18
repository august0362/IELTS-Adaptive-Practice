import { test, expect } from "@playwright/test";

test("topics: add a topic on Settings, then delete it", async ({ page }) => {
  await page.goto("/settings");

  const topicName = `E2E Topic ${Date.now()}`;
  await page.getByPlaceholder(/Tên chủ đề/).fill(topicName);
  await page.getByRole("button", { name: "Thêm chủ đề" }).click();

  const chip = page.locator("li", { hasText: topicName });
  await expect(chip).toBeVisible();

  await chip.getByRole("button", { name: `Xóa chủ đề ${topicName}` }).click();
  await expect(chip).not.toBeVisible();
});
