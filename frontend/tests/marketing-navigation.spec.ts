import { expect, test } from "@playwright/test";

test("desktop early access opens the waitlist from another page", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("link", { name: "Get early access" }).click();
  await expect(page).toHaveURL(/\/#waitlist$/);
  await expect(page.locator("#waitlist form")).toBeVisible();
});

test("mobile early access opens the waitlist and closes navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Get early access" }).click();
  await expect(page).toHaveURL(/\/#waitlist$/);
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#waitlist form")).toBeVisible();
});

test("incomplete administrator invitation gives an actionable error", async ({ page }) => {
  await page.goto("/accept-admin-invite");
  await expect(page.getByText("This invitation link is incomplete.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
});
