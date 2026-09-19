import { test, expect } from "@playwright/test";

test("full roll flow: Quay reveals 2 skills + parts and logs to recent rolls", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vòng quay kỹ năng" })).toBeVisible();

  await page.getByRole("button", { name: "Quay", exact: true }).click();

  // The cascading cycle-then-land animation runs on real timers here (unlike
  // the mocked component test) — several real seconds across 2 skill draws +
  // 2 part draws, plus up to 4 more question-type draws if a part with
  // questionTypeRollCount > 0 comes up (PROJECT_CONTEXT.md 5.7), hence the
  // generous timeout.
  await expect(page.getByRole("button", { name: "Quay lại" })).toBeVisible({ timeout: 30_000 });

  const partSections = page.locator("h2", { hasText: "— chọn part" });
  await expect(partSections).toHaveCount(2);

  await expect(page.getByText("Chưa có lượt quay nào.")).not.toBeVisible();
});
