import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile menu blurs the backdrop, locks scrolling and closes on escape or resize", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  const backdrop = page.getByRole("button", { name: "Close navigation backdrop", exact: true });
  await expect(backdrop).toBeVisible();
  expect(await backdrop.evaluate(node => getComputedStyle(node).backdropFilter)).toContain("blur");
  expect(await page.locator("body").evaluate(node => node.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(backdrop).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.setViewportSize({ width: 1100, height: 844 });
  await expect(backdrop).toHaveCount(0);
  expect(await page.locator("body").evaluate(node => node.style.overflow)).not.toBe("hidden");
});

test("signup fields avoid mobile focus zoom and its logo opens the landing page", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: /Business Create campaigns/ }).click();
  for (const field of await page.locator("input:not([type=hidden])").all()) {
    expect(await field.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  }
  await page.getByRole("link", { name: "Reelch home" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("public waitlist accepts multiple platforms, Other and an international phone without niches", async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/v1/waitlist/promoters", async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { success: true } });
  });
  await page.goto("/#waitlist");
  const form = page.locator("#waitlist form");
  await expect(form.getByText("This is a public waitlist. No account or sign-in is needed yet.")).toBeVisible();
  await form.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toContainText("Select at least one platform");
  await form.getByLabel("Your name").fill("QA Person");
  await form.getByLabel("Email", { exact: true }).fill("qa@example.test");
  await form.getByRole("checkbox", { name: "Instagram", exact: true }).check();
  await expect(form.getByLabel("Instagram profile link")).toBeVisible();
  await form.getByRole("checkbox", { name: "Instagram", exact: true }).uncheck();
  await expect(form.getByLabel("Instagram profile link")).toHaveCount(0);
  await form.getByRole("checkbox", { name: "X", exact: true }).check();
  await form.getByRole("checkbox", { name: "Other", exact: true }).check();
  await form.getByLabel("Other platform name").fill("Bluesky");
  await form.getByLabel("X profile link").fill("x.com/example");
  await form.getByLabel("Other platform profile link").fill("bsky.app/profile/example.test");
  await form.getByRole("checkbox", { name: "WhatsApp", exact: true }).check();
  await form.getByRole("textbox", { name: /WhatsApp number/ }).fill("08012345678");
  await form.getByRole("button", { name: "Continue" }).click();
  await form.getByLabel("WhatsApp or phone country code", { exact: true }).selectOption("GH");
  await form.getByRole("textbox", { name: /WhatsApp or phone/ }).fill("0241234567");
  await form.locator("select[name=country]").selectOption("Ghana");
  await form.getByLabel("Audience size").fill("2500");
  await form.getByRole("button", { name: "Join waitlist" }).click();
  await expect(page.getByRole("heading", { name: "You’re on the list." })).toBeVisible();
  expect(submitted).toMatchObject({ platforms: ["X", "Other", "WhatsApp"], otherPlatform: "Bluesky", phone: "+233241234567", profiles: [{ platform: "X", profileUrl: "https://x.com/example" }, { platform: "Other", profileUrl: "https://bsky.app/profile/example.test" }, { platform: "WhatsApp", phone: "+2348012345678" }], niches: [] });
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("status")).toContainText("You’re on the Reelch waitlist");
});
