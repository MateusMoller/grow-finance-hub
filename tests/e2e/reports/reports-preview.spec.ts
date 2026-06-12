import { test, expect } from "@playwright/test";
import { getE2ECredentials, loginWithProfile } from "../helpers/auth";

const internalCredentials = getE2ECredentials("internal");

test.describe("reports preview", () => {
  test("reports route is protected and renders governed preview shell for internal users", async ({ page }) => {
    if (internalCredentials) {
      await loginWithProfile(page, "internal", internalCredentials);
    }
    await page.goto("/app/relatorios");
    if (!internalCredentials) {
      await expect(page).toHaveURL(/\/app\/login$/);
      return;
    }
    await expect(page.getByRole("heading", { name: "Relatorios" })).toBeVisible();
  });
});
