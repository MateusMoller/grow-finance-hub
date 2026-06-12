import { test, expect } from "@playwright/test";
import { getE2ECredentials, loginWithProfile } from "../helpers/auth";

const internalCredentials = getE2ECredentials("internal");

test.describe("reports saved models", () => {
  test("reports route exposes saved model form for internal users", async ({ page }) => {
    if (internalCredentials) {
      await loginWithProfile(page, "internal", internalCredentials);
    }
    await page.goto("/app/relatorios");
    if (!internalCredentials) {
      await expect(page).toHaveURL(/\/app\/login$/);
      return;
    }
    await expect(page.getByLabel("Modelo salvo")).toBeVisible();
  });
});
