import { expect, test } from "@playwright/test";
import { getE2ECredentials, loginWithProfile } from "./helpers/auth";

const internalCredentials = getE2ECredentials("internal");

test.describe("Internal app - authenticated QA", () => {
  test.skip(
    !internalCredentials,
    "Configure E2E_INTERNAL_EMAIL/E2E_INTERNAL_PASSWORD (or E2E_DEFAULT_*) to run authenticated internal tests.",
  );

  test("core pages load and sidebar can collapse", async ({ page }) => {
    await loginWithProfile(page, "internal", internalCredentials!);

    await expect(page).toHaveURL(/\/app(\/|$)/);
    await expect(page.getByText(/grow finance hub - area interna/i)).toBeVisible();

    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    const clientsLinkText = sidebar.locator("span", { hasText: "Clientes" });

    await expect(clientsLinkText).toBeVisible();
    await page.getByRole("button", { name: /toggle sidebar/i }).first().click();
    await expect(clientsLinkText).toHaveCount(0);
    await page.getByRole("button", { name: /toggle sidebar/i }).first().click();
    await expect(sidebar.locator("span", { hasText: "Clientes" })).toBeVisible();

    const routeChecks: Array<{ path: string; heading: RegExp }> = [
      { path: "/app/kanban", heading: /^kanban$/i },
      { path: "/app/calendario", heading: /calend/i },
      { path: "/app/tarefas", heading: /^tarefas$/i },
      { path: "/app/clientes", heading: /^clientes$/i },
      { path: "/app/solicitacoes", heading: /central de atendimento do portal/i },
      { path: "/app/manual", heading: /manual de uso da plataforma/i },
    ];

    for (const routeCheck of routeChecks) {
      await page.goto(routeCheck.path);
      await expect(page.getByRole("heading", { name: routeCheck.heading }).first()).toBeVisible();
    }
  });

  test("client registration modal validates segment options and password policy", async ({ page }) => {
    await loginWithProfile(page, "internal", internalCredentials!);
    await page.goto("/app/clientes");

    const newClientButton = page.getByRole("button", { name: /novo cliente/i });
    test.skip(
      (await newClientButton.count()) === 0,
      "Current profile has no permission to create clients.",
    );

    await newClientButton.click();
    await expect(page.getByRole("heading", { name: /novo cliente/i })).toBeVisible();

    const segmentSelect = page
      .locator("div")
      .filter({ has: page.getByText("Segmento do Cliente") })
      .locator("select");

    await expect(segmentSelect.locator("option", { hasText: "Comercio" })).toHaveCount(1);
    await expect(segmentSelect.locator("option", { hasText: "Industria" })).toHaveCount(1);

    await page.getByPlaceholder("Nome da empresa").fill("QA Empresa Temporaria");
    await page.getByPlaceholder("email@empresa.com").fill("qa.empresa.temporaria@example.com");
    await page.getByPlaceholder("Minimo 6 caracteres").fill("123");

    await page.getByRole("button", { name: /^cadastrar$/i }).click();
    await expect(page.getByText(/senha do portal precisa ter no minimo 6 caracteres/i)).toBeVisible();

    await page.getByRole("button", { name: /cancelar/i }).click();
  });
});

