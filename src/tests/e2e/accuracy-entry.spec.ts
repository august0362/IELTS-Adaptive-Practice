import { test, expect } from "@playwright/test";

test("accuracy entry from Lượt quay gần đây: fill it in later instead of right after logging", async ({ page }) => {
  await page.goto("/");

  // Log Listening practice but skip the immediate accuracy form (don't fill it) —
  // simulates a user who comes back later instead of entering it right away.
  await page.getByLabel("Kỹ năng").selectOption({ label: "Listening" });
  await page.getByLabel("Part").selectOption({ index: 0 });
  await page.getByRole("button", { name: "Ghi nhận" }).click();
  await expect(page.getByText(/Đã ghi nhận: Listening/)).toBeVisible();

  const newestEntry = page.locator("ul li").first();
  await expect(newestEntry).toContainText("Listening");

  // The prompt in Lượt quay gần đây (not the immediate inline form) is what gets used.
  await newestEntry.getByRole("button", { name: "+ Nhập số câu đúng" }).click();
  await newestEntry.getByLabel("Số câu đã làm").fill("25");
  await newestEntry.getByLabel("Số câu đúng").fill("20");
  await newestEntry.getByRole("button", { name: "Lưu" }).click();

  await expect(newestEntry.getByText("✓ Đã ghi số câu đúng: 20/25")).toBeVisible();
});

test("accuracy entry: logging Reading manually, then saving questions answered/correct", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Kỹ năng").selectOption({ label: "Reading" });
  await page.getByLabel("Part").selectOption({ index: 0 });
  await page.getByRole("button", { name: "Ghi nhận" }).click();
  await expect(page.getByText(/Đã ghi nhận: Reading/)).toBeVisible();

  // The accuracy-entry form appears since Reading has an accuracy component.
  await page.getByLabel("Số câu đã làm").fill("20");
  await page.getByLabel("Số câu đúng").fill("18");
  await page.getByRole("button", { name: "Lưu" }).click();

  await expect(page.getByText(/Đã lưu số câu đúng/)).toBeVisible();

  // Reflected on the Reading stats page's practice log.
  await page.goto("/stats/READING");
  await expect(page.getByRole("heading", { name: "Thống kê — Reading" })).toBeVisible();
});
