import { expect, type Page } from "@playwright/test";

export type AccessProfile = "internal" | "client";

export interface E2ECredentials {
  email: string;
  password: string;
}

const profileButtonByAccess: Record<AccessProfile, string> = {
  internal: "App Interno",
  client: "Portal do Cliente",
};

const submitButtonByAccess: Record<AccessProfile, RegExp> = {
  internal: /entrar em app interno/i,
  client: /entrar em portal do cliente/i,
};

const landingPathByAccess: Record<AccessProfile, RegExp> = {
  internal: /\/app(\/|$)/,
  client: /\/portal(\/|$)/,
};

function readEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

export function getE2ECredentials(profile: AccessProfile): E2ECredentials | null {
  if (profile === "internal") {
    const email = readEnv(["E2E_INTERNAL_EMAIL", "E2E_DEFAULT_EMAIL"]);
    const password = readEnv(["E2E_INTERNAL_PASSWORD", "E2E_DEFAULT_PASSWORD"]);
    return email && password ? { email, password } : null;
  }

  const email = readEnv(["E2E_CLIENT_EMAIL", "E2E_DEFAULT_EMAIL"]);
  const password = readEnv(["E2E_CLIENT_PASSWORD", "E2E_DEFAULT_PASSWORD"]);
  return email && password ? { email, password } : null;
}

export async function loginWithProfile(page: Page, profile: AccessProfile, credentials: E2ECredentials) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

  await page.getByRole("button", { name: profileButtonByAccess[profile], exact: true }).click();

  await page.locator('input[type="email"]').fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);

  const submitButton = page.getByRole("button", { name: submitButtonByAccess[profile] });
  await expect(submitButton).toBeVisible();

  await Promise.all([
    page.waitForURL(landingPathByAccess[profile], { timeout: 30_000 }),
    submitButton.click(),
  ]);

  await expect(page).not.toHaveURL(/\/login$/);
}

