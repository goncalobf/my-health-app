import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");
const source = join(root, "assets", "brand", "fitlog-mark-source.png");

async function squareArtwork() {
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Could not read Fitlog mark dimensions.");

  const side = Math.min(metadata.width, metadata.height);
  // The original is a portrait composition. Crop around the figure, leaving a
  // little black breathing room above the hair instead of centering empty sky.
  const idealTop = metadata.height - side - Math.round(side * 0.085);
  const top = Math.max(0, Math.min(metadata.height - side, idealTop));
  const left = Math.round((metadata.width - side) / 2);

  return sharp(source)
    .extract({ left, top, width: side, height: side })
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const artwork = await squareArtwork();
  const jobs = [
    { name: "icon-192.png", size: 192, scale: 0.9 },
    { name: "icon-512.png", size: 512, scale: 0.9 },
    { name: "maskable-512.png", size: 512, scale: 0.8 },
    { name: "apple-touch-icon.png", size: 180, scale: 0.9 },
    { name: "favicon.png", size: 64, scale: 0.94 },
  ];
  for (const j of jobs) {
    const inset = Math.round(j.size * j.scale);
    const mark = await sharp(artwork)
      .resize(inset, inset, { fit: "cover" })
      .png()
      .toBuffer();
    const offset = Math.floor((j.size - inset) / 2);
    await sharp({
      create: {
        width: j.size,
        height: j.size,
        channels: 3,
        background: "#000000",
      },
    })
      .composite([{ input: mark, left: offset, top: offset }])
      .png()
      .toFile(join(iconsDir, j.name));
    console.log("wrote", j.name);
  }
}

main();
