import { expect, type Page } from "@playwright/test";

const MAILPIT_API = "http://localhost:8030/api/v1";

/** Waits for the newest email to `to` and returns the first app link in it. */
export async function linkFromLatestEmail(
  to: string,
  appUrl: string,
): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`,
        ).then((response) => response.json());
        const id = search.messages?.[0]?.ID;
        if (!id) return undefined;
        const message = await fetch(`${MAILPIT_API}/message/${id}`).then(
          (response) => response.json(),
        );
        link = String(message.Text).match(
          new RegExp(`${appUrl}[^\\s"<>]+`),
        )?.[0];
        return link;
      },
      { timeout: 15_000, message: `no email with a link reached ${to}` },
    )
    .toBeTruthy();
  if (!link) throw new Error(`no link found in the email to ${to}`);
  return link;
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}
