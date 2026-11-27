/** Mobile Garmin sign-in regression using browser-only fixtures. */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const port = Number(process.env.GARMIN_TEST_APP_PORT ?? 3210);
assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });
  let verification = 0;
  let cancellations = 0;
  let connected = false;
  let detailsAvailable = false;
  await page.route("**/api/garmin/connect", (route) => {
    assert.equal(route.request().method(), "GET");
    if (connected && !detailsAvailable) return route.fulfill({ status: 503, json: {} });
    return route.fulfill({ json: { connected, connectedAt: null, lastSyncedAt: null } });
  });
  await page.route("**/api/garmin/auth-session*", (route) => {
    assert.equal(route.request().method(), "POST");
    assert.deepEqual(route.request().postDataJSON(), { purpose: "browser" });
    return route.fulfill({ json: { id: "fixture", secret: "fixture-secret" } });
  });
  await page.route("**/api/garmin/auth-session/*", (route) => {
    assert.equal(route.request().method(), "DELETE");
    cancellations++;
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/garmin/auth", (route) => {
    const { action, state } = route.request().postDataJSON();
    if (action === "start") return route.fulfill({ json: { status: "mfa_required", state: "initial" } });
    if (++verification === 1) {
      assert.equal(state, "initial");
      return route.fulfill({
        json: { status: "mfa_required", state: "replacement", error: "That verification code was not accepted." },
      });
    }
    assert.equal(state, "replacement");
    connected = true;
    return route.fulfill({ json: { status: "connected" } });
  });

  await page.goto(`http://localhost:${port}/settings`);
  const code = page.getByLabel("Verification code");
  const start = async () => {
    await page.getByLabel("Garmin email").fill("qa@example.test");
    await page.getByLabel("Garmin password", { exact: true }).fill("synthetic-password");
    await page.getByRole("button", { name: "Connect Garmin", exact: true }).click();
    await code.waitFor();
  };
  await start();
  await page.getByRole("button", { name: "Start over" }).click();
  await code.waitFor({ state: "hidden" });
  assert.equal(cancellations, 1);

  await start();
  await code.fill("000000");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "That verification code was not accepted" }).waitFor();
  assert.equal(await code.inputValue(), "");
  await code.fill("123456");
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await page.getByText("Could not refresh Garmin connection details.").waitFor();
  await page.getByRole("button", { name: "Disconnect", exact: true }).waitFor();
  assert.equal(await code.count(), 0);

  detailsAvailable = true;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.getByText("Could not refresh Garmin connection details.").waitFor({ state: "hidden" });
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 740 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
  }
  console.log("Garmin mobile sign-in regression passed at 320, 375 and 390 px.");
} finally {
  await browser.close();
}
