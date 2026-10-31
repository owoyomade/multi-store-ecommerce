import { expect, test } from "@playwright/test";
import { E2E_APP_URL } from "../playwright.config";
import { linkFromLatestEmail } from "./support";

// The whole life of a store in one story: a new merchant signs up and opens
// a store, a shopper buys from it, and the merchant ships the order.
test("sign up → open a store → sell a product → ship the order", async ({
  page,
  browser,
}) => {
  const runId = Date.now().toString(36);
  const merchantEmail = `merchant-${runId}@example.test`;
  const storeSlug = `e2e-${runId}`;

  await test.step("merchant signs up and verifies their email", async () => {
    await page.goto("/sign-up");
    await page.getByLabel("Your name").fill("Erin Merchant");
    await page.getByLabel("Email").fill(merchantEmail);
    await page.getByLabel("Password").fill(`e2e-password-${runId}`);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/check-email");

    await page.goto(await linkFromLatestEmail(merchantEmail, E2E_APP_URL));
    await page.waitForURL("**/dashboard");
  });

  await test.step("merchant creates and publishes a store", async () => {
    await page.goto("/dashboard/new");
    await page.getByLabel("Store name").fill("E2E Coffee");
    await page.getByLabel("Store address").fill(storeSlug);
    await page.getByLabel("Contact email").fill(merchantEmail);
    await page.getByRole("button", { name: "Create store" }).click();
    await page.waitForURL(`**/dashboard/${storeSlug}`);

    await page.goto(`/dashboard/${storeSlug}/products/new`);
    await page.getByLabel("Title").fill("Test Beans");
    await page
      .getByLabel("Visibility")
      .selectOption({ label: "Published — visible on your storefront" });
    await page.getByLabel(/^Price/).fill("18.50");
    await page.getByLabel("Starting stock per variant").fill("5");
    await page.getByRole("button", { name: "Create product" }).click();
    await page.waitForURL(/created=1/);

    await page.goto(`/dashboard/${storeSlug}`);
    await page.getByRole("button", { name: "Publish store" }).click();
    await expect(
      page.getByRole("button", { name: "Unpublish store" }),
    ).toBeVisible();
  });

  await test.step("a shopper buys two bags as a guest", async () => {
    const shopperContext = await browser.newContext();
    const shopper = await shopperContext.newPage();
    await shopper.goto(`/s/${storeSlug}/products/test-beans`);
    await shopper.getByLabel("Quantity").fill("2");
    await shopper.getByRole("button", { name: "Add to cart" }).click();
    await expect(shopper.getByText(/added to your cart/i)).toBeVisible();

    await shopper.goto(`/s/${storeSlug}/cart`);
    await shopper.getByRole("link", { name: "Check out" }).click();
    await shopper.getByLabel("Email").fill("guest@example.test");
    await shopper.getByLabel("Full name").fill("Gus Guest");
    await shopper.getByLabel("Address", { exact: true }).fill("1 Main St");
    await shopper.getByLabel("City").fill("Toronto");
    await shopper.getByLabel("Province / state").fill("ON");
    await shopper.getByLabel("Postal code").fill("M5V 1A1");
    await shopper.getByRole("button", { name: "Continue to payment" }).click();

    await shopper.waitForURL(/\/checkout\/success/);
    await expect(shopper.getByText("Thank you for your order!")).toBeVisible();
    await shopperContext.close();
  });

  await test.step("merchant sees the paid order and ships it", async () => {
    await page.goto(`/dashboard/${storeSlug}/orders`);
    await page.getByRole("link", { name: "#1001" }).click();
    await expect(page.getByText("Awaiting payment → Paid")).toBeVisible();

    await page.getByLabel("Carrier").fill("Canada Post");
    await page.getByLabel("Tracking number").fill("E2E123456CA");
    await page.getByRole("button", { name: "Mark as shipped" }).click();
    await expect(page.getByText("Shipped with Canada Post")).toBeVisible();
  });

  await test.step("stock went down by the two bags sold", async () => {
    await page.goto(`/dashboard/${storeSlug}/inventory`);
    const row = page.getByRole("row", { name: /Test Beans/ });
    await expect(row.getByRole("cell").nth(2)).toHaveText("3");
  });
});
