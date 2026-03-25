import { expect, test } from "@playwright/test";

test.describe("Site smoke tests", () => {
  test("institucional exibe metrica atualizada e CTA principal", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("120+")).toBeVisible();
    await expect(page.getByText("Empresas atendidas")).toBeVisible();
    await expect(page.getByRole("link", { name: /solicitar avaliacao gratuita/i }).first()).toBeVisible();
  });

  test("fluxo publico navega para contato", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /falar com especialista/i }).first().click();

    await expect(page).toHaveURL(/\/contato$/);
    await expect(page.getByRole("heading", { name: /vamos/i })).toBeVisible();
  });

  test("rota protegida redireciona usuario nao autenticado para login", async ({ page }) => {
    await page.goto("/app");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("rota inexistente exibe tela 404", async ({ page }) => {
    await page.goto("/rota-inexistente-para-teste");

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });
});
