import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public", "icons");

// A simple dumbbell mark on the app's dark background.
const logo = (size, pad) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="${pad ? 96 : 0}" fill="#0b0f14"/>
  <g transform="translate(256 256) rotate(-45)" stroke="#22d3a6" stroke-width="34" stroke-linecap="round" fill="none">
    <line x1="-150" y1="0" x2="150" y2="0"/>
    <line x1="-150" y1="-58" x2="-150" y2="58"/>
    <line x1="-104" y1="-84" x2="-104" y2="84"/>
    <line x1="150" y1="-58" x2="150" y2="58"/>
    <line x1="104" y1="-84" x2="104" y2="84"/>
  </g>
</svg>`;

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const jobs = [
    { name: "icon-192.png", size: 192, pad: true },
    { name: "icon-512.png", size: 512, pad: true },
    { name: "maskable-512.png", size: 512, pad: false },
    { name: "apple-touch-icon.png", size: 180, pad: false },
    { name: "favicon.png", size: 64, pad: true },
  ];
  for (const j of jobs) {
    await sharp(Buffer.from(logo(j.size, j.pad)))
      .png()
      .toFile(join(iconsDir, j.name));
    console.log("wrote", j.name);
  }
}

main();
