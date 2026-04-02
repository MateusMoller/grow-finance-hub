import { expect, test } from "@playwright/test";
import { getE2ECredentials, loginWithProfile } from "./helpers/auth";

const clientCredentials = getE2ECredentials("client");

test.describe("Client portal - authenticated QA", () => {
  test.skip(
    !clientCredentials,
    "Configure E2E_CLIENT_EMAIL/E2E_CLIENT_PASSWORD (or E2E_DEFAULT_*) to run authenticated portal tests.",
  );

  test("portal tabs, collapsible menu and cashflow gate/dashboard", async ({ page }) => {
    await loginWithProfile(page, "client", clientCredentials!);

    await expect(page).toHaveURL(/\/portal(\/|$)/);
    await expect(page.getByText("Portal do Cliente").first()).toBeVisible();

    const sidebar = page.locator('[data-sidebar="sidebar"]').first();

    await expect(sidebar.locator("span", { hasText: /solicit/i })).toBeVisible();
    await page.getByRole("button", { name: /toggle sidebar/i }).first().click();
    await expect(sidebar.locator("span", { hasText: /solicit/i })).toHaveCount(0);
    await page.getByRole("button", { name: /toggle sidebar/i }).first().click();
    await expect(sidebar.locator("span", { hasText: /solicit/i })).toBeVisible();

    await sidebar.getByRole("button", { name: /pend/i }).first().click();
    await expect(page.getByRole("heading", { name: /documentos aguardados/i })).toBeVisible();

    await sidebar.getByRole("button", { name: /solicit/i }).first().click();
    await expect(page.getByText(/solicit/i).first()).toBeVisible();

    await sidebar.getByRole("button", { name: /documentos/i }).first().click();
    await expect(page.getByText(/documentos/i).first()).toBeVisible();

    await sidebar.getByRole("button", { name: /controle de caixa/i }).first().click();

    const cashflowDashboard = page.getByText(/dashboard de caixa/i);
    const cashflowLocked = page.getByText(/controle de caixa bloqueado/i);
    await expect(cashflowDashboard.or(cashflowLocked)).toBeVisible();

    if (await cashflowDashboard.isVisible()) {
      await expect(page.getByRole("button", { name: /registrar lancamento/i })).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: /solicitar liberacao do controle de caixa/i })).toBeVisible();
    }

    await sidebar.getByRole("button", { name: /manual/i }).first().click();
    await expect(page.getByRole("heading", { name: /manual/i })).toBeVisible();

    await sidebar.getByRole("button", { name: /configura/i }).first().click();
    await expect(page.getByRole("heading", { name: /configura/i })).toBeVisible();

    await sidebar.getByRole("button", { name: /atendimento/i }).first().click();
    await expect(page.getByText(/falar com a equipe/i)).toBeVisible();
  });
});

