/**
 * Run this script ONCE from your own computer (not a server) to get your
 * Garmin session token. Your home IP won't trigger Garmin's bot detection.
 *
 * Usage:
 *   node scripts/garmin-auth.mjs
 *
 * Then paste the printed token into the Garmin Connect section in Settings.
 */
import { createInterface } from "readline";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

console.log("\nFitlog — Garmin token generator");
console.log("─────────────────────────────────");
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
  console.log("──────────────────────────────────────────────────────────────");
  console.log("Paste this token into the Garmin Connect section in Settings:");
  console.log("──────────────────────────────────────────────────────────────\n");
  console.log(JSON.stringify(token));
  console.log("\n──────────────────────────────────────────────────────────────");
  console.log("Keep this token private — it gives read access to your Garmin data.");
} catch (err) {
  console.error("\nFailed:", err.message);
  process.exit(1);
}
