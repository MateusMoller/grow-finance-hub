import { test,expect } from "@playwright/test";
test("Integra Contador remains isolated when feature is disabled",async({page})=>{await page.goto("/app/login");await expect(page.getByText(/Integra Contador/)).toHaveCount(0)});
