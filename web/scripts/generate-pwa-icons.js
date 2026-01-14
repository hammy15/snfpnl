/**
 * Generate PWA icons from SVG source
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [64, 192, 512];
const publicDir = join(__dirname, '../public');

// SVG icon with gradient background
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <text x="256" y="340" font-family="Arial, sans-serif" font-size="280" font-weight="700" fill="white" text-anchor="middle">S</text>
</svg>
`;

// Maskable icon with safe zone padding
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <text x="256" y="340" font-family="Arial, sans-serif" font-size="240" font-weight="700" fill="white" text-anchor="middle">S</text>
</svg>
`;

async function generateIcons() {
  console.log('Generating PWA icons...');

  // Generate regular icons
  for (const size of sizes) {
    const filename = `pwa-${size}x${size}.png`;
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(join(publicDir, filename));
    console.log(`  Created ${filename}`);
  }

  // Generate maskable icon (512x512)
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(join(publicDir, 'maskable-icon-512x512.png'));
  console.log('  Created maskable-icon-512x512.png');

  // Generate Apple touch icon (180x180)
  await sharp(Buffer.from(svgIcon))
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('  Created apple-touch-icon.png');

  // Generate favicon (32x32)
  await sharp(Buffer.from(svgIcon))
    .resize(32, 32)
    .png()
    .toFile(join(publicDir, 'favicon.ico'));
  console.log('  Created favicon.ico');

  console.log('Done!');
}

generateIcons().catch(console.error);
