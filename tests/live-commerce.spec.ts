import { expect, test } from "@playwright/test";

test("customer can complete the live BFF commerce flow", async ({ page }) => {
  const token = process.env.STOREMESH_ACCESS_TOKEN;
  test.skip(!process.env.STOREMESH_BFF_URL || !token, "set STOREMESH_BFF_URL and STOREMESH_ACCESS_TOKEN for live integration");

  await page.addInitScript((accessToken) => {
    window.sessionStorage.setItem("storemesh.access_token", accessToken);
  }, token);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Featured now" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to cart", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Add to cart", exact: true }).first().click();
  await expect(page.getByRole("button", { name: /Open cart, [1-9] items/ })).toBeVisible();
  await page.getByRole("button", { name: /Open cart, [1-9] items/ }).click();
  await expect(page.getByRole("heading", { name: "Shopping cart" })).toBeVisible();
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await expect(page.getByText(/Order .* placed\./)).toBeVisible();
});
