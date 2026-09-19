import { test, expect } from "@playwright/test";

test("manual practice: logging Reading without rolling shows up in recent rolls as 'Tự học'", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Kỹ năng").selectOption({ label: "Reading" });
  await page.getByLabel("Part").selectOption({ index: 0 });
  await page.getByRole("button", { name: "Ghi nhận" }).click();

  await expect(page.getByText(/Đã ghi nhận: Reading/)).toBeVisible();

  const newestEntry = page.locator("ul li").first();
  await expect(newestEntry).toContainText("Tự học");
  await expect(newestEntry).toContainText("Reading");
});
