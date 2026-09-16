import { expect, test } from "@playwright/test";
import { Pool } from "pg";

async function removeTestBusiness(email: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("begin");
    const user = await pool.query<{ id: string }>("select id from users where email = $1", [email]);
    if (user.rows[0]) {
      const business = await pool.query<{ id: string }>("select id from businesses where owner_user_id = $1", [user.rows[0].id]);
      if (business.rows[0]) await pool.query("delete from wallets where owner_type = 'business' and owner_id = $1", [business.rows[0].id]);
      await pool.query("delete from verification_requests where user_id = $1", [user.rows[0].id]);
      await pool.query("delete from businesses where owner_user_id = $1", [user.rows[0].id]);
      await pool.query("delete from users where id = $1", [user.rows[0].id]);
    }
    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  } finally {
    await pool.end();
  }
}

async function removeTestPromoter(email: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("begin");
    const user = await pool.query<{ id: string }>("select id from users where email = $1", [email]);
    if (user.rows[0]) {
      const promoter = await pool.query<{ id: string }>("select id from promoters where user_id = $1", [user.rows[0].id]);
      if (promoter.rows[0]) await pool.query("delete from wallets where owner_type = 'promoter' and owner_id = $1", [promoter.rows[0].id]);
      await pool.query("delete from verification_requests where user_id = $1", [user.rows[0].id]);
      await pool.query("delete from promoters where user_id = $1", [user.rows[0].id]);
      await pool.query("delete from users where id = $1", [user.rows[0].id]);
    }
    await pool.query("commit");
  } catch (error) {
    await pool.query("rollback");
    throw error;
  } finally {
    await pool.end();
  }
}

async function markVerificationPending(email: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("update verification_requests set status = 'pending', updated_at = now() where user_id = (select id from users where email = $1)", [email]);
  } finally {
    await pool.end();
  }
}

test("admin can sign in and navigate the sidebar", async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!email || !password, "ADMIN_EMAIL and ADMIN_PASSWORD are required");

  await page.goto("/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  const [loginResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/auth/login")),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  expect(loginResponse.status(), await loginResponse.text()).toBe(201);

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Trust is an operating system." })).toBeVisible();

  await page.getByRole("link", { name: "Campaigns" }).click();
  await expect(page).toHaveURL(/\/admin\/campaigns$/);
  await expect(page.getByRole("heading", { name: "Campaign moderation", exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Campaigns" })).toHaveAttribute("aria-current", "page");
});

test("a business can register and reach its workspace", async ({ page }) => {
  const uniqueEmail = `browser-check-${Date.now()}@reelch.test`;
  try {
    await page.goto("/register");
    await page.getByRole("button", { name: /Business Create campaigns/ }).click();
    await page.getByLabel("Full name").fill("Browser Check");
    await page.getByLabel("Business name").fill("Browser Check Ltd");
    await page.getByLabel("Email address").fill(uniqueEmail);
    await page.getByLabel("Password", { exact: true }).fill("RegistrationCheck123!");
    await page.getByLabel("Confirm password").fill("RegistrationCheck123!");
    const [response] = await Promise.all([
      page.waitForResponse((item) => item.url().endsWith("/auth/register")),
      page.getByRole("button", { name: "Create account" }).click(),
    ]);
    expect(response.status(), await response.text()).toBe(201);
    await expect(page).toHaveURL(/\/onboarding\/business$/);
    await expect(page.getByRole("heading", { name: "Let’s get you ready." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business profile" })).toBeVisible();
  } finally {
    await removeTestBusiness(uniqueEmail);
  }
});

test("a promoter can choose their role and reach promoter onboarding", async ({ page }) => {
  const uniqueEmail = `promoter-check-${Date.now()}@reelch.test`;
  try {
    await page.goto("/register");
    await page.getByRole("button", { name: /Promoter Promote campaigns/ }).click();
    await page.getByLabel("Full name").fill("Promoter Check");
    await page.getByLabel("Username").fill(`promoter-${Date.now()}`);
    await page.getByLabel("Email address").fill(uniqueEmail);
    await page.getByLabel("Password", { exact: true }).fill("RegistrationCheck123!");
    await page.getByLabel("Confirm password").fill("RegistrationCheck123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/onboarding\/promoter$/);
    await expect(page.getByRole("heading", { name: "Creator profile" })).toBeVisible();
  } finally {
    await removeTestPromoter(uniqueEmail);
  }
});

test("an admin can inspect and approve a submitted verification", async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const uniqueEmail = `review-check-${Date.now()}@reelch.test`;
  test.skip(!email || !password, "ADMIN_EMAIL and ADMIN_PASSWORD are required");
  try {
    await page.goto("/register");
    await page.getByRole("button", { name: /Business Create campaigns/ }).click();
    await page.getByLabel("Full name").fill("Verification Review Check");
    await page.getByLabel("Business name").fill("Review Check Ltd");
    await page.getByLabel("Email address").fill(uniqueEmail);
    await page.getByLabel("Password", { exact: true }).fill("RegistrationCheck123!");
    await page.getByLabel("Confirm password").fill("RegistrationCheck123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/onboarding\/business$/);
    await markVerificationPending(uniqueEmail);

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email!);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("link", { name: "Open queue" }).click();
    const requestLink = page.getByRole("link", { name: new RegExp(uniqueEmail) });
    await expect(requestLink).toBeVisible();
    await requestLink.click();
    await expect(page.getByRole("heading", { name: "Submitted profile" })).toBeVisible();
    await page.getByRole("button", { name: "Approve verification" }).click();
    await expect(page.locator("span").filter({ hasText: /^approved$/ })).toBeVisible();
  } finally {
    await removeTestBusiness(uniqueEmail);
  }
});
