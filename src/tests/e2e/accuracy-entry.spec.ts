import { test, expect } from "@playwright/test";

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
