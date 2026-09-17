import { test, expect } from "@playwright/test";

test("journal CRUD: create with a #tag, filter by it, edit, then delete", async ({ page }) => {
  await page.goto("/journal");

  const content = `Ghi chú e2e ${Date.now()} #E2ETag`;
  await page.getByLabel("Nội dung ghi chú").fill(content);
  await page.getByRole("button", { name: "Lưu ghi chú" }).click();

  const noteItem = page.locator("li", { hasText: content });
  await expect(noteItem).toBeVisible();
  await expect(page.getByRole("button", { name: "#E2ETag" })).toBeVisible();

  // Filtering by the tag keeps this note visible.
  await page.getByRole("button", { name: "#E2ETag" }).click();
  await expect(noteItem).toBeVisible();
  await page.getByRole("button", { name: "Tất cả" }).click();

  // Edit.
  await noteItem.getByRole("button", { name: "Sửa" }).click();
  const textarea = page.getByLabel("Nội dung ghi chú");
  await expect(textarea).toHaveValue(content);

  const updatedContent = `${content} (đã sửa)`;
  await textarea.fill(updatedContent);
  await page.getByRole("button", { name: "Cập nhật" }).click();

  const updatedItem = page.locator("li", { hasText: updatedContent });
  await expect(updatedItem).toBeVisible();
  // `noteItem`'s `hasText` substring-matches the updated `<li>` too (updatedContent
  // starts with the original content), so it can't be used for a "gone" check —
  // assert on the exact original text instead, which the edit replaced in place.
  await expect(page.getByText(content, { exact: true })).not.toBeVisible();

  // Delete (window.confirm must be accepted).
  page.once("dialog", (dialog) => dialog.accept());
  await updatedItem.getByRole("button", { name: "Xóa" }).click();
  await expect(updatedItem).not.toBeVisible();
});
