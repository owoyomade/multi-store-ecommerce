import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support";

// axe checks each key page against WCAG 2.1 A and AA. A "critical" or
// "serious" problem (missing labels, unreadable contrast, keyboard traps...)
// fails the test, with the offending elements listed.
async function expectNoSeriousProblems(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations
    .filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    )
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      elements: violation.nodes.slice(0, 3).map((node) => ({
        target: node.target.join(" "),
        problem: node.any[0]?.message ?? node.failureSummary,
      })),
    }));
  expect(serious).toEqual([]);
}

// Sections fade in as they scroll into view. Mid-fade, text is partly
// transparent and axe would measure a contrast nobody actually reads, so the
// checks run with reduced motion, where everything is shown at full strength.
test.use({ reducedMotion: "reduce" });

const storefrontPages = [
  { name: "Classic home", path: "/s/northbrew" },
  { name: "Bold home", path: "/s/lumen" },
  { name: "product page", path: "/s/northbrew/products/glass-carafe" },
  { name: "product listing", path: "/s/lumen/products" },
];

for (const { name, path } of storefrontPages) {
  test(`storefront ${name} has no serious accessibility problems`, async ({
    page,
  }) => {
    await page.goto(path);
    await expectNoSeriousProblems(page);
  });
}

test("cart and checkout have no serious accessibility problems", async ({
  page,
}) => {
  await page.goto("/s/northbrew/products/glass-carafe");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText(/added to your cart/i)).toBeVisible();

  await page.goto("/s/northbrew/cart");
  await expectNoSeriousProblems(page);
  await page.goto("/s/northbrew/checkout");
  await expectNoSeriousProblems(page);
});

test("dashboard overview and orders have no serious accessibility problems", async ({
  page,
}) => {
  await signIn(
    page,
    "maya@northbrew.example.test",
    process.env.SEED_DEMO_PASSWORD ?? "",
  );
  for (const path of [
    "/dashboard/northbrew",
    "/dashboard/northbrew/orders",
    "/dashboard/northbrew/inventory",
    "/dashboard/northbrew/discounts",
  ]) {
    await page.goto(path);
    await expectNoSeriousProblems(page);
  }
});
