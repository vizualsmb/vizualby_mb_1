import { expect, test, type Page } from "@playwright/test";

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
}
const viewports = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-15", width: 393, height: 852 },
  { name: "iphone-pro-max", width: 430, height: 932 },
  { name: "android", width: 360, height: 800 },
  { name: "small-mobile", width: 320, height: 740 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1000 },
];
for (const viewport of viewports) {
  test(`${viewport.name}: complete preview funnel and layout`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
    let posts = 0; page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/api/booking")) posts += 1; });
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/booking");
    await expect(page.getByRole("heading", { name: /WHAT ARE WE MAKING/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await noOverflow(page);
    await page.screenshot({ path: `artifacts/booking/${viewport.name}-packages.png`, fullPage: true });
    await page.getByRole("button", { name: /Short-form content/ }).click();
    const signature = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "The Signature", exact: true }) });
    await signature.getByRole("button", { name: "Book this package" }).click();
    await page.getByRole("checkbox", { name: /Extra vertical cut/ }).check();
    await expect(page.getByRole("checkbox", { name: /Extra vertical cut/ })).toBeChecked();
    await noOverflow(page);
    await expect(page.getByRole("button", { name: "Continue to project details" })).toBeDisabled();
    await page.getByRole("button", { name: "October 10, 2026", exact: true }).click();
    await page.getByRole("button", { name: "2:00 PM – 4:00 PM", exact: true }).click();
    await noOverflow(page);
    await page.screenshot({ path: `artifacts/booking/${viewport.name}-calendar.png`, fullPage: true });
    await page.getByRole("button", { name: "Continue to project details" }).click();
    await page.getByLabel("Full name").fill("Jordan Client");
    await page.getByLabel("Email", { exact: false }).fill("jordan@example.com");
    await page.getByLabel("Phone number").fill("6175550100");
    await page.getByLabel("Tell us about your project and vision").fill("Instagram campaign with six product videos for our new launch.");
    await expect(page.locator('input[name="name"]')).toHaveAttribute("autocomplete", "name");
    await expect(page.locator('input[name="email"]')).toHaveAttribute("type", "email");
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await expect(page.getByRole("heading", { name: /YOUR NEXT CHAPTER/ })).toBeVisible();
    await expect(page.getByLabel("Your booking summary")).toContainText("$975");
    await expect(page.getByLabel("Your booking summary")).toContainText("$425");
    await expect(page.getByLabel("Your booking summary")).toContainText("$550");
    await page.getByRole("checkbox", { name: /I agree to/ }).check();
    await noOverflow(page);
    await page.screenshot({ path: `artifacts/booking/${viewport.name}-intake.png`, fullPage: true });
    await page.getByRole("button", { name: "Preview confirmation" }).click();
    await expect(page.getByRole("heading", { name: /YOU’RE ALMOST/ })).toBeVisible();
    await expect(page.getByText("Jordan Client", { exact: true })).toBeVisible();
    await expect(page.getByText("$975", { exact: true })).toBeVisible();
    await expect(page.getByText("$425", { exact: true })).toBeVisible();
    await expect(page.getByText("$550", { exact: true })).toBeVisible();
    await expect(page.getByText("2:00 PM EDT", { exact: true })).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `artifacts/booking/${viewport.name}-confirmation.png`, fullPage: true });
    expect(errors).toEqual([]); expect(posts).toBe(0);
  });
}

test("music pricing and add-on scope match the owner catalog", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto("/booking");
  await page.getByRole("button", { name: /Music videos/ }).click();
  const run = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Run & Gun", exact: true }) });
  await expect(run).toContainText("$500");
  await expect(run).toContainText("$250 non-refundable");
  const full = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Full Concept", exact: true }) });
  await expect(full).toContainText("$1,500");
  await expect(full).toContainText("Multiple locations");
  await expect(full.getByRole("button", { name: "Book this package" })).toBeVisible();
  await noOverflow(page);
  await run.getByRole("button", { name: "Book this package" }).click();
  await expect(page.getByRole("checkbox", { name: /Extra revision/ })).toHaveCount(0);
  await page.getByRole("checkbox", { name: /Script \/ concept development/ }).check();
  await expect(page.getByRole("checkbox", { name: /Script \/ concept development/ })).toBeChecked();
  await noOverflow(page);
});

test("categories, custom quote, private metadata, portfolio route, and disabled APIs", async ({ page, request }) => {
  for (const name of ["Music videos", "Brand content", "Event coverage", "Real estate", "Custom production"]) {
    await page.goto("/booking");
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByRole("heading", { name: /CHOOSE YOUR PACKAGE/ })).toBeVisible();
    await expect(page.getByRole("region", { name: new RegExp(`${name} packages`) })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Request custom quote" })).toHaveAttribute("href", /^mailto:/);
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  await page.goto("/booking/success?uid=forged-payment-success");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "YOU’RE BOOKED." })).toHaveCount(0);
  expect((await request.post("/api/booking/session", { data: { packageId: "content-signature", deposit: 1 } })).status()).toBe(503);
  expect((await request.get("/api/booking/availability?packageId=content-signature&month=2026-10")).status()).toBe(503);
  expect((await request.post("/api/booking/webhooks/cal", { data: {} })).status()).toBe(503);
  const home = await request.get("/"); expect(home.ok()).toBe(true); expect(await home.text()).not.toContain("THE BOOKING ROOM");
  const bookingHost = await request.get("/", { headers: { host: "booking.vizualbymb.com" } }); expect(await bookingHost.text()).toContain("THE BOOKING ROOM");
});
