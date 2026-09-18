import { test, expect } from "@playwright/test";

test("delete-roll: rolling adds a history entry, deleting it removes it again", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/");

  await page.getByRole("button", { name: "Quay", exact: true }).click();
  // Generous timeout: worst case, both results land on a part with 2
  // question-type draws each (e.g. Reading + Listening Block A), adding up to
  // 4 extra cascade levels on top of the 2 skill + 2 part draws.
  await expect(page.getByRole("button", { name: "Quay lại" })).toBeVisible({ timeout: 30_000 });

  // "Lượt quay gần đây" refreshes after the roll — its first <li> is this roll
  // (the section is the only <ul> on this page once history is non-empty).
  const newestEntry = page.locator("ul li").first();
  await expect(newestEntry).toBeVisible();
  const entryText = await newestEntry.textContent();

  page.once("dialog", (dialog) => dialog.accept());
  await newestEntry.getByRole("button", { name: /Xóa lượt quay/ }).click();

  await expect(page.getByText(entryText!, { exact: true })).not.toBeVisible();
});
