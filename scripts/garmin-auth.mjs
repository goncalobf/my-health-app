/**
 * Garmin authentication helper for Fitlog.
 *
 * Runs on your own computer so Garmin's bot detection doesn't block the login.
 *
 * Auto mode (launched by the app — paste the command from Settings):
 *   node scripts/garmin-auth.mjs <sessionId> <secret> <appUrl>
 *
 * Manual mode (paste the token yourself):
 *   node scripts/garmin-auth.mjs
 */
import { createInterface } from "readline";

const [,, sessionId, secret, appUrl] = process.argv;
const autoMode = !!(sessionId && secret && appUrl);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

console.log("\nFitlog — Garmin authentication");
console.log("────────────────────────────────");
console.log("This runs on your own machine so Garmin won't block it.\n");

const username = (await ask("Garmin email:    ")).trim();
const password = await ask("Garmin password: ");
rl.close();

process.stdout.write("\nConnecting to Garmin…");

try {
  const { GarminConnect } = await import("garmin-connect");
  const gc = new GarminConnect({ username, password });
  await gc.login(username, password);
  const token = gc.exportToken();
  console.log(" done.\n");

  if (autoMode) {
    process.stdout.write("Sending token to Fitlog…");
    const res = await fetch(`${appUrl}/api/garmin/auth-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, secret, token }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error(" failed:", body.error ?? res.status);
      process.exit(1);
    }
    console.log(" done.");
    console.log("\nYou can close this window. The app will connect automatically.");
  } else {
    console.log("──────────────────────────────────────────────────────────────");
    console.log("Paste this token into the Garmin Connect section in Settings:");
    console.log("──────────────────────────────────────────────────────────────\n");
    console.log(JSON.stringify(token));
    console.log("\n──────────────────────────────────────────────────────────────");
    console.log("Keep this token private — it gives read access to your Garmin data.");
  }
} catch (err) {
  console.error("\nFailed:", err.message);
  process.exit(1);
}
