#!/usr/bin/env node
/**
 * Builds web-ready brand assets from the originals in scripts/brand/source:
 *   logo.webp  → public/brand/gen-e-logo.{png,webp}  (trimmed wordmark)
 *   mark.webp  → src/app/icon1.png (32), icon2.png (192), apple-icon.png (180), public/brand/gen-e-mark.png (512)
 *   share.webp → public/brand/og-default.jpg (1200×630 Open Graph / social preview)
 *
 *   node scripts/brand/build-brand-assets.mjs
 */
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "../..");
const src = (f) => path.join(root, "scripts/brand/source", f);
const out = (f) => path.join(root, f);

// Wordmark: trim the white/transparent margin, keep transparency.
const logo = sharp(src("logo.webp")).trim({ threshold: 10 });
await logo.clone().resize({ width: 960 }).png({ compressionLevel: 9 }).toFile(out("public/brand/gen-e-logo.png"));
await logo.clone().resize({ width: 960 }).webp({ quality: 92 }).toFile(out("public/brand/gen-e-logo.webp"));

// Mark: square, trimmed, with a little breathing room for small favicon sizes.
const markBuf = await sharp(src("mark.webp")).trim({ threshold: 10 }).toBuffer();
const square = async (size, pad, background) =>
  sharp(markBuf)
    .resize(size - pad * 2, size - pad * 2, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background })
    .png({ compressionLevel: 9 });
const clear = { r: 255, g: 255, b: 255, alpha: 0 };
await (await square(32, 1, clear)).toFile(out("src/app/icon1.png"));
await (await square(192, 8, clear)).toFile(out("src/app/icon2.png"));
// iOS ignores transparency on home-screen icons, so give it a white plate.
await (await square(180, 18, { r: 255, g: 255, b: 255, alpha: 1 })).flatten({ background: "#ffffff" }).toFile(out("src/app/apple-icon.png"));
await (await square(512, 16, clear)).toFile(out("public/brand/gen-e-mark.png"));

// Social preview: 1200×630 (1.91:1), cropped from the centre-left so the logo and presenter stay in frame.
await sharp(src("share.webp")).resize(1200, 630, { fit: "cover", position: "centre" }).jpeg({ quality: 86, mozjpeg: true }).toFile(out("public/brand/og-default.jpg"));

console.log("Brand assets written.");
