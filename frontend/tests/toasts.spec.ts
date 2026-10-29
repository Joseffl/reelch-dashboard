import { expect, test } from "@playwright/test";

test("required fields use a toast and focus the field without sending a request", async ({ page }) => {
  let submitted = false;
  await page.route("**/api/v1/auth/login", async route => { submitted = true; await route.abort(); });
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toContainText(/Please fill (in|out) this field\./);
  await expect(page.getByLabel("Email address")).toBeFocused();
  expect(submitted).toBe(false);
});

test("login failures use one dismissible toast and preserve the form", async ({ page }) => {
  await page.route("**/api/v1/auth/login", route => route.fulfill({ status: 401, json: { message: "Invalid email or password" } }));
  await page.goto("/login");
  await page.getByLabel("Email address").fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("IncorrectPassword42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const toast = page.getByRole("region", { name: "Notifications" }).getByRole("alert");
  await expect(toast).toHaveText(/Invalid email or password/);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(toast).toHaveCount(1);
  await expect(page.getByLabel("Email address")).toHaveValue("test@example.test");
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await expect(toast).toHaveCount(0);
});

test("network failures show a useful toast on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/auth/login", route => route.abort("failed"));
  await page.goto("/login");
  await page.getByLabel("Email address").fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("IncorrectPassword42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toContainText("We couldn’t reach Reelch");
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toBeInViewport();
});

test("signup password validation uses a toast without clearing entered values", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("button", { name: /Business Create campaigns/ }).click();
  await page.getByLabel("Full name").fill("Test Person");
  await page.getByLabel("Business name").fill("Test Business");
  await page.getByLabel("Email address").fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Password12345");
  await page.getByLabel("Confirm password").fill("DifferentPassword12345");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toContainText("Passwords do not match");
  await expect(page.getByLabel("Business name")).toHaveValue("Test Business");
});

test("dashboard load failures show one toast with a recovery action", async ({ page }) => {
  await page.route("**/api/v1/auth/me", route => route.fulfill({ json: { id: "test-admin", email: "admin@example.test", roles: ["admin"] } }));
  await page.route("**/api/v1/admin/analytics/overview", route => route.fulfill({ status: 503, json: { message: "Database unavailable" } }));
  await page.goto("/admin");
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toContainText("Unable to load the overview");
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("invitation validation uses the shared toast", async ({ page }) => {
  await page.goto("/accept-admin-invite");
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toContainText("This invitation link is incomplete.");
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await expect(page.getByRole("region", { name: "Notifications" }).getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Open the complete invitation link to continue.")).toBeVisible();
});
