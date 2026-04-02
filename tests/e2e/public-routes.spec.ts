import { expect, test } from "@playwright/test";

const publicRoutes: Array<{ path: string; checkpoint: RegExp }> = [
  { path: "/", checkpoint: /a grow expande o valor do seu negocio/i },
  { path: "/sobre", checkpoint: /a grow expande o valor do seu negocio/i },
  { path: "/inicio", checkpoint: /dashboard de resultados/i },
  { path: "/solucoes", checkpoint: /solucoes completas/i },
  { path: "/contato", checkpoint: /vamos conversar/i },
  { path: "/newsletter", checkpoint: /newsletter grow/i },
  { path: "/login", checkpoint: /ambiente de entrada/i },
];

test.describe("Public routes", () => {
  test("main pages render expected checkpoints", async ({ page }) => {
    for (const route of publicRoutes) {
      await page.goto(route.path);
      await expect(page.getByText(route.checkpoint).first()).toBeVisible();
    }
  });

  test("public navigation from hero CTA opens contact page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /vamos conversar/i }).first().click();
    await expect(page).toHaveURL(/\/contato$/);
    await expect(page.getByRole("heading", { name: /vamos conversar/i })).toBeVisible();
  });

  test("unknown route shows 404 screen", async ({ page }) => {
    await page.goto("/rota-inexistente-e2e");

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });
});

