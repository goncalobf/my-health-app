import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const source = join(root, "assets", "brand", "fitlog-mark-source.png");
const sizes = {
  "icon-192.png": 192,
  "icon-512.png": 512,
  "maskable-512.png": 512,
  "apple-touch-icon.png": 180,
  "favicon.png": 64,
};

await mkdir(iconsDir, { recursive: true });
for (const [name, size] of Object.entries(sizes)) {
  // The square source is already full bleed with the mark inside the safe area.
  await sharp(source).resize(size, size).png().toFile(join(iconsDir, name));
  console.log("wrote", name);
}
