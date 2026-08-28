import { expect, test } from "@playwright/test";
import { getE2ECredentials, loginWithProfile } from "./helpers/auth";

const internalCredentials = getE2ECredentials("internal");

test.describe("Integra Contador monitoring", () => {
  test.skip(
    !internalCredentials,
    "Configure E2E_INTERNAL_EMAIL/E2E_INTERNAL_PASSWORD for authenticated monitoring tests.",
  );

  test.beforeEach(async ({ page }) => {
    await loginWithProfile(page, "internal", internalCredentials!);
    await page.goto("/app/integracoes/integra-contador");
    await expect(page.getByRole("heading", { name: "Integra Contador" })).toBeVisible();
  });

  test("manager can navigate overview, clients, monitoring and settings", async ({ page }) => {
    for (const tab of ["Visão geral", "Clientes", "Monitoramento", "Configurações"]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("data-state", "active");
    }
    await page.getByRole("tab", { name: "Monitoramento" }).click();
    await expect(page.getByText("Execuções fiscais")).toBeVisible();
  });

  test("eligible reprocessing uses the controlled backend action", async ({ page }) => {
    await page.getByRole("tab", { name: "Monitoramento" }).click();
    const button = page.getByRole("button", { name: "Reprocessar" }).first();
    test.skip(await button.count() === 0, "No eligible exhausted transient run exists in this environment.");
    const requestPromise = page.waitForRequest((request) => {
      if (!request.url().includes("/functions/v1/integra-contador-module")) return false;
      return request.postDataJSON()?.action === "reprocess_sync";
    });
    await button.click();
    const request = await requestPromise;
    expect(request.postDataJSON()).toMatchObject({ action: "reprocess_sync" });
    await expect(page.getByRole("button", { name: "Reprocessar" }).first()).toBeEnabled();
  });
});

test("monitoring route remains protected", async ({ page }) => {
  await page.goto("/app/integracoes/integra-contador");
  await expect(page).toHaveURL(/\/app\/login/);
});
