import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "scripts", "brand", "icon.png");
const outDir = join(root, "public", "icons");
const publicDir = join(root, "public");

mkdirSync(outDir, { recursive: true });

const source = sharp(sourcePath).ensureAlpha();

/** Full-bleed square. Source art already keeps content in the maskable safe zone. */
async function square(size) {
  return source
    .clone()
    .resize(size, size, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

const faviconPng = await square(32);
const faviconData = faviconPng.toString("base64");
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <image href="data:image/png;base64,${faviconData}" width="32" height="32" />
</svg>
`;

const icon192 = await square(192);
const icon512 = await square(512);

writeFileSync(join(publicDir, "favicon.png"), faviconPng);
writeFileSync(join(publicDir, "favicon.svg"), faviconSvg);
writeFileSync(join(outDir, "icon-192.png"), icon192);
writeFileSync(join(outDir, "icon-512.png"), icon512);
writeFileSync(join(outDir, "icon-maskable-192.png"), icon192);
writeFileSync(join(outDir, "icon-maskable-512.png"), icon512);

console.log(`Icons generated from ${sourcePath}`);
