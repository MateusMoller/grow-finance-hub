import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/app",
  "/app/clientes",
  "/app/solicitacoes",
  "/app/manual",
  "/portal",
];

test.describe("Protected route guards", () => {
  test("unauthenticated users are redirected to login", async ({ page }) => {
    for (const path of protectedRoutes) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    }
  });
});

